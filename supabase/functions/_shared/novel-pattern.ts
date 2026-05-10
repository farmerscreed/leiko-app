// supabase/functions/_shared/novel-pattern.ts — Sprint 12.5.
//
// Implements D14 §3.2 routing decision tree: when a Plus user opens
// Daily Pulse, do we generate a Tier-B narration (more interesting,
// costs ~$0.000188), or fall back to a Tier-A template (free, fast,
// voice-rule-clean by construction)?
//
// The four "novel" conditions per D14 §3.2:
//   1. Multiple vitals in calm-concerned simultaneously
//   2. A new meaningful correlation just became available
//   3. User returning after 7+ day absence
//   4. Latest reading is anomalous for the user's baseline
//
// ANY one match → Tier-B. Otherwise Tier-A. The 80/20 split D14 §3.2
// promises (~80% Tier-A, ~20% Tier-B) emerges naturally from the
// four-condition logic against typical user data distributions.

import type { ScrubbedAiContext, VitalState } from './phi-scrub.ts';

export interface NovelPatternInput {
  context: ScrubbedAiContext;
  /**
   * Number of meaningful correlations whose `computed_at` is within
   * the last 24h. The cron writes to `public.correlations` nightly;
   * a brand-new meaningful correlation is the trigger.
   */
  newCorrelationCount: number;
  /**
   * Days since the user's last reading. Coarse — pulled from
   * MAX(measured_at) on the readings + vitals_other tables. ≥7 fires
   * the "returning user" condition.
   */
  daysSinceLastReading: number;
  /**
   * Whether the latest BP is >10% off the user's week average. A
   * cheap baseline-anomaly stand-in for v1.0; Sprint 15's anomaly
   * engine refines this with proper baseline-deviation z-scores.
   */
  isLatestReadingAnomalous: boolean;
}

export type NovelReason =
  | 'multi_vital_calm_concerned'
  | 'new_correlation'
  | 'returning_user_7d'
  | 'baseline_anomaly';

export interface NovelPatternResult {
  isNovel: boolean;
  reasons: NovelReason[];
}

/**
 * Pure function. Returns the four-condition match summary so the
 * caller can route AND log telemetry on which condition fired (per
 * D14 §16 we want to know empirically what fraction of Tier-B
 * triggers come from each path).
 */
export function detectNovelPattern(input: NovelPatternInput): NovelPatternResult {
  const reasons: NovelReason[] = [];

  // 1. Multiple vitals in calm-concerned simultaneously.
  const states: (VitalState | undefined)[] = [
    input.context.bp?.state,
    input.context.hr?.state,
    input.context.spo2?.state,
    input.context.sleep?.state,
    input.context.activity?.state,
  ];
  const calmConcernedCount = states.filter((s) => s === 'calm_concerned').length;
  if (calmConcernedCount >= 2) {
    reasons.push('multi_vital_calm_concerned');
  }

  // 2. A new meaningful correlation just became available.
  if (input.newCorrelationCount > 0) {
    reasons.push('new_correlation');
  }

  // 3. User returning after 7+ day absence.
  if (input.daysSinceLastReading >= 7) {
    reasons.push('returning_user_7d');
  }

  // 4. Latest reading is anomalous for the user's baseline.
  if (input.isLatestReadingAnomalous) {
    reasons.push('baseline_anomaly');
  }

  return {
    isNovel: reasons.length > 0,
    reasons,
  };
}

/**
 * Helper for the BP-baseline check. Returns true when the latest BP
 * deviates from the week average by more than `thresholdPct` percent
 * on EITHER systolic or diastolic. Coarse — a real anomaly score
 * would z-score against a longer baseline window per Sprint 15.
 */
export function isBpAnomalousVsWeekAverage(
  context: ScrubbedAiContext,
  thresholdPct = 0.10,
): boolean {
  const bp = context.bp;
  if (!bp) return false;
  if (bp.weekAverageSystolic === null || bp.weekAverageDiastolic === null) {
    return false;
  }
  const sysDiff = Math.abs(bp.latestSystolic - bp.weekAverageSystolic);
  const diaDiff = Math.abs(bp.latestDiastolic - bp.weekAverageDiastolic);
  if (bp.weekAverageSystolic > 0 && sysDiff / bp.weekAverageSystolic > thresholdPct) {
    return true;
  }
  if (bp.weekAverageDiastolic > 0 && diaDiff / bp.weekAverageDiastolic > thresholdPct) {
    return true;
  }
  return false;
}
