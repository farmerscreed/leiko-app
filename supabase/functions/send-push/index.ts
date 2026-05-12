// /send-push — Sprint 15.
//
// Single egress point for every push from Leiko. Inputs:
//
//   { category: 'anomaly' | 'daily' | 'weekly' | 'device' | 'family'
//              | 'subscription' | 'marketing',
//     userId, ... category-specific payload }
//
// Pipeline:
//   1. Resolve recipient profile + notification_preferences + tokens.
//   2. Check umbrella opt-out for the category.
//   3. For anomaly: check per-vital opt-out.
//   4. Render the body via notification-templates (recipient-aware).
//   5. Run voice-lint on the rendered title + body. Fail closed on hard hits.
//   6. Check quiet-hours (recipient's timezone). Apply bypass flags.
//   7. Per-category 24h rate limit (3 pushes max for non-urgent).
//   8. POST to Expo Push API.
//   9. Record audit-log row + emit PostHog event with no PHI.
//
// HARD RULES per CLAUDE.md + docs/05:
//   - Reading values NEVER appear in PostHog metadata.
//   - Voice-lint failure drops the push silently with audit_log entry.
//   - send-push is the only place that talks to Expo. The mobile app
//     never sends pushes to itself.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  renderAnomalyNotification,
  renderDailySummary,
  renderWeeklySummary,
  renderWatchLowBattery,
  renderFamilyInviteAccepted,
  renderSubscriptionRenewing,
  type AccountType,
  type RenderedNotification,
  type AnomalyReason,
} from '../_shared/notification-templates.ts';
import {
  lintPushText,
  PUSH_BODY_MAX_ANDROID,
} from '../_shared/voice-lint-push.ts';
import { isWithinQuietWindow } from '../_shared/quiet-hours.ts';
import type {
  VitalKind,
  ClassificationTier,
} from '../_shared/classification.ts';

type PushCategory =
  | 'anomaly'
  | 'daily'
  | 'weekly'
  | 'device'
  | 'family'
  | 'subscription'
  | 'marketing';

interface BasePayload {
  category: PushCategory;
  userId: string;
}

interface AnomalyPayload extends BasePayload {
  category: 'anomaly';
  anomalyEventId: string;
  vitalKind: VitalKind;
  tier: ClassificationTier;
  reason: AnomalyReason;
  readingId: string | null;
}

interface DailyPayload extends BasePayload {
  category: 'daily';
  parentLabel: string;
  sys?: number;
  dia?: number;
  hadReading: boolean;
  sleepHours?: number | null;
}

interface WeeklyPayload extends BasePayload {
  category: 'weekly';
  parentLabel: string;
  body: string;
}

interface DevicePayload extends BasePayload {
  category: 'device';
  parentLabel: string;
  batteryPct: number;
}

interface FamilyPayload extends BasePayload {
  category: 'family';
  caregiverName: string;
}

interface SubscriptionPayload extends BasePayload {
  category: 'subscription';
  priceUsd: string;
}

interface MarketingPayload extends BasePayload {
  category: 'marketing';
  title: string;
  body: string;
  deepLink?: string;
}

type SendPushRequest =
  | AnomalyPayload
  | DailyPayload
  | WeeklyPayload
  | DevicePayload
  | FamilyPayload
  | SubscriptionPayload
  | MarketingPayload;

interface SendPushResponse {
  outcome:
    | 'sent'
    | 'suppressed_opt_out'
    | 'suppressed_quiet_hours'
    | 'suppressed_rate_limit'
    | 'suppressed_voice_lint'
    | 'suppressed_no_template'
    | 'suppressed_no_token'
    | 'failed';
  detail?: string;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const service = createClient(supabaseUrl, serviceKey);

  let payload: SendPushRequest;
  try {
    payload = (await req.json()) as SendPushRequest;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const result = await routePush(service, payload);
  await recordOutcome(service, payload, result);
  return json(result, result.outcome === 'failed' ? 502 : 200);
});

// ─────────────────────────────────────────────────────────────────────
// Routing.

async function routePush(
  service: SupabaseClient,
  payload: SendPushRequest,
): Promise<SendPushResponse> {
  // Load recipient + prefs in parallel.
  const [userRes, prefsRes, tokensRes] = await Promise.all([
    service
      .from('users')
      .select('id, account_type, timezone, display_name')
      .eq('id', payload.userId)
      .single(),
    service
      .from('notification_preferences')
      .select('*')
      .eq('user_id', payload.userId)
      .maybeSingle(),
    service
      .from('push_tokens')
      .select('expo_token, platform, last_seen_at')
      .eq('user_id', payload.userId)
      .order('last_seen_at', { ascending: false }),
  ]);

  if (userRes.error || !userRes.data) {
    return { outcome: 'failed', detail: 'user_not_found' };
  }
  const user = userRes.data as {
    id: string;
    account_type: AccountType;
    timezone: string;
    display_name: string;
  };

  const prefs = prefsRes.data ?? DEFAULT_PREFS;

  // 1. Opt-out gates.
  const optOut = checkOptOut(payload, prefs);
  if (optOut) return { outcome: 'suppressed_opt_out', detail: optOut };

  // 2. Render the body.
  const rendered = renderPayload(payload, user.account_type);
  if (!rendered) {
    return { outcome: 'suppressed_no_template' };
  }

  // 3. Voice-lint.
  const lintTitle = lintPushText(rendered.title);
  const lintBody = lintPushText(rendered.body);
  if (!lintTitle.passes || !lintBody.passes) {
    const matches = [
      ...lintTitle.hardHits.map((h) => `title:${h.match}`),
      ...lintBody.hardHits.map((h) => `body:${h.match}`),
    ].join(',');
    return { outcome: 'suppressed_voice_lint', detail: matches };
  }
  if (rendered.body.length > PUSH_BODY_MAX_ANDROID) {
    return { outcome: 'suppressed_voice_lint', detail: 'body_too_long' };
  }

  // 4. Quiet hours.
  const quiet = checkQuietHours(payload, prefs, user.timezone);
  if (quiet === 'hold') return { outcome: 'suppressed_quiet_hours' };

  // 5. Rate limit (per-category 24h, max 3 — except urgent anomaly).
  const rateExceeded = await checkRateLimit(service, payload, prefs);
  if (rateExceeded) return { outcome: 'suppressed_rate_limit' };

  // 6. Tokens.
  const tokens = (tokensRes.data ?? []) as Array<{ expo_token: string; platform: string; last_seen_at: string }>;
  if (tokens.length === 0) {
    return { outcome: 'suppressed_no_token' };
  }

  // 7. Dispatch.
  const deepLink = computeDeepLink(payload);
  const interruption = isUrgent(payload) ? 'time-sensitive' : 'active';
  const sent = await dispatchToExpo(
    tokens.map((t) => t.expo_token),
    rendered,
    deepLink,
    interruption,
  );
  if (!sent) return { outcome: 'failed', detail: 'expo_dispatch_failed' };
  return { outcome: 'sent' };
}

// ─────────────────────────────────────────────────────────────────────
// Per-category gates.

const DEFAULT_PREFS = {
  daily_summary: true,
  weekly_summary: true,
  anomaly_notifications: true,
  anomaly_bp: true,
  anomaly_hr: true,
  anomaly_spo2: true,
  watch_status: true,
  family_activity: true,
  subscription_account: true,
  marketing: false,
  quiet_hours_enabled: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  anomaly_bypass_quiet: false,
  medication_bypass_quiet: true,
};

function checkOptOut(payload: SendPushRequest, prefs: typeof DEFAULT_PREFS): string | null {
  switch (payload.category) {
    case 'anomaly':
      if (!prefs.anomaly_notifications) return 'umbrella_off';
      if (payload.vitalKind === 'bp' && !prefs.anomaly_bp) return 'bp_off';
      if (payload.vitalKind === 'hr' && !prefs.anomaly_hr) return 'hr_off';
      if (payload.vitalKind === 'spo2' && !prefs.anomaly_spo2) return 'spo2_off';
      return null;
    case 'daily':
      return prefs.daily_summary ? null : 'daily_off';
    case 'weekly':
      return prefs.weekly_summary ? null : 'weekly_off';
    case 'device':
      return prefs.watch_status ? null : 'device_off';
    case 'family':
      return prefs.family_activity ? null : 'family_off';
    case 'subscription':
      return prefs.subscription_account ? null : 'subscription_off';
    case 'marketing':
      return prefs.marketing ? null : 'marketing_off';
  }
}

function renderPayload(payload: SendPushRequest, recipient: AccountType): RenderedNotification | null {
  switch (payload.category) {
    case 'anomaly':
      return renderAnomalyNotification(recipient, {
        vitalKind: payload.vitalKind,
        tier: payload.tier,
        reason: payload.reason,
        parentLabel: recipient === 'caregiver' ? 'Mum' : 'you',
      });
    case 'daily':
      return renderDailySummary(recipient, payload);
    case 'weekly':
      return renderWeeklySummary(recipient, payload);
    case 'device':
      return renderWatchLowBattery(recipient, payload);
    case 'family':
      return renderFamilyInviteAccepted(recipient, payload);
    case 'subscription':
      return renderSubscriptionRenewing(recipient, payload);
    case 'marketing':
      return { title: payload.title, body: payload.body };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Quiet hours.

/**
 * Returns 'send' if the message may go now, or 'hold' if it should be
 * suppressed. We do NOT enqueue for later — suppression is the
 * end-state. Daily/weekly summaries are scheduled by upstream cron to
 * fire outside quiet hours anyway; anomaly is the only category that
 * can hit the quiet window, and it honours anomaly_bypass_quiet only
 * when the tier is confirmed_urgent (per docs/11 §5).
 */
export function checkQuietHours(
  payload: SendPushRequest,
  prefs: typeof DEFAULT_PREFS,
  timezone: string,
  now: Date = new Date(),
): 'send' | 'hold' {
  if (!prefs.quiet_hours_enabled) return 'send';
  if (!isWithinQuietWindow(now, prefs.quiet_hours_start, prefs.quiet_hours_end, timezone)) {
    return 'send';
  }
  // Inside the window. Allow only if this category + tier may bypass.
  if (payload.category === 'anomaly') {
    if (payload.tier === 'confirmed_urgent' && prefs.anomaly_bypass_quiet) return 'send';
    return 'hold';
  }
  // Device, daily, weekly, family, subscription, marketing → suppressed.
  return 'hold';
}

// isWithinQuietWindow lives in ../_shared/quiet-hours.ts so the test
// suite can import it without triggering Deno.serve at module load.

// ─────────────────────────────────────────────────────────────────────
// Rate limiting.

async function checkRateLimit(
  service: SupabaseClient,
  payload: SendPushRequest,
  _prefs: typeof DEFAULT_PREFS,
): Promise<boolean> {
  // Confirmed-urgent anomaly bypasses the rate limit.
  if (payload.category === 'anomaly' && payload.tier === 'confirmed_urgent') {
    return false;
  }
  // Count sent pushes in this category in the last 24h. We use
  // audit_log rows (action='push.sent', metadata->category) — the
  // recordOutcome writer logs every dispatched push there.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('actor_user_id', payload.userId)
    .eq('action', 'push.sent')
    .gte('occurred_at', since)
    .contains('metadata', { category: payload.category });
  return (count ?? 0) >= 3;
}

// ─────────────────────────────────────────────────────────────────────
// Deep link + interruption-level helpers.

function computeDeepLink(payload: SendPushRequest): string {
  switch (payload.category) {
    case 'anomaly':
      if (payload.vitalKind === 'bp' && payload.readingId) {
        return `leiko://reading/${payload.readingId}`;
      }
      return `leiko://vital/${payload.vitalKind}`;
    case 'daily':
      return 'leiko://home';
    case 'weekly':
      return 'leiko://weekly';
    case 'device':
      return 'leiko://settings/devices';
    case 'family':
      return 'leiko://family';
    case 'subscription':
      return 'leiko://settings/subscription';
    case 'marketing':
      return payload.deepLink ?? 'leiko://home';
  }
}

function isUrgent(payload: SendPushRequest): boolean {
  return payload.category === 'anomaly' && payload.tier === 'confirmed_urgent';
}

// ─────────────────────────────────────────────────────────────────────
// Expo Push API dispatch.

interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  priority?: 'default' | 'high';
  // iOS:
  sound?: 'default' | null;
  _displayInForeground?: boolean;
  // iOS interruption-level (Expo passes through to APNs).
  _category?: string;
  badge?: number;
  // Expo accepts this for iOS time-sensitive.
  interruptionLevel?: 'passive' | 'active' | 'time-sensitive' | 'critical';
}

async function dispatchToExpo(
  expoTokens: string[],
  rendered: RenderedNotification,
  deepLink: string,
  interruption: 'active' | 'time-sensitive',
): Promise<boolean> {
  // Honour the Expo sandbox flag when configured. Production credentials
  // are wired later; the sandbox endpoint accepts the same payload.
  const url = Deno.env.get('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send';
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

  const messages: ExpoPushMessage[] = expoTokens.map((to) => ({
    to,
    title: rendered.title,
    body: rendered.body,
    data: { url: deepLink },
    priority: interruption === 'time-sensitive' ? 'high' : 'default',
    sound: 'default',
    interruptionLevel: interruption,
  }));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(messages),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Outcome telemetry — audit_log only. PostHog events are emitted from
// the mobile side (no PHI ever in metadata).

async function recordOutcome(
  service: SupabaseClient,
  payload: SendPushRequest,
  result: SendPushResponse,
): Promise<void> {
  const metadata: Record<string, unknown> = {
    category: payload.category,
    outcome: result.outcome,
    detail: result.detail ?? null,
  };
  if (payload.category === 'anomaly') {
    metadata.vital_kind = payload.vitalKind;
    metadata.tier = payload.tier;
    metadata.anomaly_event_id = payload.anomalyEventId;
  }
  const action = result.outcome === 'sent' ? 'push.sent' : 'push.suppressed';
  try {
    await service.from('audit_log').insert({
      actor_user_id: payload.userId,
      action,
      metadata,
    });
  } catch {
    // Best-effort; never fail the push pipeline on audit-log writes.
  }
}
