// Daily Pulse composed selector — Sprint 7.5 / D13 §7.3.
//
// Pulls latest values from each vital store and composes the
// `DailyPulseData` shape the hero component (Sprint 7.6) consumes. The
// hook is the single integration point between the slices' raw
// aggregators (`restingBpmToday`, `latestPercent`, etc.) and the
// classifiers — slices stay storage-only, classifiers stay pure, this
// hook does the wiring.
//
// Architecture: the hook subscribes to each vital store and forwards
// snapshots into `composeDailyPulseData`, a pure function. The pure
// function is exported so tests can verify the compose logic without
// a React renderer (the pure jest project has no RN/jsdom).
//
// Per CLAUDE.md voice rules: this file does NOT format user-visible
// strings. The hero component owns "in pattern" / "Worth a look" /
// "Talk to your doctor" wording via the existing tierChipText helper.

import { useReadings } from './readings';
import { useHR } from './hr';
import { useSpO2 } from './spo2';
import { useSleep } from './sleep';
import { useActivity } from './activity';
import {
  classifyHR,
  classifySpO2,
  classifySleep,
  classifyActivity,
  checkStaleness,
  type Classification,
  type HRClassification,
  type SpO2Classification,
  type SleepClassification,
  type ActivityClassification,
  type VitalStaleness,
} from '../utils/classification';
import type { LocalReading } from './readings';
import type { SleepSession, ActivityDay } from '../types/vitals';

export interface BPSlice {
  latest: { systolic: number; diastolic: number; pulse: number | null } | null;
  /** unix sec UTC of the latest BP reading; null when no BP exists. */
  latestSampleSec: number | null;
  classification: Classification | null;
  staleness: VitalStaleness;
}

export interface HRSlice {
  restingToday: number | null;
  /** unix sec UTC of the most recent HR sample (any window); null when none. */
  latestSampleSec: number | null;
  classification: HRClassification | null;
  staleness: VitalStaleness;
}

export interface SpO2Slice {
  latestPercent: number | null;
  overnightLowsRecent: number[];
  /** unix sec UTC of the most recent SpO2 sample; null when none. */
  latestSampleSec: number | null;
  classification: SpO2Classification | null;
  staleness: VitalStaleness;
}

export interface SleepSlice {
  session: SleepSession | null;
  classification: SleepClassification | null;
  staleness: VitalStaleness;
}

export interface ActivitySlice {
  stepsToday: number;
  targetSteps: number;
  /** unix sec UTC of the most recent activity sample. */
  latestSampleSec: number | null;
  classification: ActivityClassification | null;
  staleness: VitalStaleness;
}

export interface DailyPulseData {
  /** YYYY-MM-DD in UTC for now (matches the slice aggregators). */
  todayDateLocal: string;
  bp: BPSlice;
  hr: HRSlice;
  spo2: SpO2Slice;
  sleep: SleepSlice;
  activity: ActivitySlice;
}

/**
 * Snapshot of everything `composeDailyPulseData` needs from the stores.
 * The hook builds this; tests can build it directly to exercise the
 * compose logic without standing up React + jsdom.
 */
export interface DailyPulseSnapshot {
  bpLatest: LocalReading | null;
  /** Resting BPM for today's sleep window — slice aggregator output. */
  hrRestingToday: number | null;
  /** Last 14 days' restingBpmToday values, oldest first. */
  hrRestingRecent: number[];
  /** Most recent HR sample's measuredAtSec (any window) — drives staleness. */
  hrLatestSampleAt: number | null;
  spo2LatestPercent: number | null;
  spo2OvernightLowsRecent: number[];
  spo2LatestSampleAt: number | null;
  sleepSession: SleepSession | null;
  activityToday: ActivityDay | null;
}

const DEFAULT_TARGET_STEPS = 6000;

function todayLocalKey(nowSec: number): string {
  return new Date(nowSec * 1000).toISOString().slice(0, 10);
}

/**
 * Pure compose function. Given store snapshots + nowSec, returns the
 * full DailyPulseData. Exported for tests; production callers use the
 * hook below which builds the snapshot from live store state.
 */
export function composeDailyPulseData(
  snapshot: DailyPulseSnapshot,
  nowSec: number,
): DailyPulseData {
  const bp: BPSlice = {
    latest: snapshot.bpLatest
      ? {
          systolic: snapshot.bpLatest.systolic,
          diastolic: snapshot.bpLatest.diastolic,
          pulse: snapshot.bpLatest.pulse,
        }
      : null,
    latestSampleSec: snapshot.bpLatest?.measuredAtSec ?? null,
    classification: snapshot.bpLatest?.classification ?? null,
    staleness: checkStaleness(
      'bp',
      snapshot.bpLatest?.measuredAtSec ?? null,
      nowSec,
    ),
  };

  const hr: HRSlice = {
    restingToday: snapshot.hrRestingToday,
    latestSampleSec: snapshot.hrLatestSampleAt,
    classification:
      snapshot.hrRestingToday !== null
        ? classifyHR({
            restingBpmToday: snapshot.hrRestingToday,
            restingBpmRecent: snapshot.hrRestingRecent,
          })
        : null,
    staleness: checkStaleness('hr', snapshot.hrLatestSampleAt, nowSec),
  };

  const spo2: SpO2Slice = {
    latestPercent: snapshot.spo2LatestPercent,
    overnightLowsRecent: snapshot.spo2OvernightLowsRecent,
    latestSampleSec: snapshot.spo2LatestSampleAt,
    classification:
      snapshot.spo2LatestPercent !== null
        ? classifySpO2({
            latestPercent: snapshot.spo2LatestPercent,
            overnightLowsRecent: snapshot.spo2OvernightLowsRecent,
          })
        : null,
    staleness: checkStaleness('spo2', snapshot.spo2LatestSampleAt, nowSec),
  };

  const sleep: SleepSlice = {
    session: snapshot.sleepSession,
    classification: snapshot.sleepSession
      ? classifySleep({
          totalMinutes: snapshot.sleepSession.totalMinutes,
          deepMinutes: snapshot.sleepSession.deepMinutes,
          awakeCount: snapshot.sleepSession.awakeCount,
          sessionStartSec: snapshot.sleepSession.sessionStartSec,
          sessionEndSec: snapshot.sleepSession.sessionEndSec,
        })
      : classifySleep(null),
    staleness: checkStaleness(
      'sleep',
      snapshot.sleepSession?.sessionEndSec ?? null,
      nowSec,
    ),
  };

  const stepsToday = snapshot.activityToday?.totalSteps ?? 0;
  const targetSteps = snapshot.activityToday?.targetSteps ?? DEFAULT_TARGET_STEPS;
  const activity: ActivitySlice = {
    stepsToday,
    targetSteps,
    latestSampleSec: snapshot.activityToday?.lastSampleAtSec ?? null,
    classification: snapshot.activityToday
      ? classifyActivity({ stepsToday, targetSteps })
      : null,
    staleness: checkStaleness(
      'activity',
      snapshot.activityToday?.lastSampleAtSec ?? null,
      nowSec,
    ),
  };

  return {
    todayDateLocal: todayLocalKey(nowSec),
    bp,
    hr,
    spo2,
    sleep,
    activity,
  };
}

/**
 * Selector hook returning the current Daily Pulse state. Pass nowSec
 * for deterministic tests; production callers omit and the hook uses
 * the current wall clock.
 *
 * Re-render model: each call subscribes to the underlying stores via
 * individual primitive selectors (length-based for arrays). When any
 * vital's pending/recent changes, the hook re-runs and any consumer
 * re-renders. The dailyPulse hero updates infrequently enough that
 * perfect array-equality memoization is not load-bearing.
 */
export function useDailyPulseData(nowSec?: number): DailyPulseData {
  const now = nowSec ?? Math.floor(Date.now() / 1000);

  // Primitive subscriptions — drive re-renders when state changes.
  // The actual snapshot is read fresh from getState() once we know we
  // need to recompute (zustand's selector returning the same primitive
  // skips the re-render entirely).
  useReadings((s) => s.latest()?.measuredAtSec ?? null);
  useHR((s) => s.restingBpmToday(now));
  useHR((s) => s.restingBpmRecent(now).length);
  useHR((s) => s.pending.length + s.recent.length);
  useSpO2((s) => s.latestPercent(now));
  useSpO2((s) => s.overnightLowsRecent(now).length);
  useSpO2((s) => s.pending.length + s.recent.length);
  useSleep((s) => s.lastNightSession(now)?.sessionStartSec ?? null);
  useActivity((s) => s.todaySteps(now)?.dayLocal ?? null);

  const snapshot = buildSnapshot(now);
  return composeDailyPulseData(snapshot, now);
}

/**
 * Sprint 17a — empty fallback for the parameterized VitalDetail screens.
 * When a caregiver opens a parent's vital detail and the parent-scoped
 * fetch hasn't resolved yet, the screen needs SOME `DailyPulseData`
 * shape to read (it's presentational; null-checking every field is
 * noisy). The empty fallback returns the same shape with all-null
 * vital slices — the screens' existing `isEmpty` checks then drive
 * the empty-state branch automatically.
 */
export function emptyDailyPulse(nowSec?: number): DailyPulseData {
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  return composeDailyPulseData(
    {
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: null,
      activityToday: null,
    },
    now,
  );
}

function buildSnapshot(nowSec: number): DailyPulseSnapshot {
  const hrAll = [
    ...useHR.getState().pending,
    ...useHR.getState().recent,
  ];
  const spo2All = [
    ...useSpO2.getState().pending,
    ...useSpO2.getState().recent,
  ];
  return {
    bpLatest: useReadings.getState().latest(),
    hrRestingToday: useHR.getState().restingBpmToday(nowSec),
    hrRestingRecent: useHR.getState().restingBpmRecent(nowSec),
    hrLatestSampleAt:
      hrAll.length === 0
        ? null
        : hrAll.reduce((a, b) => (b.measuredAtSec > a.measuredAtSec ? b : a))
            .measuredAtSec,
    spo2LatestPercent: useSpO2.getState().latestPercent(nowSec),
    spo2OvernightLowsRecent: useSpO2.getState().overnightLowsRecent(nowSec),
    spo2LatestSampleAt:
      spo2All.length === 0
        ? null
        : spo2All.reduce((a, b) => (b.measuredAtSec > a.measuredAtSec ? b : a))
            .measuredAtSec,
    sleepSession: useSleep.getState().lastNightSession(nowSec),
    activityToday: useActivity.getState().todaySteps(nowSec),
  };
}
