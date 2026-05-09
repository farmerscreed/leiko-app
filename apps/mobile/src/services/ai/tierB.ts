// services/ai/tierB — Sprint 12.
//
// Mobile client for the ai-tier-b Edge Function. Replaces the literal-
// copy fallthrough in `tierBPlaceholder.ts` (Sprint 11) with a real
// Tier-B call when the local intent router can't classify a question.
//
// Contract with the server (D14 §11–§15):
//   - Send: { question: string }   (≤ 2000 chars, non-empty)
//   - Receive: a discriminated union — see TierBResult
//
// The system prompt, scrubbing, output guard, and audit logging all
// live server-side. The client's only job is: send the question,
// classify the response, hand it to the renderer.
//
// Failure modes are first-class — Tier-A fall-through happens at the
// AskLeiko surface, not here. tierB() never throws on a non-OK
// response; it returns a discriminated union with a status field.
// Network or invocation failures are surfaced as { status: 'error' }
// so the UI can show "couldn't reach Leiko" copy without a try/catch.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../supabase';
import { logger } from '../analytics/logger';
import type { Database } from '../../types/database';

// Mobile canonicalises the British spelling 'paediatric' (Sprint 11);
// server / D14 §11.1 canonicalise the American 'pediatric'. We
// translate at this seam so neither side has to bend (server stays
// verbatim with the spec; mobile keeps Sprint 11's existing
// DEFER_TEMPLATES key without breaking 30+ tests). All callers above
// this file see the British spelling that lines up with the rest of
// the mobile codebase.
export type TierBDeferTrigger =
  | 'medication'
  | 'symptom'
  | 'pregnancy'
  | 'paediatric'
  | 'mental_health_crisis'
  | 'generic';

const SERVER_TRIGGER_MAP: Readonly<Record<string, TierBDeferTrigger>> = {
  medication: 'medication',
  symptom: 'symptom',
  pregnancy: 'pregnancy',
  pediatric: 'paediatric',
  paediatric: 'paediatric',
  mental_health_crisis: 'mental_health_crisis',
  generic: 'generic',
};

export interface TierBOk {
  status: 'ok';
  body: string;
  tier: 'B';
  model: string;
  conversationId: string;
  messageId: string;
  guard: {
    layer1Hits: number;
    layer2MaxCosine: number;
    retries: number;
  };
}

export interface TierBDefer {
  status: 'defer';
  trigger: TierBDeferTrigger;
  reason: string;
}

export interface TierBQuotaExceeded {
  status: 'quota_exceeded';
  tier: 'B';
  remaining: 0;
  resetsAt: string;
}

export interface TierBError {
  status: 'error';
  error: string;
  detail?: string;
}

export type TierBResult = TierBOk | TierBDefer | TierBQuotaExceeded | TierBError;

export interface AskTierBInput {
  question: string;
}

function translateServerTrigger(t: unknown): TierBDeferTrigger | null {
  if (typeof t !== 'string') return null;
  return SERVER_TRIGGER_MAP[t] ?? null;
}

/**
 * Narrow whatever supabase-js gave us into our union, defending
 * against a server response that doesn't match the contract.
 */
function parseResponse(data: unknown): TierBResult {
  if (!data || typeof data !== 'object') {
    return { status: 'error', error: 'invalid_response' };
  }
  const d = data as Record<string, unknown>;
  switch (d.status) {
    case 'ok': {
      if (
        typeof d.body !== 'string' ||
        typeof d.conversationId !== 'string' ||
        typeof d.messageId !== 'string'
      ) {
        return { status: 'error', error: 'invalid_response' };
      }
      const guard = (d.guard ?? {}) as Record<string, unknown>;
      return {
        status: 'ok',
        body: d.body,
        tier: 'B',
        model: typeof d.model === 'string' ? d.model : '',
        conversationId: d.conversationId,
        messageId: d.messageId,
        guard: {
          layer1Hits: typeof guard.layer1Hits === 'number' ? guard.layer1Hits : 0,
          layer2MaxCosine:
            typeof guard.layer2MaxCosine === 'number' ? guard.layer2MaxCosine : 0,
          retries: typeof guard.retries === 'number' ? guard.retries : 0,
        },
      };
    }
    case 'defer': {
      const trigger = translateServerTrigger(d.trigger);
      if (trigger === null) {
        return { status: 'error', error: 'invalid_defer_trigger' };
      }
      return {
        status: 'defer',
        trigger,
        reason: typeof d.reason === 'string' ? d.reason : '',
      };
    }
    case 'quota_exceeded': {
      return {
        status: 'quota_exceeded',
        tier: 'B',
        remaining: 0,
        resetsAt: typeof d.resetsAt === 'string' ? d.resetsAt : '',
      };
    }
    case 'error': {
      return {
        status: 'error',
        error: typeof d.error === 'string' ? d.error : 'unknown',
        detail: typeof d.detail === 'string' ? d.detail : undefined,
      };
    }
    default:
      return { status: 'error', error: 'invalid_response' };
  }
}

// Hard client-side timeout. If supabase.functions.invoke hasn't
// returned in this window we give up so the UI never hangs on the
// "Thinking…" state forever. The Edge Function side has its own
// shorter budget, but a stuck network path between phone and Kong
// would otherwise leave the JS promise pending until the OS-level
// fetch timeout (~75–120s on Android/iOS).
const ASK_TIER_B_CLIENT_TIMEOUT_MS = 12_000;

function timeoutAfter(ms: number): Promise<never> {
  return new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('client_timeout')), ms),
  );
}

/**
 * Fire a Tier-B query. Returns a discriminated union — never throws.
 * Logs an analytics breadcrumb at start + completion (the body of the
 * response is NEVER logged per CLAUDE.md / D14 §13).
 */
export async function askTierB(
  input: AskTierBInput,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<TierBResult> {
  const trimmed = input.question.trim();
  if (trimmed.length === 0) {
    return { status: 'error', error: 'empty_question' };
  }
  if (trimmed.length > 2000) {
    return { status: 'error', error: 'question_too_long' };
  }

  logger.track('ai_tier_b_started', { length: trimmed.length });

  // Bypass supabase-js's functions.invoke — live phone testing (Sprint
  // 12 follow-up) showed identical /sync requests landing on the Edge
  // Function while ai-tier-b never arrived. Raw fetch over the same
  // adb-reverse path lands consistently. We still pull the access
  // token from the supabase auth session so the Edge Function's
  // userClient.auth.getUser() validates the same JWT it would have
  // had via invoke.
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    logger.track('ai_tier_b_failed', { reason: 'env_missing' });
    return { status: 'error', error: 'env_missing' };
  }

  let accessToken: string | null = null;
  try {
    const session = await Promise.race([
      client.auth.getSession(),
      timeoutAfter(2_000),
    ]);
    accessToken = session.data.session?.access_token ?? null;
  } catch {
    logger.track('ai_tier_b_failed', { reason: 'session_timeout' });
    return { status: 'error', error: 'session_timeout' };
  }
  if (!accessToken) {
    logger.track('ai_tier_b_failed', { reason: 'no_session' });
    return { status: 'error', error: 'no_session' };
  }

  let raw: unknown;
  try {
    const res = await Promise.race([
      fetch(`${supabaseUrl}/functions/v1/ai-tier-b`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ question: trimmed }),
      }),
      timeoutAfter(ASK_TIER_B_CLIENT_TIMEOUT_MS),
    ]);
    if (!res.ok && res.status !== 200) {
      // Non-2xx body still parses as JSON for our error responses
      // (Edge Function returns { status: 'error', error: ... }).
      try {
        raw = await res.json();
      } catch {
        logger.track('ai_tier_b_failed', { reason: `http_${res.status}` });
        return { status: 'error', error: `http_${res.status}` };
      }
    } else {
      raw = await res.json();
    }
  } catch (err) {
    const reason = (err as Error).message === 'client_timeout'
      ? 'client_timeout'
      : 'network_error';
    logger.track('ai_tier_b_failed', { reason });
    return { status: 'error', error: reason };
  }

  const parsed = parseResponse(raw);

  switch (parsed.status) {
    case 'ok':
      logger.track('ai_tier_b_ok', {
        retries: parsed.guard.retries,
        layer1_hits: parsed.guard.layer1Hits,
        // Round to 2 decimals — full precision isn't useful at the
        // analytics layer and it shows up in PostHog as a histogram.
        layer2_max_cosine: Math.round(parsed.guard.layer2MaxCosine * 100) / 100,
      });
      break;
    case 'defer':
      logger.track('ai_tier_b_defer', { trigger: parsed.trigger, reason: parsed.reason });
      break;
    case 'quota_exceeded':
      logger.track('ai_tier_b_quota_exceeded');
      break;
    case 'error':
      logger.track('ai_tier_b_failed', { reason: parsed.error });
      break;
  }
  return parsed;
}

// Test-only.
export const _internals = { parseResponse };
