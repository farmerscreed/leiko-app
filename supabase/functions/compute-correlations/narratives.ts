// Narrative templates per correlation type — Sprint 9 / D11 §3.6.
//
// Each meaningful row writes both `narrative_short` (a one-line
// headline) and `narrative_long` (a paragraph). Voice rules per
// docs/15-correlation-engine.md §5: described, never prescribed.

import type { CorrelationType } from './types.ts';

export interface NarrativeInputs {
  sampleN: number;
  /** Effect size in user-relatable units. Sign + magnitude both matter. */
  effectSize: number;
}

export function narrativeFor(
  type: CorrelationType,
  inputs: NarrativeInputs,
): { short: string; long: string; effectUnit: string } {
  // Effect size is the regression slope. Direction-aware copy: we
  // describe the EXPECTED-DIRECTION pattern so the headline reads
  // naturally; if the data points the "wrong" way (rare for the three
  // v1.0 correlations) we still describe what the numbers say.
  switch (type) {
    case 'sleep_x_morning_bp': {
      // x = total sleep minutes, y = morning systolic.
      // Effect unit: mmHg per hour of sleep. Negative slope = expected.
      const mmHgPerHour = inputs.effectSize * 60;
      const absMmHg = Math.abs(Math.round(mmHgPerHour));
      const directionShort =
        mmHgPerHour < 0
          ? `Poor sleep ↔ +${absMmHg} mmHg morning systolic`
          : `Longer sleep ↔ +${absMmHg} mmHg morning systolic`;
      const long =
        mmHgPerHour < 0
          ? `On nights you slept under 6 hours, your morning systolic averaged about ${absMmHg} points higher than on full-rest nights. Pattern based on the last ${inputs.sampleN} nights.`
          : `Across the last ${inputs.sampleN} nights, longer sleep tracked alongside slightly higher morning systolic — opposite of what's typical. Worth bringing up with your doctor if it continues.`;
      return { short: directionShort, long, effectUnit: 'mmHg/hour-sleep' };
    }
    case 'activity_x_resting_hr': {
      // x = steps_day, y = resting HR. Negative slope = expected.
      const bpmPer1k = inputs.effectSize * 1000;
      const absBpm = Math.abs(Math.round(bpmPer1k * 10) / 10);
      const short =
        bpmPer1k < 0
          ? `More daily steps ↔ −${absBpm} bpm resting HR`
          : `More daily steps ↔ +${absBpm} bpm resting HR`;
      const long =
        bpmPer1k < 0
          ? `Days with more steps tracked alongside a lower resting heart rate over the last ${inputs.sampleN} days. About ${absBpm} bpm lower per extra 1,000 steps.`
          : `Across the last ${inputs.sampleN} days, more daily steps tracked alongside a slightly higher resting heart rate. Worth raising with your doctor if it continues.`;
      return { short, long, effectUnit: 'bpm/1000-steps' };
    }
    case 'spo2_dip_x_sleep_score': {
      // x = overnight SpO2 minimum, y = sleep total minutes (proxy for score).
      // Positive slope = expected (higher min → more sleep).
      const minPerPercent = inputs.effectSize;
      const absMin = Math.abs(Math.round(minPerPercent));
      const short =
        minPerPercent > 0
          ? `Lower overnight SpO2 dips ↔ lower sleep score`
          : `Lower overnight SpO2 dips ↔ higher sleep score`;
      const long =
        minPerPercent > 0
          ? `On nights your SpO2 dipped further, your sleep totals landed lower over the last ${inputs.sampleN} nights — about ${absMin} fewer minutes per SpO2 percent. The pattern doesn't tell us why; if it persists, it's worth raising with your doctor.`
          : `Across the last ${inputs.sampleN} nights, lower SpO2 dips tracked alongside slightly more sleep — opposite of what's typical. Worth bringing up with your doctor if it continues.`;
      return { short, long, effectUnit: 'min/SpO2-percent' };
    }
  }
}
