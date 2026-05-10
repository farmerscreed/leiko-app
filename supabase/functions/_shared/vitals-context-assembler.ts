// supabase/functions/_shared/vitals-context-assembler.ts — Sprint 12.5.
//
// Server-side helper that builds a fully-populated ScrubbedAiContext
// for a user — pulls from public.users + public.families (identity)
// + public.readings + public.vitals_other + public.correlations
// (vitals + correlations) and runs the result through phi-scrub.
//
// Used by the ambient-AI Edge Functions:
//   - ai-daily-narration       (Sprint 12.5 session 1)
//   - ai-reading-paragraph     (session 2)
//   - compute-weekly-summary   (session 3)
//   - compute-monthly-baseline (session 3)
//   - generate-doctor-prep     (session 3)
//
// Sprint 12's `ai-tier-b` Edge Function does NOT use this — it has
// its own minimal demographics loader for the Q&A path because user
// questions don't need the vitals payload by default. The ambient
// surfaces all need vitals; that's what this assembler centralises.
//
// PHI policy:
//   - This module ALWAYS returns a ScrubbedAiContext (already scrub-
//     conformant). Callers must NOT bypass scrubAiContext.
//   - The caller still calls `assertScrubbed(ctx)` defensively before
//     serialising the context into a prompt.
//
// Classification thresholds (D13 §6 simplified):
//   For Sprint 12.5 we use coarse two-tier logic — `in_pattern` vs
//   `calm_concerned` — without the watch/act/no-data refinements.
//   Refinement is a Sprint 16 polish task; the AI prompt only cares
//   about state qualitatively.

// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  scrubAiContext,
  type AccountType,
  type ScrubbedAiContext,
  type VitalState,
} from './phi-scrub.ts';

// ── Time helpers ──────────────────────────────────────────────────────

const SECONDS_PER_DAY = 24 * 60 * 60;

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function startOfWeekSec(now: number = nowSec()): number {
  return now - 7 * SECONDS_PER_DAY;
}

function isoTime(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString();
}

// ── Classification ────────────────────────────────────────────────────

function classifyBp(systolic: number, diastolic: number): VitalState {
  // D13 §6.1 (simplified). Confirmed-urgent → 'calm_concerned' for
  // Sprint 12.5 since the AI prompt's tier-routing only needs the
  // "novel" signal — true urgency is the anomaly engine's domain
  // (Sprint 15).
  if (systolic >= 140 || diastolic >= 90) return 'calm_concerned';
  return 'in_pattern';
}

function classifyHr(restingBpm: number | null): VitalState {
  if (restingBpm === null) return 'no_data';
  if (restingBpm >= 90 || restingBpm < 50) return 'calm_concerned';
  return 'in_pattern';
}

function classifySpo2(percent: number | null): VitalState {
  if (percent === null) return 'no_data';
  if (percent < 94) return 'calm_concerned';
  return 'in_pattern';
}

function classifySleep(totalMinutes: number | null): VitalState {
  if (totalMinutes === null) return 'no_data';
  if (totalMinutes < 360) return 'calm_concerned'; // < 6h
  return 'in_pattern';
}

function classifyActivity(steps: number | null, target: number | null): VitalState {
  if (steps === null) return 'no_data';
  if (target !== null && steps < target * 0.5) return 'calm_concerned';
  return 'in_pattern';
}

// ── Loaders ───────────────────────────────────────────────────────────

interface UserIdentity {
  parentLabel: string;
  yearOfBirth: number | null;
  residenceCity: string | null;
  accountType: AccountType;
  preferredLanguage: string;
  isPlus: boolean;
}

export async function loadIdentity(
  serviceClient: SupabaseClient,
  userId: string,
  familyId: string,
): Promise<UserIdentity | { error: string }> {
  const { data: userRow, error: userErr } = await serviceClient
    .from('users')
    .select('account_type, preferred_language, display_name, year_of_birth')
    .eq('id', userId)
    .maybeSingle();
  if (userErr || !userRow) return { error: 'user_not_found' };

  const { data: family, error: familyErr } = await serviceClient
    .from('families')
    .select('parent_display_name, parent_year_of_birth, parent_residence, subscription_status')
    .eq('id', familyId)
    .maybeSingle();
  if (familyErr || !family) return { error: 'family_not_found' };

  const accountType = userRow.account_type as AccountType;
  const isPlus =
    family.subscription_status === 'plus' ||
    family.subscription_status === 'plus_trial' ||
    family.subscription_status === 'plus_grace';

  let parentLabel: string;
  let yearOfBirth: number | null;
  let residenceCity: string | null;
  if (accountType === 'caregiver') {
    parentLabel = (family.parent_display_name as string) || 'your parent';
    yearOfBirth = (family.parent_year_of_birth as number | null) ?? null;
    residenceCity = (family.parent_residence as string | null) ?? null;
  } else {
    parentLabel = (userRow.display_name as string) || 'you';
    yearOfBirth = (userRow.year_of_birth as number | null) ?? null;
    residenceCity = null;
  }

  return {
    parentLabel,
    yearOfBirth,
    residenceCity,
    accountType,
    preferredLanguage: (userRow.preferred_language as string) || 'en',
    isPlus,
  };
}

interface BpAggregate {
  latestSystolic: number;
  latestDiastolic: number;
  latestPulse: number | null;
  latestMeasuredAtSec: number;
  weekAverageSystolic: number | null;
  weekAverageDiastolic: number | null;
  state: VitalState;
}

async function loadBp(
  serviceClient: SupabaseClient,
  familyId: string,
): Promise<BpAggregate | null> {
  // Latest BP across the family (covers self-buyer + parent surfaces).
  const { data: latest } = await serviceClient
    .from('readings')
    .select('systolic, diastolic, pulse, measured_at')
    .eq('family_id', familyId)
    .eq('hidden', false)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return null;

  const sinceIso = isoTime(startOfWeekSec());
  const { data: week } = await serviceClient
    .from('readings')
    .select('systolic, diastolic')
    .eq('family_id', familyId)
    .eq('hidden', false)
    .gte('measured_at', sinceIso);

  let weekAvgSys: number | null = null;
  let weekAvgDia: number | null = null;
  if (week && week.length > 0) {
    weekAvgSys = Math.round(
      week.reduce((a: number, r: any) => a + (r.systolic as number), 0) / week.length,
    );
    weekAvgDia = Math.round(
      week.reduce((a: number, r: any) => a + (r.diastolic as number), 0) / week.length,
    );
  }

  return {
    latestSystolic: latest.systolic as number,
    latestDiastolic: latest.diastolic as number,
    latestPulse: (latest.pulse as number | null) ?? null,
    latestMeasuredAtSec: Math.floor(new Date(latest.measured_at as string).getTime() / 1000),
    weekAverageSystolic: weekAvgSys,
    weekAverageDiastolic: weekAvgDia,
    state: classifyBp(latest.systolic as number, latest.diastolic as number),
  };
}

interface HrAggregate {
  restingToday: number | null;
  baseline: number | null;
  state: VitalState;
}

async function loadHr(
  serviceClient: SupabaseClient,
  familyId: string,
): Promise<HrAggregate | null> {
  // vital_type='hr' rows in vitals_other carry one BPM per measured_at
  // in value_int per D13 §2.2.
  const sinceIso = isoTime(startOfWeekSec());
  const { data: rows } = await serviceClient
    .from('vitals_other')
    .select('value_int, measured_at')
    .eq('family_id', familyId)
    .eq('vital_type', 'hr')
    .eq('hidden', false)
    .gte('measured_at', sinceIso)
    .order('measured_at', { ascending: false });
  if (!rows || rows.length === 0) return null;

  // Today's "resting" — the lowest HR observation in the most-recent
  // 24h. Coarse approximation pending a real motionState filter.
  const todayCutoffIso = isoTime(nowSec() - SECONDS_PER_DAY);
  const todays = rows.filter((r: any) => r.measured_at >= todayCutoffIso);
  let resting: number | null = null;
  if (todays.length > 0) {
    resting = Math.min(...todays.map((r: any) => r.value_int as number));
  }
  const baseline = Math.round(
    rows.reduce((a: number, r: any) => a + (r.value_int as number), 0) / rows.length,
  );
  return {
    restingToday: resting,
    baseline,
    state: classifyHr(resting),
  };
}

interface Spo2Aggregate {
  latest: number | null;
  overnightLow: number | null;
  state: VitalState;
}

async function loadSpo2(
  serviceClient: SupabaseClient,
  familyId: string,
): Promise<Spo2Aggregate | null> {
  const sinceIso = isoTime(startOfWeekSec());
  const { data: rows } = await serviceClient
    .from('vitals_other')
    .select('value_int, measured_at')
    .eq('family_id', familyId)
    .eq('vital_type', 'spo2')
    .eq('hidden', false)
    .gte('measured_at', sinceIso)
    .order('measured_at', { ascending: false });
  if (!rows || rows.length === 0) return null;

  const latest = (rows[0] as any).value_int as number;
  const overnightLow = Math.min(...rows.map((r: any) => r.value_int as number));
  return {
    latest,
    overnightLow,
    state: classifySpo2(latest),
  };
}

interface SleepAggregate {
  lastNightTotalMinutes: number | null;
  score: number | null;
  state: VitalState;
}

async function loadSleep(
  serviceClient: SupabaseClient,
  familyId: string,
): Promise<SleepAggregate | null> {
  // sleep_session rows in vitals_other use:
  //   value_int   = total minutes
  //   value_int_2 = sleep score 0..100
  //   value_jsonb = stage breakdown (deep/rem/light/awake minutes)
  const { data: latest } = await serviceClient
    .from('vitals_other')
    .select('value_int, value_int_2, measured_at')
    .eq('family_id', familyId)
    .eq('vital_type', 'sleep_session')
    .eq('hidden', false)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return null;
  const totalMinutes = (latest.value_int as number | null) ?? null;
  const score = (latest.value_int_2 as number | null) ?? null;
  return {
    lastNightTotalMinutes: totalMinutes,
    score,
    state: classifySleep(totalMinutes),
  };
}

interface ActivityAggregate {
  todaySteps: number | null;
  targetSteps: number | null;
  state: VitalState;
}

async function loadActivity(
  serviceClient: SupabaseClient,
  familyId: string,
): Promise<ActivityAggregate | null> {
  // steps_day rows use:
  //   value_int   = total steps
  //   value_int_2 = target steps (or null if not set)
  const { data: latest } = await serviceClient
    .from('vitals_other')
    .select('value_int, value_int_2, measured_at')
    .eq('family_id', familyId)
    .eq('vital_type', 'steps_day')
    .eq('hidden', false)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return null;
  const todaySteps = (latest.value_int as number | null) ?? null;
  const targetSteps = (latest.value_int_2 as number | null) ?? null;
  return {
    todaySteps,
    targetSteps,
    state: classifyActivity(todaySteps, targetSteps),
  };
}

interface CorrelationRow {
  leftVital: 'bp' | 'hr' | 'spo2' | 'sleep' | 'activity';
  rightVital: 'bp' | 'hr' | 'spo2' | 'sleep' | 'activity';
  coefficient: number;
  meaningful: boolean;
}

const CORRELATION_VITAL_MAP: Record<string, [CorrelationRow['leftVital'], CorrelationRow['rightVital']]> = {
  sleep_x_morning_bp: ['sleep', 'bp'],
  activity_x_resting_hr: ['activity', 'hr'],
  spo2_dip_x_sleep_score: ['spo2', 'sleep'],
};

async function loadCorrelations(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<CorrelationRow[]> {
  const { data: rows } = await serviceClient
    .from('correlations')
    .select('correlation_type, pearson_r, is_meaningful, computed_at')
    .eq('user_id', userId)
    .eq('is_meaningful', true)
    .order('computed_at', { ascending: false })
    .limit(3);
  if (!rows || rows.length === 0) return [];
  const out: CorrelationRow[] = [];
  for (const r of rows as any[]) {
    const map = CORRELATION_VITAL_MAP[r.correlation_type as string];
    if (!map) continue;
    out.push({
      leftVital: map[0],
      rightVital: map[1],
      coefficient: (r.pearson_r as number) ?? 0,
      meaningful: true,
    });
  }
  return out;
}

// ── Top-level ──────────────────────────────────────────────────────────

export interface AssembleOptions {
  /**
   * When false (default while BAA pending), strip yearOfBirth +
   * residenceCity from the assembled context. Matches the Sprint 12
   * AI_TIER_B_PROD_DATA_ENABLED flag semantics.
   */
  allowProdData?: boolean;
}

export interface AssembledContext {
  identity: UserIdentity;
  context: ScrubbedAiContext;
}

/**
 * Build a ScrubbedAiContext for the given user. Loads identity +
 * vitals + correlations in parallel, runs through scrubAiContext
 * (which whitelists the per-vital fields), and returns both the
 * scrubbed context and the identity (the caller often needs
 * isPlus / preferredLanguage too).
 */
export async function assembleAiContext(
  serviceClient: SupabaseClient,
  userId: string,
  familyId: string,
  options: AssembleOptions = {},
): Promise<AssembledContext | { error: string }> {
  const allowProdData = options.allowProdData === true;

  const idResult = await loadIdentity(serviceClient, userId, familyId);
  if ('error' in idResult) return { error: idResult.error };
  const identity = idResult;

  const [bp, hr, spo2, sleep, activity, correlations] = await Promise.all([
    loadBp(serviceClient, familyId),
    loadHr(serviceClient, familyId),
    loadSpo2(serviceClient, familyId),
    loadSleep(serviceClient, familyId),
    loadActivity(serviceClient, familyId),
    loadCorrelations(serviceClient, userId),
  ]);

  const raw: Record<string, unknown> = {
    parentLabel: identity.parentLabel,
    yearOfBirth: allowProdData ? identity.yearOfBirth : null,
    residenceCity: allowProdData ? identity.residenceCity : null,
    accountType: identity.accountType,
  };
  if (bp) raw.bp = bp;
  if (hr) raw.hr = hr;
  if (spo2) raw.spo2 = spo2;
  if (sleep) raw.sleep = sleep;
  if (activity) raw.activity = activity;
  if (correlations.length > 0) raw.correlations = correlations;

  const scrubbed = scrubAiContext(raw);
  return { identity, context: scrubbed };
}
