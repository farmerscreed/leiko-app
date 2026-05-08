// Shared types for compute-correlations — Sprint 9.

export type CorrelationType =
  | 'sleep_x_morning_bp'
  | 'activity_x_resting_hr'
  | 'spo2_dip_x_sleep_score';

export const ALL_CORRELATION_TYPES: CorrelationType[] = [
  'sleep_x_morning_bp',
  'activity_x_resting_hr',
  'spo2_dip_x_sleep_score',
];

export const WINDOW_DAYS = 30;
export const MIN_SAMPLE_N = 14;
export const R_THRESHOLD = 0.3;
export const P_THRESHOLD = 0.05;

export interface CorrelationOutput {
  correlationType: CorrelationType;
  pearsonR: number | null;
  effectSize: number;
  effectUnit: string | null;
  significance: number;
  sampleN: number;
  isMeaningful: boolean;
  narrativeShort: string | null;
  narrativeLong: string | null;
}
