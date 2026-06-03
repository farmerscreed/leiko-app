// Deterministic vital-record fixture builders — Sprint 7.5.
//
// Produces typed records matching apps/mobile/src/types/vitals.ts
// (HRSample, SpO2Sample, SleepSession, ActivityDay, CaloriesDay).
// These are NOT wire packets — wire-packet helpers live alongside
// each BLE wrapper's tests (the same pattern Sprint 6 uses for
// readBPHistory). These fixtures are for integration tests, the
// /sync endpoint tests, and future Daily Pulse component tests
// once Sprint 7.6 builds them.
//
// Determinism: every builder takes a `seed` (number). Same seed,
// same scenario, same sequence of records every run. The RNG is a
// mulberry32 — small, dependency-free, and produces the same stream
// across Node versions.
//
// Scenario presets exist for the patterns that downstream tests
// will repeatedly need (a 3-day high-HR trend, an overnight SpO2
// dip pattern, a short sleep session, a normal activity day). Add
// new presets as integration tests need them — keep them named
// after the *pattern* not the *test* so they read at the call site.
//
// Usage from a Jest test (TS):
//   const { hrCalmConcerned3DayTrend } = require(
//     '../../../../../../tools/ble-mock/fixtures',
//   );
//   const samples: HRSample[] = hrCalmConcerned3DayTrend({ seed: 42 });

/**
 * mulberry32 — deterministic 32-bit RNG. Returns a function producing
 * floats in [0, 1). Same seed → same stream.
 */
function seededRng(seed) {
  let a = (seed | 0) >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns an integer in [min, max] inclusive using the given rng. */
function intInRange(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_MINUTE = 60;

function dayLocal(unixSec) {
  // Use UTC for determinism in tests. Production callers convert
  // unixSec to user-local 'YYYY-MM-DD' via the user's IANA TZ.
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────
// HR scenarios

/**
 * Healthy auto-sample stream over `days` days at 30-min intervals.
 * Resting HR oscillates ±5 bpm around 70 (the "in-pattern" baseline).
 * Default 14 days = 14 × 48 = 672 samples.
 */
function hrInPatternBaseline(opts = {}) {
  const seed = opts.seed ?? 1;
  const days = opts.days ?? 14;
  // Anchor to UTC midnight so each generated day maps to exactly one UTC
  // calendar-day bucket downstream (classifiers bucket by toISOString day).
  // Without this, fixture days straddle two UTC days and trend tests flake
  // around midnight UTC.
  const startSec = opts.startSec ?? (Math.floor(Date.now() / 1000 / SECONDS_PER_DAY) - days) * SECONDS_PER_DAY;
  const baselineBpm = opts.baselineBpm ?? 70;
  const rng = seededRng(seed);
  const samples = [];
  for (let s = 0; s < days * 48; s++) {
    samples.push({
      measuredAtSec: startSec + s * 30 * SECONDS_PER_MINUTE,
      bpm: baselineBpm + intInRange(rng, -5, 5),
      sampleWindowSec: 30 * SECONDS_PER_MINUTE,
      motionState: 'rest',
      isSpotCheck: false,
    });
  }
  return samples;
}

/**
 * 15-day series with the last 3 days running > baseline + 15 bpm. The
 * classifier needs >= 14 days of *baseline* history (HR_MIN_BASELINE_DAYS),
 * and the test treats the final bucket as "today" — so we generate 15 clean
 * UTC-day buckets (12 baseline + 3 elevated). That leaves 14 days in
 * `restingBpmRecent` (hot path) with the last 3 elevated, triggering the
 * calm_concerned `baseline_3day_trend` rule per D13 §6.2.
 */
function hrCalmConcerned3DayTrend(opts = {}) {
  const seed = opts.seed ?? 2;
  // Anchor to UTC midnight (see note in hrInPatternBaseline) so each day maps
  // to exactly one UTC-day bucket and the trend is deterministic regardless of
  // the wall-clock time the test runs.
  const days = 15;
  const startSec = opts.startSec ?? (Math.floor(Date.now() / 1000 / SECONDS_PER_DAY) - days) * SECONDS_PER_DAY;
  const baselineBpm = opts.baselineBpm ?? 70;
  const rng = seededRng(seed);
  const samples = [];
  for (let day = 0; day < days; day++) {
    const dayStart = startSec + day * SECONDS_PER_DAY;
    // First 12 days at baseline, last 3 days at baseline + 18-22 bpm.
    const center = day >= days - 3 ? baselineBpm + 20 : baselineBpm;
    for (let s = 0; s < 48; s++) {
      samples.push({
        measuredAtSec: dayStart + s * 30 * SECONDS_PER_MINUTE,
        bpm: center + intInRange(rng, -3, 3),
        sampleWindowSec: 30 * SECONDS_PER_MINUTE,
        motionState: 'rest',
        isSpotCheck: false,
      });
    }
  }
  return samples;
}

/**
 * One spot-check at an extreme value — fires confirmed_urgent per
 * D13 §6.2 `extreme_value` rule (< 40 OR > 130).
 */
function hrConfirmedUrgentExtreme(opts = {}) {
  const seed = opts.seed ?? 3;
  const measuredAtSec = opts.measuredAtSec ?? Math.floor(Date.now() / 1000);
  const bpm = opts.bpm ?? 145;
  const rng = seededRng(seed);
  void rng();   // prime for parity with other scenarios
  return [
    {
      measuredAtSec,
      bpm,
      sampleWindowSec: 1,
      motionState: 'rest',
      isSpotCheck: true,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────
// SpO2 scenarios

/**
 * Healthy auto-sample stream — latest 96-99%, no overnight dips.
 */
function spo2InPattern(opts = {}) {
  const seed = opts.seed ?? 11;
  const days = opts.days ?? 14;
  // Anchor to UTC midnight so each generated day maps to exactly one UTC
  // calendar-day bucket downstream (classifiers bucket by toISOString day).
  // Without this, fixture days straddle two UTC days and trend tests flake
  // around midnight UTC.
  const startSec = opts.startSec ?? (Math.floor(Date.now() / 1000 / SECONDS_PER_DAY) - days) * SECONDS_PER_DAY;
  const rng = seededRng(seed);
  const samples = [];
  for (let s = 0; s < days * 48; s++) {
    const percent = intInRange(rng, 96, 99);
    samples.push({
      measuredAtSec: startSec + s * 30 * SECONDS_PER_MINUTE,
      percent,
      maxInWindow: percent,
      minInWindow: percent - intInRange(rng, 0, 1),
      sampleWindowSec: 30 * SECONDS_PER_MINUTE,
      isSpotCheck: false,
      perfusionIndex: 0.5 + rng() * 0.5,
    });
  }
  return samples;
}

/**
 * 3 consecutive nights with overnight-low < 88 — triggers
 * confirmed_urgent `overnight_dip_sustained` per D13 §6.3. The
 * overnight-low values are emitted as samples during the user's
 * sleep window (here we put them between 02:00 and 04:00 UTC for
 * determinism); the state slice's overnight-low aggregator picks
 * the minimum.
 */
function spo2OvernightDip(opts = {}) {
  const seed = opts.seed ?? 12;
  const days = opts.days ?? 7;
  // Anchor to UTC midnight so each generated day maps to exactly one UTC
  // calendar-day bucket downstream (classifiers bucket by toISOString day).
  // Without this, fixture days straddle two UTC days and trend tests flake
  // around midnight UTC.
  const startSec = opts.startSec ?? (Math.floor(Date.now() / 1000 / SECONDS_PER_DAY) - days) * SECONDS_PER_DAY;
  const rng = seededRng(seed);
  const samples = [];
  for (let day = 0; day < days; day++) {
    const dayStart = startSec + day * SECONDS_PER_DAY;
    const isDipNight = day >= days - 3;   // last 3 days
    const overnightLow = isDipNight ? intInRange(rng, 83, 87) : intInRange(rng, 92, 96);
    // Daytime samples 95-98%, then a low at the night midpoint.
    for (let s = 0; s < 48; s++) {
      const sec = dayStart + s * 30 * SECONDS_PER_MINUTE;
      const isOvernight = s >= 4 && s <= 8;   // 02:00-04:00 UTC
      const percent = isOvernight
        ? overnightLow + intInRange(rng, 0, 2)
        : intInRange(rng, 95, 98);
      samples.push({
        measuredAtSec: sec,
        percent,
        maxInWindow: percent + intInRange(rng, 0, 1),
        minInWindow: percent - intInRange(rng, 0, 2),
        sampleWindowSec: 30 * SECONDS_PER_MINUTE,
        isSpotCheck: false,
        perfusionIndex: 0.4 + rng() * 0.5,
      });
    }
  }
  return samples;
}

// ─────────────────────────────────────────────────────────────────────
// Sleep scenarios

/**
 * 7h 24m session, 22% deep, 1 wake — score lands in_pattern.
 */
function sleepInPatternSession(opts = {}) {
  const seed = opts.seed ?? 21;
  void seededRng(seed);   // unused randomness reserved for future jitter
  const sessionEndSec =
    opts.sessionEndSec ?? Math.floor(Date.now() / 1000);
  const sessionStartSec = sessionEndSec - 7 * SECONDS_PER_HOUR - 30 * SECONDS_PER_MINUTE;
  const totalMinutes = 7 * 60 + 24;
  const deepMinutes = Math.round(totalMinutes * 0.22);
  const remMinutes = Math.round(totalMinutes * 0.20);
  const lightMinutes = totalMinutes - deepMinutes - remMinutes - 5;
  const session = {
    sessionStartSec,
    sessionEndSec,
    sessionStartLocal: new Date(sessionStartSec * 1000).toISOString(),
    sessionEndLocal: new Date(sessionEndSec * 1000).toISOString(),
    totalMinutes,
    deepMinutes,
    remMinutes,
    lightMinutes,
    awakeMinutes: 5,
    awakeCount: 1,
    transitions: [
      { atSec: sessionStartSec, stage: 'light' },
      { atSec: sessionStartSec + 25 * SECONDS_PER_MINUTE, stage: 'deep' },
      { atSec: sessionStartSec + 100 * SECONDS_PER_MINUTE, stage: 'rem' },
      { atSec: sessionStartSec + 200 * SECONDS_PER_MINUTE, stage: 'light' },
      { atSec: sessionEndSec - 5 * SECONDS_PER_MINUTE, stage: 'awake' },
    ],
    sleepScore: 0,   // computed by classifier
  };
  return session;
}

/**
 * 4h 10m session, fragmented — score lands calm_concerned (≥50, <70).
 */
function sleepShortSession(opts = {}) {
  const sessionEndSec = opts.sessionEndSec ?? Math.floor(Date.now() / 1000);
  const sessionStartSec = sessionEndSec - 5 * SECONDS_PER_HOUR;   // in-bed window 5h
  return {
    sessionStartSec,
    sessionEndSec,
    sessionStartLocal: new Date(sessionStartSec * 1000).toISOString(),
    sessionEndLocal: new Date(sessionEndSec * 1000).toISOString(),
    totalMinutes: 250,
    deepMinutes: 30,
    remMinutes: 40,
    lightMinutes: 180,
    awakeMinutes: 50,
    awakeCount: 4,
    transitions: [
      { atSec: sessionStartSec, stage: 'light' },
      { atSec: sessionStartSec + 60 * SECONDS_PER_MINUTE, stage: 'awake' },
      { atSec: sessionStartSec + 75 * SECONDS_PER_MINUTE, stage: 'light' },
      { atSec: sessionStartSec + 180 * SECONDS_PER_MINUTE, stage: 'deep' },
      { atSec: sessionStartSec + 220 * SECONDS_PER_MINUTE, stage: 'awake' },
    ],
    sleepScore: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Activity scenarios

/**
 * Normal day — 7,200 steps against a 6,000 default target. Hourly
 * distribution peaks 09:00-12:00 + 17:00-20:00 (typical desk-job day).
 */
function activityNormalDay(opts = {}) {
  const seed = opts.seed ?? 31;
  const dayStartSec = opts.dayStartSec ?? Math.floor(Date.now() / 1000);
  const targetSteps = opts.targetSteps ?? 6000;
  const totalSteps = opts.totalSteps ?? 7200;
  const rng = seededRng(seed);
  // Distribute steps across 24 hours with morning + evening peaks.
  const weights = Array.from({ length: 24 }, (_, h) => {
    if (h < 7) return 0.05;
    if (h < 12) return 1.5;
    if (h < 17) return 0.7;
    if (h < 21) return 1.3;
    return 0.2;
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const hourly = weights.map((w) => Math.round((w / weightSum) * totalSteps));
  // Top up rounding to match totalSteps exactly.
  const diff = totalSteps - hourly.reduce((a, b) => a + b, 0);
  hourly[12] += diff;
  void rng();
  return {
    dayLocal: dayLocal(dayStartSec),
    measuredAtSec: dayStartSec,
    totalSteps,
    targetSteps,
    lastSampleAtSec: dayStartSec + 22 * SECONDS_PER_HOUR,
    hourly,
  };
}

/**
 * Calories companion to activityNormalDay — 320 active kcal + BMR.
 */
function caloriesNormalDay(opts = {}) {
  const dayStartSec = opts.dayStartSec ?? Math.floor(Date.now() / 1000);
  const activityKcal = opts.activityKcal ?? 320;
  const bmrKcal = opts.bmrKcal ?? 1480;
  return {
    dayLocal: dayLocal(dayStartSec),
    measuredAtSec: dayStartSec,
    totalKcal: activityKcal + bmrKcal,
    activityKcal,
    bmrKcal,
    targetKcal: opts.targetKcal ?? null,
  };
}

module.exports = {
  // primitives
  seededRng,
  // hr
  hrInPatternBaseline,
  hrCalmConcerned3DayTrend,
  hrConfirmedUrgentExtreme,
  // spo2
  spo2InPattern,
  spo2OvernightDip,
  // sleep
  sleepInPatternSession,
  sleepShortSession,
  // activity
  activityNormalDay,
  caloriesNormalDay,
};
