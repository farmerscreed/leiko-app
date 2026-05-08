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

export interface AbnormalReading {
  day: string;
  sys: number;
  dia: number;
  pulse: number | null;
  classification: 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis';
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

export interface ReportData {
  user: {
    displayName: string;
    yearOfBirth: number | null;
    accountType: AccountType;
  };
  range: Range;
  rangeLabel: string;
  generatedAtIso: string;
  bp: {
    avgSys: number | null;
    avgDia: number | null;
    pctInRange: number | null;
    points: BPDayPoint[];
    distribution: BPClassDistribution;
    topAbnormal: AbnormalReading[];
    count: number;
  };
  hr: {
    avgResting: number | null;
    points: HRDayPoint[];
    count: number;
  };
  spo2: {
    avgMinPercent: number | null;
    daysBelow90: number;
    points: SpO2DayPoint[];
    count: number;
  };
  sleep: {
    avgTotalMinutes: number | null;
    points: SleepDayPoint[];
    count: number;
  };
  activity: {
    avgSteps: number | null;
    points: ActivityDayPoint[];
    count: number;
  };
  correlations: CorrelationRow[];
  notes: { day: string; body: string }[];
}
