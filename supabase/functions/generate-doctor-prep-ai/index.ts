// supabase/functions/generate-doctor-prep-ai/index.ts — Sprint 12.5.
//
// Tier-B cover + Tier-C observations for the doctor-prep PDF
// (D14 §8). Plus-only at v1.0 per D8a §15 default; free users get
// a paywall_required response which the mobile flow surfaces via
// the existing Sprint 10a paywall host.
//
// This function is the AI-section generator only — Sprint 9's
// generate-doctor-pdf renders the actual PDF. Integration: mobile
// calls this first (if isPlus), takes the cover + observations
// strings, and feeds them into the PDF template's AI slots when
// generating.
//
// Flow:
//   1. JWT validate, family lookup.
//   2. isPlus check (subscription_status). Free → paywall_required.
//   3. Cover: Tier-B Haiku 4.5 (clinical-but-not-pathologising tone
//      per D14 §8.2). 2–3 sentences.
//   4. Observations: prefer the cached monthly_baseline if it's
//      ≤7 days old (D14 §8.3); otherwise fall back to a Tier-B
//      generation.
//   5. Output guard layers + audit log + cache to ai_narration_cache
//      under doctor_prep_cover / doctor_prep_observations surfaces.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { assembleAiContext } from '../_shared/vitals-context-assembler.ts';
import {
  buildSystemPrompt,
  SYSTEM_PROMPT_VERSION,
} from '../_shared/system-prompt.ts';
import {
  scanLayer1,
  buildLayer1RetryAugment,
} from '../_shared/output-guard/layer1-regex.ts';
import {
  scanLayer2,
  buildLayer2RetryAugment,
  LAYER2_THRESHOLD,
} from '../_shared/output-guard/layer2-cosine.ts';
import { createSupabaseEmbedder } from '../_shared/output-guard/embedder.ts';
import {
  assertScrubbed,
  type ScrubbedAiContext,
} from '../_shared/phi-scrub.ts';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_VERSION = '2023-06-01';
const COVER_MAX_TOKENS = 200;
const OBSERVATIONS_MAX_TOKENS = 600;
const REQUEST_TIMEOUT_MS = 30_000;
const LAYER2_TIMEOUT_MS = 3_000;
const MONTHLY_BASELINE_FRESHNESS_DAYS = 7;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}: timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

// ── Prompt builders ───────────────────────────────────────────────────

export function buildCoverPrompt(
  context: ScrubbedAiContext,
  startDate: string,
  endDate: string,
): string {
  const lines: string[] = [];
  lines.push('Generate a clinical-tone cover paragraph for a doctor-share PDF.');
  lines.push('');
  // D14 §8.2: doctor-prep audience is a clinician; we use the
  // formal label but still avoid "patient".
  lines.push(`Subject label: ${context.parentLabel}`);
  lines.push(`Date range: ${startDate} to ${endDate}`);
  if (context.bp) {
    lines.push(`BP — latest ${context.bp.latestSystolic}/${context.bp.latestDiastolic}, week avg ${context.bp.weekAverageSystolic ?? '?'}/${context.bp.weekAverageDiastolic ?? '?'}, state ${context.bp.state}`);
  }
  if (context.hr) lines.push(`HR — resting baseline ${context.hr.baseline ?? '?'}`);
  if (context.spo2) lines.push(`SpO2 — overnight low ${context.spo2.overnightLow ?? '?'}, latest ${context.spo2.latest ?? '?'}`);
  if (context.sleep) lines.push(`Sleep — latest total ${context.sleep.lastNightTotalMinutes ?? '?'}min`);
  if (context.activity) lines.push(`Activity — recent steps ${context.activity.todaySteps ?? '?'}`);
  lines.push('');
  lines.push('Constraints:');
  lines.push('- 2 to 3 sentences.');
  lines.push('- Clinical but not pathologising. Factual.');
  lines.push('- Audience is a clinician — clinical terms (systolic, diastolic, etc.) are permitted.');
  lines.push('- Do NOT diagnose. Describe data only.');
  lines.push('- Do NOT prescribe or recommend changes.');
  lines.push(`- Use "${context.parentLabel}" — never "patient".`);
  lines.push('- Sentence-case. No exclamation points.');
  return `<user_query>\n${lines.join('\n')}\n</user_query>`;
}

export function buildObservationsPrompt(
  context: ScrubbedAiContext,
  startDate: string,
  endDate: string,
): string {
  const lines: string[] = [];
  lines.push('Generate a 1–2 paragraph cross-vital observations section for a doctor-share PDF.');
  lines.push('');
  lines.push(`Subject label: ${context.parentLabel}`);
  lines.push(`Date range: ${startDate} to ${endDate}`);
  if (context.bp) lines.push(`BP context: ${context.bp.state}, week avg ${context.bp.weekAverageSystolic ?? '?'}/${context.bp.weekAverageDiastolic ?? '?'}`);
  if (context.hr) lines.push(`HR context: resting baseline ${context.hr.baseline ?? '?'}`);
  if (context.sleep) lines.push(`Sleep context: latest ${context.sleep.lastNightTotalMinutes ?? '?'}min`);
  if (context.correlations && context.correlations.length > 0) {
    lines.push('Cross-vital correlations:');
    for (const c of context.correlations) {
      lines.push(`  ${c.leftVital} ↔ ${c.rightVital}: r=${c.coefficient.toFixed(2)}`);
    }
  }
  lines.push('');
  lines.push('Constraints:');
  lines.push('- 1 to 2 short paragraphs.');
  lines.push('- Clinical-tone permitted; no diagnosis.');
  lines.push('- Describe cross-vital patterns the clinician may want to investigate.');
  lines.push('- Never prescribe; never claim outcomes.');
  return `<user_query>\n${lines.join('\n')}\n</user_query>`;
}

// ── Anthropic ──────────────────────────────────────────────────────────

async function callAnthropic(opts: {
  model: string;
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
  apiKey: string;
  baseUrl: string;
  signal: AbortSignal;
}): Promise<{ body: string; promptTokens: number; completionTokens: number } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(`${opts.baseUrl}/v1/messages`, {
      method: 'POST',
      signal: opts.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.systemPrompt,
        messages: [{ role: 'user', content: opts.userPrompt }],
      }),
    });
  } catch (err) {
    return { error: 'anthropic_fetch_failed: ' + (err as Error).message };
  }
  if (!res.ok) return { error: `anthropic_http_${res.status}` };
  const out = (await res.json()) as any;
  return {
    body: ((out.content?.[0]?.text as string | undefined) ?? '').trim(),
    promptTokens: out.usage?.input_tokens ?? 0,
    completionTokens: out.usage?.output_tokens ?? 0,
  };
}

// ── Generator with guard ───────────────────────────────────────────────

async function generateWithGuard(opts: {
  serviceClient: SupabaseClient;
  userId: string;
  familyId: string;
  surface: 'doctor_prep_cover' | 'doctor_prep_observations';
  scopeKey: string;
  model: string;
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
  apiKey: string;
  baseUrl: string;
  signal: AbortSignal;
}): Promise<{ body: string } | { error: string }> {
  const firstCall = await callAnthropic({
    model: opts.model, maxTokens: opts.maxTokens,
    systemPrompt: opts.systemPrompt, userPrompt: opts.userPrompt,
    apiKey: opts.apiKey, baseUrl: opts.baseUrl, signal: opts.signal,
  });
  if ('error' in firstCall) return { error: firstCall.error };
  let candidate = firstCall.body;
  let promptTokens = firstCall.promptTokens;
  let completionTokens = firstCall.completionTokens;
  let layer2Cosine = 0;

  const layer1 = scanLayer1(candidate);
  if (!layer1.passes) {
    const retryCall = await callAnthropic({
      model: opts.model, maxTokens: opts.maxTokens,
      systemPrompt: opts.systemPrompt,
      userPrompt: `${buildLayer1RetryAugment(layer1.hits)}\n\n${opts.userPrompt}`,
      apiKey: opts.apiKey, baseUrl: opts.baseUrl, signal: opts.signal,
    });
    if ('error' in retryCall) return { error: retryCall.error };
    candidate = retryCall.body;
    promptTokens += retryCall.promptTokens;
    completionTokens += retryCall.completionTokens;
    if (!scanLayer1(candidate).passes) return { error: 'layer1_double_hit' };
  }

  let embedder;
  try { embedder = createSupabaseEmbedder(); } catch { embedder = null; }
  if (embedder) {
    let layer2;
    try { layer2 = await withTimeout(scanLayer2(candidate, embedder), LAYER2_TIMEOUT_MS, 'layer2'); }
    catch { layer2 = null; }
    if (layer2) layer2Cosine = layer2.maxCosine;
    if (layer2 && !layer2.passes) {
      const retryCall = await callAnthropic({
        model: opts.model, maxTokens: opts.maxTokens,
        systemPrompt: opts.systemPrompt,
        userPrompt: `${buildLayer2RetryAugment(layer2.matchedPhrase)}\n\n${opts.userPrompt}`,
        apiKey: opts.apiKey, baseUrl: opts.baseUrl, signal: opts.signal,
      });
      if ('error' in retryCall) return { error: retryCall.error };
      candidate = retryCall.body;
      promptTokens += retryCall.promptTokens;
      completionTokens += retryCall.completionTokens;
    }
  }

  const flagged = !layer1.passes || layer2Cosine >= LAYER2_THRESHOLD;
  await opts.serviceClient.from('ai_narration_cache').upsert({
    user_id: opts.userId, family_id: opts.familyId,
    surface: opts.surface, scope_key: opts.scopeKey,
    body: candidate, tier: opts.model === SONNET_MODEL ? 'C' : 'B',
    model: opts.model,
    prompt_tokens: promptTokens, completion_tokens: completionTokens,
    flagged, generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,surface,scope_key' });

  await opts.serviceClient.from('audit_log').insert({
    actor_user_id: opts.userId, family_id: opts.familyId,
    action: 'ai.doctor_prep',
    metadata: {
      tier: opts.model === SONNET_MODEL ? 'C' : 'B',
      model: opts.model, surface: opts.surface,
      prompt_tokens: promptTokens, completion_tokens: completionTokens,
      layer2_max_cosine: layer2Cosine,
      prompt_version: SYSTEM_PROMPT_VERSION,
      scope_key: opts.scopeKey,
    },
  });

  return { body: candidate };
}

// ── Handler ────────────────────────────────────────────────────────────

interface RequestBody {
  exportId: string; // PDF export id used as scope_key
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ status: 'error', error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ status: 'error', error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return json({ status: 'error', error: 'service_unavailable' }, 503);
  const baseUrl = Deno.env.get('LITELLM_BASE_URL') || 'https://api.anthropic.com';
  const allowProdData = Deno.env.get('AI_TIER_B_PROD_DATA_ENABLED') === 'true';
  const tierCEnabled = Deno.env.get('AI_TIER_C_PROD_DATA_ENABLED') === 'true';

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ status: 'error', error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  const serviceClient = createClient(supabaseUrl, serviceKey);

  let body: RequestBody;
  try {
    const parsed = (await req.json()) as Partial<RequestBody>;
    if (typeof parsed.exportId !== 'string' || !parsed.exportId ||
        typeof parsed.startDate !== 'string' || typeof parsed.endDate !== 'string') {
      return json({ status: 'error', error: 'invalid_body' }, 400);
    }
    body = { exportId: parsed.exportId, startDate: parsed.startDate, endDate: parsed.endDate };
  } catch {
    return json({ status: 'error', error: 'invalid_json' }, 400);
  }

  const { data: membership } = await serviceClient
    .from('family_members').select('family_id')
    .eq('user_id', userId).is('removed_at', null).limit(1).maybeSingle();
  if (!membership) return json({ status: 'error', error: 'no_family' }, 400);
  const familyId = membership.family_id as string;

  // Plus-only gate (D14 §8.4 / D8a §15).
  const { data: family } = await serviceClient
    .from('families').select('subscription_status').eq('id', familyId).maybeSingle();
  const isPlus = ['plus', 'plus_trial', 'plus_grace'].includes(
    (family?.subscription_status as string) ?? 'free',
  );
  if (!isPlus) {
    return json({ status: 'paywall_required', tier: 'plus' }, 200);
  }

  // Assemble + scrub.
  const assembled = await assembleAiContext(serviceClient, userId, familyId, { allowProdData });
  if ('error' in assembled) return json({ status: 'error', error: assembled.error }, 400);
  const { identity, context } = assembled;
  try { assertScrubbed(context); } catch (e) {
    return json({ status: 'error', error: 'scrub_failed', detail: (e as Error).message }, 500);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const systemPrompt = buildSystemPrompt({ allowedCardIds: '', userLanguage: identity.preferredLanguage });

  // Cover (Tier-B Haiku — fast).
  const cover = await generateWithGuard({
    serviceClient, userId, familyId,
    surface: 'doctor_prep_cover', scopeKey: body.exportId,
    model: HAIKU_MODEL, maxTokens: COVER_MAX_TOKENS,
    systemPrompt, userPrompt: buildCoverPrompt(context, body.startDate, body.endDate),
    apiKey: anthropicKey, baseUrl, signal: controller.signal,
  });
  if ('error' in cover) {
    clearTimeout(timeout);
    return json({ status: 'error', error: cover.error, stage: 'cover' }, 502);
  }

  // Observations: prefer cached monthly_baseline if recent enough.
  let observationsBody: string | null = null;
  const { data: monthly } = await serviceClient
    .from('ai_narration_cache')
    .select('body, generated_at')
    .eq('user_id', userId).eq('surface', 'monthly_baseline')
    .order('generated_at', { ascending: false }).limit(1).maybeSingle();
  if (monthly) {
    const ageDays = (Date.now() - new Date(monthly.generated_at as string).getTime()) /
      (24 * 60 * 60 * 1000);
    if (ageDays <= MONTHLY_BASELINE_FRESHNESS_DAYS) {
      observationsBody = monthly.body as string;
    }
  }

  if (observationsBody === null) {
    // Fall back to Tier-B observations gen. Tier-C gated by env.
    const obs = await generateWithGuard({
      serviceClient, userId, familyId,
      surface: 'doctor_prep_observations', scopeKey: body.exportId,
      model: tierCEnabled ? SONNET_MODEL : HAIKU_MODEL,
      maxTokens: OBSERVATIONS_MAX_TOKENS,
      systemPrompt, userPrompt: buildObservationsPrompt(context, body.startDate, body.endDate),
      apiKey: anthropicKey, baseUrl, signal: controller.signal,
    });
    if ('error' in obs) {
      clearTimeout(timeout);
      return json({ status: 'error', error: obs.error, stage: 'observations' }, 502);
    }
    observationsBody = obs.body;
  }

  clearTimeout(timeout);

  return json({
    status: 'ok',
    cover: cover.body,
    observations: observationsBody,
    exportId: body.exportId,
  }, 200);
});
