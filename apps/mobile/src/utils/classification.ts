// Reading classification — Sprint 6.
//
// Pure function implementing docs/10-anomaly-logic.md §2. Two paths:
//
// • Cold-start (no baseline / <14 days of data): absolute-threshold
//   ladder only. Any reading at or above 180/120 is `confirmed_urgent`
//   (crisis); anything strictly above 160/100 (or pulse > 130) is
//   `calm_concerned`; otherwise `in_pattern`. Sprint 6 always runs this
//   path because the baseline isn't computed until the anomaly engine
//   ships in Sprint 15.
//
// • Hot path (≥14 days of baseline): outlier (>2σ) AND a soft-threshold
//   floor must both fire to flag `calm_concerned`. Crisis absolute
//   thresholds remain in force regardless of baseline.
//
// HARD RULE per CLAUDE.md + D3: this is a STATISTICAL classification, not
// a clinical diagnosis. UI never says "hypertension" or "crisis"; it
// says "Worth a look" / "Talk to your doctor". See docs/05-voice-and-claims.md.
//
// The hot-path `checkSustainedPattern` (3+ Stage-2 readings in 60min)
// is deferred to Sprint 15 — Sprint 6 ingests one reading at a time and
// has no rolling-window context. The cold-start path's
// `confirmed_urgent` crisis threshold still catches the single-reading
// emergency case.

// Tier taxonomy per D13 §6 — `in_pattern` (premium-pulse framing) replaces
// the Sprint 6 `in_range` literal. Display string is "In pattern".
export type ClassificationTier = 'in_pattern' | 'calm_concerned' | 'confirmed_urgent';

export interface ReadingForClassification {
  systolic: number;
  diastolic: number;
  pulse?: number | null;
}

export interface ReadingBaseline {
  sys: number;
  dia: number;
  pulse: number;
  sigmaSys: number;
  sigmaDia: number;
  sigmaPulse: number;
  daysOfData: number;
}

export interface Classification {
  tier: ClassificationTier;
  reason:
    | 'crisis_absolute'
    | 'absolute_cold_start'
    | 'cold_start'
    | 'outlier_and_soft_threshold'
    | 'within_baseline';
}

const CRISIS_SYS = 180;
const CRISIS_DIA = 120;
const STAGE2_SYS = 160;
const STAGE2_DIA = 100;
const SOFT_SYS = 150;
const SOFT_DIA = 95;
const SOFT_PULSE = 120;
const COLD_PULSE = 130;
const SIGMA_MULTIPLIER = 2;
const MIN_BASELINE_DAYS = 14;

export function classifyReading(
  reading: ReadingForClassification,
  baseline?: ReadingBaseline | null,
): Classification {
  const { systolic, diastolic } = reading;
  const pulse = reading.pulse ?? 0;

  // Crisis-absolute always wins, regardless of baseline maturity.
  if (systolic >= CRISIS_SYS || diastolic >= CRISIS_DIA) {
    return { tier: 'confirmed_urgent', reason: 'crisis_absolute' };
  }

  // Cold-start path: no baseline or insufficient data.
  if (!baseline || baseline.daysOfData < MIN_BASELINE_DAYS) {
    if (systolic > STAGE2_SYS || diastolic > STAGE2_DIA || pulse > COLD_PULSE) {
      return { tier: 'calm_concerned', reason: 'absolute_cold_start' };
    }
    return { tier: 'in_pattern', reason: 'cold_start' };
  }

  // Hot path: outlier AND exceeds soft threshold → calm-concerned.
  const sysOutlier =
    Math.abs(systolic - baseline.sys) > SIGMA_MULTIPLIER * baseline.sigmaSys;
  const diaOutlier =
    Math.abs(diastolic - baseline.dia) > SIGMA_MULTIPLIER * baseline.sigmaDia;
  const pulseOutlier =
    reading.pulse != null &&
    Math.abs(reading.pulse - baseline.pulse) >
      SIGMA_MULTIPLIER * baseline.sigmaPulse;

  const exceedsSoft = systolic > SOFT_SYS || diastolic > SOFT_DIA || pulse > SOFT_PULSE;

  if ((sysOutlier || diaOutlier || pulseOutlier) && exceedsSoft) {
    return { tier: 'calm_concerned', reason: 'outlier_and_soft_threshold' };
  }
  return { tier: 'in_pattern', reason: 'within_baseline' };
}

/** UI string for the tier chip. Centralised so tests catch voice-rule drift. */
export function tierChipText(tier: ClassificationTier): string {
  switch (tier) {
    case 'in_pattern':
      return 'In pattern';
    case 'calm_concerned':
      return 'Worth a look';
    case 'confirmed_urgent':
      return 'Talk to your doctor';
  }
}

export function tierPillVariant(tier: ClassificationTier): 'success' | 'accent' | 'urgent' {
  switch (tier) {
    case 'in_pattern':
      return 'success';
    case 'calm_concerned':
      return 'accent';
    case 'confirmed_urgent':
      return 'urgent';
  }
}
