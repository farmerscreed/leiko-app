// supabase/functions/_shared/phi-scrub.ts — Sprint 12.
//
// Server-side PHI scrubber. Runs in the ai-tier-b Edge Function (Deno
// runtime) immediately before any payload is forwarded to the LiteLLM
// gateway / Anthropic API.
//
// Scope vs the mobile-side scrubber (apps/mobile/src/utils/phi-scrub.ts,
// Sprint 7.5): the mobile one strips raw watch-sync MultiVitalsPayload
// for AI/analytics egress. THIS one is the gate at the actual LLM call
// site — it accepts an AiVitalsContext that the Edge Function has
// already assembled from the request body + Postgres queries.
//
// We scrub server-side AGAIN because:
//   1. Mobile client could be compromised, mocked, or lying about which
//      fields it sent.
//   2. The server adds context the client didn't send (parent_label
//      from public.families, year_of_birth from public.users), so the
//      assembled object has a different shape than what mobile sent
//      and needs its own gate.
//   3. CLAUDE.md "Data rules" + D14 §13 require a single auditable
//      egress boundary; this file is that boundary.
//
// Per D14 §13:
//   Allowed in Tier B/C payload (whitelist):
//     - First names / parent label
//     - Year of birth
//     - Residence city
//     - Account type
//     - Reading values (BP, HR, SpO2, sleep, activity)
//     - Aggregate metrics (averages, baselines, trends)
//     - Quantised timestamps (day-level, never sample-second)
//     - Classification states ("in-pattern," etc.)
//     - Correlation coefficients (rounded to 2 decimals)
//
//   Stripped before egress (banned keys, defensive guard):
//     - Email, phone, full names, last names
//     - MAC, device serial, firmware version
//     - IP, user agent, geolocation precision beyond city
//     - Sample-precision timestamps (quantised to day)
//     - Sensor confidence values (perfusion index, motion state)
//
// Egress without scrubbing fails CI lint per docs/00-tech-stack.md.

const SECONDS_PER_DAY = 24 * 60 * 60;

export type AccountType = "caregiver" | "self_buyer" | "parent";
export type VitalState =
  | "in_pattern"
  | "calm_concerned"
  | "watch"
  | "act"
  | "no_data";

/** Quantise a unix-second timestamp down to start-of-UTC-day. */
export function quantiseToDay(unixSec: number): number {
  if (!Number.isFinite(unixSec)) {
    throw new Error("phi-scrub: quantiseToDay received non-finite seconds");
  }
  return Math.floor(unixSec / SECONDS_PER_DAY) * SECONDS_PER_DAY;
}

/** Round a correlation coefficient to 2 decimals per D14 §13.1. */
function roundCorrelation(r: number): number {
  if (!Number.isFinite(r)) {
    throw new Error("phi-scrub: roundCorrelation received non-finite r");
  }
  return Math.round(r * 100) / 100;
}

// ---------------------------------------------------------------------------
// Per-vital scrubbed shapes — mirror D14 §3.4 / §6.3 / §11 prompt slots.
// Only what the model needs to produce voice-compliant narration.
// ---------------------------------------------------------------------------

export interface ScrubbedBp {
  latestSystolic: number;
  latestDiastolic: number;
  latestPulse: number | null;
  /** Day-quantised — sample-second precision is banned. */
  latestMeasuredAtDayUtcSec: number;
  weekAverageSystolic: number | null;
  weekAverageDiastolic: number | null;
  state: VitalState;
}

export interface ScrubbedHr {
  restingToday: number | null;
  baseline: number | null;
  state: VitalState;
}

export interface ScrubbedSpo2 {
  latest: number | null;
  overnightLow: number | null;
  state: VitalState;
}

export interface ScrubbedSleep {
  /** Total minutes last night. */
  lastNightTotalMinutes: number | null;
  score: number | null;
  state: VitalState;
}

export interface ScrubbedActivity {
  todaySteps: number | null;
  targetSteps: number | null;
  state: VitalState;
}

export interface ScrubbedCorrelation {
  leftVital: "bp" | "hr" | "spo2" | "sleep" | "activity";
  rightVital: "bp" | "hr" | "spo2" | "sleep" | "activity";
  /** Rounded to 2 decimals per D14 §13.1. */
  coefficient: number;
  meaningful: boolean;
}

/**
 * The full AI prompt context — what the Edge Function builds from the
 * user's request + Postgres lookups, then scrubs, then passes to the
 * prompt builder.
 *
 * The scrubber GUARANTEES every field on this shape is allowed-list per
 * D14 §13.1. Anything not on this shape never reaches the LLM.
 */
export interface ScrubbedAiContext {
  /** First name, "Mum"/"Dad", or the user's chosen parent label. */
  parentLabel: string;
  /** Whole-year only. Never a full DOB. */
  yearOfBirth: number | null;
  /** City-level granularity max. Never street / coords / IP geo. */
  residenceCity: string | null;
  accountType: AccountType;
  bp?: ScrubbedBp;
  hr?: ScrubbedHr;
  spo2?: ScrubbedSpo2;
  sleep?: ScrubbedSleep;
  activity?: ScrubbedActivity;
  correlations?: ScrubbedCorrelation[];
}

// ---------------------------------------------------------------------------
// Banned-key inventory. Used by the defensive `assertScrubbed` guard the
// Edge Function calls right before serialising into the prompt. If any
// of these keys are present on the scrubbed object, we throw — better
// to fail the request than to ship PHI.
// ---------------------------------------------------------------------------

const BANNED_KEYS_TOP_LEVEL = [
  "email",
  "phone",
  "phoneNumber",
  "fullName",
  "lastName",
  "firstName", // we use parentLabel only
  "ip",
  "ipAddress",
  "userAgent",
  "macAddress",
  "deviceSerial",
  "deviceId",
  "firmwareVersion",
  "geo",
  "geolocation",
  "lat",
  "lng",
  "latitude",
  "longitude",
  "address",
  "streetAddress",
  "postalCode",
  "zip",
  "device",
  "deviceMeta",
];

const BANNED_KEYS_PER_VITAL = [
  "perfusionIndex",
  "motionState",
  "sampleWindowSec",
  "isSpotCheck",
  "rawSamples",
  "samples",
  "deviceSerial",
  "macAddress",
  "sessionStartLocal",
  "sessionEndLocal",
];

// ---------------------------------------------------------------------------
// Field-level scrubbers. Each takes loose unknown input and returns the
// canonical shape OR throws if the input is structurally invalid.
//
// The pattern is "whitelist + transform" — we read the fields we want,
// drop everything else by construction. This is safer than a "blacklist
// + delete" approach because new field additions upstream don't leak
// silently.
// ---------------------------------------------------------------------------

function asNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function asState(v: unknown): VitalState {
  if (
    v === "in_pattern" ||
    v === "calm_concerned" ||
    v === "watch" ||
    v === "act" ||
    v === "no_data"
  ) {
    return v;
  }
  return "no_data";
}

export function scrubBp(input: unknown): ScrubbedBp {
  if (input === null || typeof input !== "object") {
    throw new Error("phi-scrub: scrubBp received non-object");
  }
  const r = input as Record<string, unknown>;
  const sys = asNumberOrNull(r.latestSystolic);
  const dia = asNumberOrNull(r.latestDiastolic);
  const measuredAt = asNumberOrNull(r.latestMeasuredAtSec);
  if (sys === null || dia === null || measuredAt === null) {
    throw new Error(
      "phi-scrub: scrubBp requires latestSystolic, latestDiastolic, latestMeasuredAtSec"
    );
  }
  return {
    latestSystolic: sys,
    latestDiastolic: dia,
    latestPulse: asNumberOrNull(r.latestPulse),
    latestMeasuredAtDayUtcSec: quantiseToDay(measuredAt),
    weekAverageSystolic: asNumberOrNull(r.weekAverageSystolic),
    weekAverageDiastolic: asNumberOrNull(r.weekAverageDiastolic),
    state: asState(r.state),
  };
}

export function scrubHr(input: unknown): ScrubbedHr {
  if (input === null || typeof input !== "object") {
    throw new Error("phi-scrub: scrubHr received non-object");
  }
  const r = input as Record<string, unknown>;
  return {
    restingToday: asNumberOrNull(r.restingToday),
    baseline: asNumberOrNull(r.baseline),
    state: asState(r.state),
  };
}

export function scrubSpo2(input: unknown): ScrubbedSpo2 {
  if (input === null || typeof input !== "object") {
    throw new Error("phi-scrub: scrubSpo2 received non-object");
  }
  const r = input as Record<string, unknown>;
  return {
    latest: asNumberOrNull(r.latest),
    overnightLow: asNumberOrNull(r.overnightLow),
    state: asState(r.state),
  };
}

export function scrubSleep(input: unknown): ScrubbedSleep {
  if (input === null || typeof input !== "object") {
    throw new Error("phi-scrub: scrubSleep received non-object");
  }
  const r = input as Record<string, unknown>;
  return {
    lastNightTotalMinutes: asNumberOrNull(r.lastNightTotalMinutes),
    score: asNumberOrNull(r.score),
    state: asState(r.state),
  };
}

export function scrubActivity(input: unknown): ScrubbedActivity {
  if (input === null || typeof input !== "object") {
    throw new Error("phi-scrub: scrubActivity received non-object");
  }
  const r = input as Record<string, unknown>;
  return {
    todaySteps: asNumberOrNull(r.todaySteps),
    targetSteps: asNumberOrNull(r.targetSteps),
    state: asState(r.state),
  };
}

export function scrubCorrelation(input: unknown): ScrubbedCorrelation {
  if (input === null || typeof input !== "object") {
    throw new Error("phi-scrub: scrubCorrelation received non-object");
  }
  const r = input as Record<string, unknown>;
  const allowed = ["bp", "hr", "spo2", "sleep", "activity"] as const;
  if (!allowed.includes(r.leftVital as (typeof allowed)[number])) {
    throw new Error(`phi-scrub: scrubCorrelation invalid leftVital: ${String(r.leftVital)}`);
  }
  if (!allowed.includes(r.rightVital as (typeof allowed)[number])) {
    throw new Error(`phi-scrub: scrubCorrelation invalid rightVital: ${String(r.rightVital)}`);
  }
  const coef = asNumberOrNull(r.coefficient);
  if (coef === null) {
    throw new Error("phi-scrub: scrubCorrelation requires coefficient");
  }
  return {
    leftVital: r.leftVital as ScrubbedCorrelation["leftVital"],
    rightVital: r.rightVital as ScrubbedCorrelation["rightVital"],
    coefficient: roundCorrelation(coef),
    meaningful: r.meaningful === true,
  };
}

// ---------------------------------------------------------------------------
// Top-level entry point.
// ---------------------------------------------------------------------------

/**
 * Scrub an arbitrary AI-context-shaped object into a `ScrubbedAiContext`
 * suitable for Tier-B/C egress per D14 §13.
 *
 * Required fields: parentLabel, accountType. yearOfBirth and
 * residenceCity may be null. Per-vital sub-objects are optional —
 * include the vitals you want the LLM to know about.
 *
 * Throws on structural failures. Silently drops any field not on the
 * whitelist (whitelist-by-construction).
 */
export function scrubAiContext(input: unknown): ScrubbedAiContext {
  if (input === null || typeof input !== "object") {
    throw new Error("phi-scrub: scrubAiContext received non-object");
  }
  const r = input as Record<string, unknown>;

  const parentLabel = r.parentLabel;
  if (typeof parentLabel !== "string" || parentLabel.length === 0) {
    throw new Error("phi-scrub: scrubAiContext requires parentLabel");
  }
  const accountType = r.accountType;
  if (
    accountType !== "caregiver" &&
    accountType !== "self_buyer" &&
    accountType !== "parent"
  ) {
    throw new Error(
      `phi-scrub: scrubAiContext invalid accountType: ${String(accountType)}`
    );
  }

  const out: ScrubbedAiContext = {
    parentLabel,
    yearOfBirth: asNumberOrNull(r.yearOfBirth),
    residenceCity:
      typeof r.residenceCity === "string" && r.residenceCity.length > 0
        ? r.residenceCity
        : null,
    accountType,
  };

  if (r.bp !== undefined && r.bp !== null) out.bp = scrubBp(r.bp);
  if (r.hr !== undefined && r.hr !== null) out.hr = scrubHr(r.hr);
  if (r.spo2 !== undefined && r.spo2 !== null) out.spo2 = scrubSpo2(r.spo2);
  if (r.sleep !== undefined && r.sleep !== null) out.sleep = scrubSleep(r.sleep);
  if (r.activity !== undefined && r.activity !== null) {
    out.activity = scrubActivity(r.activity);
  }
  if (Array.isArray(r.correlations)) {
    out.correlations = r.correlations.map(scrubCorrelation);
  }

  return out;
}

/**
 * Defensive guard. Throws if any banned key is present on the supplied
 * object (top-level or any nested vital). Edge Function calls this on
 * the OUTPUT of `scrubAiContext` right before serialising into the
 * prompt — guarantees PHI cannot reach the LLM even if a refactor
 * silently widens the whitelist.
 */
export function assertScrubbed(value: ScrubbedAiContext): void {
  const violations: string[] = [];
  const top = value as unknown as Record<string, unknown>;
  for (const key of BANNED_KEYS_TOP_LEVEL) {
    if (key in top) violations.push(`top.${key}`);
  }

  const vitals: Array<[string, unknown]> = [
    ["bp", value.bp],
    ["hr", value.hr],
    ["spo2", value.spo2],
    ["sleep", value.sleep],
    ["activity", value.activity],
  ];
  for (const [name, sub] of vitals) {
    if (sub === undefined || sub === null) continue;
    const subRec = sub as Record<string, unknown>;
    for (const key of BANNED_KEYS_PER_VITAL) {
      if (key in subRec) violations.push(`${name}.${key}`);
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `phi-scrub: banned keys present in scrubbed payload: ${violations.join(", ")}`
    );
  }
}
