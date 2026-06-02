// Shared types for the generate-doctor-pdf Edge Function — Sprint 9.

export type Range = '7d' | '30d' | '90d' | '1y';
export type AccountType = 'caregiver' | 'parent' | 'self_buyer';

export interface PdfRequest {
  familyId: string;
  userId: string;
  range: Range;
  /** Include reading-level notes (D8 §3.13). Defaults to true. */
  includeNotes?: boolean;
  /** Include caregiver comments. Defaults to true. */
  includeComments?: boolean;
  /** Sprint 16.5h — personal cover-page note authored on the
   *  For-your-doctor screen. Rendered above the disclaimer line. */
  coverNote?: string;
  /** Sprint 19 PDF v2 — optional structured clinical-context fields.
   *  Each is independently optional; capped at 300 chars server-side.
   *  Render under a dedicated "Clinical context" block on the cover. */
  medications?: string;
  symptoms?: string;
  targetBp?: string;
}

/** Sprint 18 / FUN-5 — AI-generated sections produced by
 *  generate-doctor-prep-ai. Either (or both) may be absent when the
 *  user is on the free tier OR when the AI call failed; the template
 *  cascades to the deterministic content in that case. */
export interface AiSections {
  cover: string | null;
  observations: string | null;
}

export interface BPDayPoint {
  day: string;
  sys: number;
  dia: number;
  pulse: number | null;
  count: number;
}

export interface HRDayPoint {
  day: string;
  restingBpm: number | null;
  count: number;
}

export interface SpO2DayPoint {
  day: string;
  avgPercent: number | null;
  minPercent: number | null;
  count: number;
}

export interface SleepDayPoint {
  day: string;
  totalMinutes: number;
  deepMinutes: number;
}

export interface ActivityDayPoint {
  day: string;
  totalSteps: number;
}

export interface BPClassDistribution {
  normal: number;
  elevated: number;
  stage1: number;
  stage2: number;
  crisis: number;
}

export type ReadingFlagReason =
  | 'bradycardia'   // pulse < 60
  | 'tachycardia'   // pulse > 100
  | 'elevated_pp'   // pulse pressure (sys-dia) > 60
  | 'narrow_pp';    // pulse pressure < 30

export interface ReadingFlag {
  reason: ReadingFlagReason;
  /** Short clinical descriptor, e.g., "Bradycardia · 54 bpm" or
   *  "Elevated pulse pressure · 60". Suitable for a single table cell. */
  label: string;
}

export interface AbnormalReading {
  day: string;
  sys: number;
  dia: number;
  pulse: number | null;
  classification: 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis';
  /** Sprint 19 PDF v2 — clinical flags derived from the row.
   *  Empty array when no rule matched. */
  flags: ReadingFlag[];
}

export interface CorrelationRow {
  correlation_type:
    | 'sleep_x_morning_bp'
    | 'activity_x_resting_hr'
    | 'spo2_dip_x_sleep_score';
  pearson_r: number | null;
  effect_size: number | null;
  effect_unit: string | null;
  sample_n: number | null;
  is_meaningful: boolean;
  narrative_long: string | null;
}

/** Sprint 19 PDF v2 — data-sufficiency state for a vital.
 *  Drives whether a section renders averages/charts (sufficient),
 *  an insufficient-data callout (insufficient), or is suppressed
 *  outright (none). Thresholds live in data.ts. */
export type SufficiencyLevel = 'sufficient' | 'insufficient' | 'none';

export interface VitalSufficiency {
  level: SufficiencyLevel;
  /** Short human label, e.g., "16 readings over 7 days" or
   *  "1 night observed (need ≥ 3)". Shown beside the section header
   *  to give the clinician immediate data-confidence context. */
  label: string;
}

/** Sprint 19 PDF v2 — deterministic 2-3 sentence interpretation of a
 *  vital. Built from existing aggregates by data.ts rules — no AI,
 *  no model variability. Renders under each section header so the
 *  doctor gets context before scanning the table. */
export interface ClinicalContext {
  /** Each paragraph renders as its own <p> in the PDF. */
  paragraphs: string[];
}

/** Sprint 19 PDF v2 — always-rendered cover summary so the PDF is
 *  useful without the AI cover paragraph (which depends on Anthropic
 *  credits being topped up). Five vital headlines + bulleted key
 *  findings. The AI cover paragraph, when present, renders as a
 *  serif italic block ABOVE this summary. */
export interface ExecutiveSummary {
  /** Per-vital headline, e.g., "137/85 mmHg avg · 88% Stage 1+" or
   *  "Insufficient data". Always non-null; insufficient-data branches
   *  short-circuit to that string. */
  bpHeadline: string;
  hrHeadline: string;
  spo2Headline: string;
  sleepHeadline: string;
  activityHeadline: string;
  /** 0-5 short bullets surfacing items a doctor should look at first.
   *  Empty array is valid (uncommon healthy week). */
  keyFindings: string[];
}

export interface ReportData {
  user: {
    displayName: string;
    yearOfBirth: number | null;
    accountType: AccountType;
  };
  range: Range;
  rangeLabel: string;
  generatedAtIso: string;
  /** Sprint 19 PDF v2 — always populated. */
  executiveSummary: ExecutiveSummary;
  bp: {
    avgSys: number | null;
    avgDia: number | null;
    pctInRange: number | null;
    /** Sprint 19 PDF v2 — averaged systolic minus diastolic. Null
     *  when the BP section has no readings. */
    avgPulsePressure: number | null;
    /** Sprint 19 PDF v2 — % of readings ≥ ACC/AHA Stage 1 (130/80). */
    pctStage1Plus: number | null;
    /** Sprint 19 PDF v2 — % of readings ≥ Stage 2 (140/90). */
    pctStage2Plus: number | null;
    points: BPDayPoint[];
    distribution: BPClassDistribution;
    topAbnormal: AbnormalReading[];
    count: number;
    sufficiency: VitalSufficiency;
    clinicalContext: ClinicalContext;
  };
  hr: {
    avgResting: number | null;
    /** Sprint 19 PDF v2 — lowest single observation in the window. */
    minObserved: number | null;
    /** Sprint 19 PDF v2 — highest single observation in the window. */
    maxObserved: number | null;
    points: HRDayPoint[];
    count: number;
    sufficiency: VitalSufficiency;
    clinicalContext: ClinicalContext;
  };
  spo2: {
    avgMinPercent: number | null;
    /** Sprint 19 PDF v2 — single lowest SpO2 in the window. */
    minObserved: number | null;
    daysBelow90: number;
    /** Sprint 19 PDF v2 — count of distinct observations < 93%. */
    eventsBelow93: number;
    points: SpO2DayPoint[];
    count: number;
    sufficiency: VitalSufficiency;
    clinicalContext: ClinicalContext;
  };
  sleep: {
    avgTotalMinutes: number | null;
    points: SleepDayPoint[];
    count: number;
    sufficiency: VitalSufficiency;
    clinicalContext: ClinicalContext;
  };
  activity: {
    avgSteps: number | null;
    /** Sprint 19 PDF v2 — count of days that hit ≥ 6,000 steps. */
    daysAtTarget: number;
    points: ActivityDayPoint[];
    count: number;
    sufficiency: VitalSufficiency;
    clinicalContext: ClinicalContext;
  };
  correlations: CorrelationRow[];
  notes: { day: string; body: string }[];
  /** Sprint 16.5h — user-authored cover-page note (≤300 chars). */
  coverNote?: string;
  /** Sprint 19 PDF v2 — optional structured clinical-context fields.
   *  Free-text strings collected on the mobile For Your Doctor screen
   *  so the recipient clinician has medication / symptom / target
   *  context for interpreting the data. All independently optional. */
  clinicalFields?: {
    medications?: string;
    symptoms?: string;
    targetBp?: string;
  };
  /** Sprint 18 / FUN-5 — AI narrative sections. Absent on free tier
   *  or when the doctor-prep-ai call failed. */
  aiSections?: AiSections;
}
