// /revenuecat-webhook — Sprint 10a.
//
// RevenueCat fires this endpoint on every subscription state change for
// any user identified via Purchases.logIn(<supabase_user_id>). Per
// docs/09-paywall-and-iap.md §4:
//
//   • Validate signature using REVENUECAT_WEBHOOK_SECRET.
//   • Upsert public.subscriptions (raw event for audit).
//   • Write derived status to public.families.subscription_status.
//   • Idempotent: same event ID processed twice produces the same outcome.
//   • Audit-log entry for every status change.
//
// Auth model: RC uses the simpler "Authorization Header Value" pattern —
// in the RC dashboard the founder sets a shared secret; RC then sends
// it back verbatim in the Authorization header on every webhook. We
// compare directly. If the secret env var is missing, the function 503s
// rather than 200ing without verification.
//
// Family ownership: docs/09 §1 — "Single subscription per family circle.
// The family_owner subscribes; ALL caregivers in the family inherit Plus
// features." We update the family where the buyer is family_owner. If
// the buyer isn't a family_owner anywhere, we still record the
// subscriptions row (audit trail) but no family is updated.
//
// Status mapping per docs/09 §4 + the families.subscription_status
// CHECK constraint (free | plus | plus_trial | plus_grace | past_due):
//
//   RC event type            → subscriptions.status   → families.subscription_status
//   INITIAL_PURCHASE         → active                 → plus
//   RENEWAL                  → active                 → plus
//   TRIAL_STARTED            → trialing               → plus_trial
//   TRIAL_CONVERTED          → active                 → plus
//   PRODUCT_CHANGE           → active                 → plus (or plus_trial if is_trial_period)
//   UNCANCELLATION           → active                 → plus
//   NON_RENEWING_PURCHASE    → active                 → plus
//   BILLING_ISSUE            → grace                  → plus_grace
//   CANCELLATION             → cancelled              → keep current; flips on EXPIRATION
//   TRIAL_CANCELLED          → cancelled              → keep current; flips on EXPIRATION
//   EXPIRATION               → expired                → free
//
// Per CLAUDE.md voice + data rules: this function does NOT log values.
// Errors include codes + non-PHI metadata only.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  classifyEvent,
  type RcEventType,
  type SubscriptionsStatus,
  type FamiliesSubscriptionStatus,
} from './statusMap.ts';

interface RcEvent {
  id: string;
  type: RcEventType;
  app_user_id: string;
  product_id?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  cancel_reason?: string;
  is_trial_period?: boolean;
}

interface RcWebhookPayload {
  api_version?: string;
  event: RcEvent;
}

interface ResponseShape {
  ok: true;
  event_id: string;
  duplicate: boolean;
  family_updated: boolean;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!expectedAuth) {
    // Fail closed: refusing to process events when the secret isn't
    // configured prevents an unauthenticated path from mutating
    // entitlements.
    return json({ error: 'webhook_secret_not_configured' }, 503);
  }
  const authHeader = req.headers.get('Authorization') ?? '';
  // RC sends the configured value verbatim. Accept either the raw value
  // or `Bearer <value>` shape so the founder can use either.
  const presented = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : authHeader;
  if (presented !== expectedAuth) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: RcWebhookPayload;
  try {
    body = (await req.json()) as RcWebhookPayload;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const event = body?.event;
  if (
    !event ||
    typeof event.id !== 'string' ||
    typeof event.type !== 'string' ||
    typeof event.app_user_id !== 'string'
  ) {
    return json({ error: 'malformed_event' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const serviceClient: SupabaseClient = createClient(supabaseUrl, serviceKey);

  const userId = event.app_user_id;

  // Confirm the user exists. RC's app_user_id is whatever the client set
  // via Purchases.logIn — if it's a Leiko user.id, the row is here.
  // Anonymous RC ids (`$RCAnonymousID:*`) are dropped on the floor:
  // they belong to a session that never identified, so there's no
  // entitlement to grant.
  if (userId.startsWith('$RCAnonymousID:')) {
    return json({ ok: true, event_id: event.id, duplicate: false, family_updated: false } as ResponseShape, 200);
  }

  const { data: userRow } = await serviceClient
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (!userRow) {
    // The event references a user we don't know about. Don't 4xx — RC
    // would retry forever. Log to audit_log and 200 so the event drains.
    await bestEffortAuditInsert(serviceClient, {
      actor_user_id: null,
      family_id: null,
      action: 'subscription.unknown_user',
      metadata: { event_id: event.id, event_type: event.type },
    });
    return json({ ok: true, event_id: event.id, duplicate: false, family_updated: false } as ResponseShape, 200);
  }

  // Idempotency check: if this event_id is already recorded against the
  // subscriptions row for this user, skip writes and return.
  const { data: existing } = await serviceClient
    .from('subscriptions')
    .select('user_id, last_event_id, status')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing && existing.last_event_id === event.id) {
    await bestEffortAuditInsert(serviceClient, {
      actor_user_id: userId,
      family_id: null,
      action: 'subscription.event_replayed',
      metadata: { event_id: event.id, event_type: event.type },
    });
    return json({ ok: true, event_id: event.id, duplicate: true, family_updated: false } as ResponseShape, 200);
  }

  // Resolve the family this user owns. Single subscription per family
  // circle (docs/09 §1) — the buyer's family_owner row is what we
  // mutate. A user with no family_owner row gets their subscriptions
  // row written but no family update.
  const { data: ownerMembership } = await serviceClient
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .eq('role', 'family_owner')
    .is('removed_at', null)
    .limit(1)
    .maybeSingle();

  const classified = classifyEvent(event);

  // Upsert subscriptions row.
  const subsRow: Record<string, unknown> = {
    user_id: userId,
    rc_app_user_id: userId,
    product_id: event.product_id ?? null,
    entitlement: 'plus',
    status: classified.subscriptionsStatus,
    last_event_id: event.id,
    last_event_at: new Date().toISOString(),
    raw_event: event,
  };
  if (classified.subscriptionsStatus === 'trialing' && event.expiration_at_ms) {
    subsRow.trial_ends_at = new Date(event.expiration_at_ms).toISOString();
  }
  if (event.expiration_at_ms) {
    subsRow.current_period_end = new Date(event.expiration_at_ms).toISOString();
  }
  if (classified.subscriptionsStatus === 'cancelled') {
    subsRow.cancelled_at = new Date().toISOString();
  }

  const subsUpsert = await serviceClient
    .from('subscriptions')
    .upsert(subsRow, { onConflict: 'user_id' });
  if (subsUpsert.error) {
    return json({ error: 'subscription_upsert_failed', detail: subsUpsert.error.message }, 500);
  }

  // Family update: only when this user is a family_owner. CANCELLATION
  // and TRIAL_CANCELLED do NOT downgrade the family — entitlement
  // continues until EXPIRATION (per docs/09 §5 "Access continues until
  // end of current billing period"). classifyEvent encodes that as
  // shouldUpdateFamily=false on those types.
  let familyUpdated = false;
  if (ownerMembership && classified.shouldUpdateFamily) {
    const familyId = ownerMembership.family_id as string;
    const familyUpdate: Record<string, unknown> = {
      subscription_status: classified.familiesStatus,
      updated_at: new Date().toISOString(),
    };
    if (event.expiration_at_ms) {
      familyUpdate.subscription_renewal_date = new Date(event.expiration_at_ms).toISOString();
    }
    const familyUpd = await serviceClient
      .from('families')
      .update(familyUpdate)
      .eq('id', familyId);
    if (familyUpd.error) {
      return json({ error: 'family_update_failed', detail: familyUpd.error.message }, 500);
    }
    familyUpdated = true;

    await bestEffortAuditInsert(serviceClient, {
      actor_user_id: userId,
      family_id: familyId,
      action: classified.auditAction,
      metadata: {
        event_id: event.id,
        event_type: event.type,
        product_id: event.product_id ?? null,
        new_status: classified.familiesStatus,
      },
    });
  }

  const resp: ResponseShape = {
    ok: true,
    event_id: event.id,
    duplicate: false,
    family_updated: familyUpdated,
  };
  return json(resp, 200);
});

interface AuditRow {
  actor_user_id: string | null;
  family_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
}

async function bestEffortAuditInsert(client: SupabaseClient, row: AuditRow): Promise<void> {
  // Audit-log writes never block the webhook's 200 — RC retries on
  // non-2xx, and a missed audit row is preferable to a webhook
  // retry-storm caused by a partitioning hiccup.
  try {
    await client.from('audit_log').insert(row);
  } catch {
    // ignore
  }
}

// Re-export types for the unit test file.
export type { RcEvent, RcWebhookPayload, ResponseShape };
export type { RcEventType, SubscriptionsStatus, FamiliesSubscriptionStatus };
