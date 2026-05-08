// Multi-vitals sync pipeline — Sprint 7.5 / D13 §3.3.
//
// Runs AFTER syncBacklogToCompletion (BP path) on every successful
// reconnect. Implements steps 5–8 of the D13 §3.3 sequence:
//   1. setTime                          (handled by syncBacklog)
//   2. setUserParams (dirty)             (stub for Sprint 7.5 — Settings UI lands later)
//   3. setGoals (dirty)                  (stub for Sprint 7.5)
//   4. readBPHistory                     (handled by syncBacklog)
//   5. readHRHistory                     ← here
//   6. readSpO2History(today_local)      ← here
//   7. readSleep(last_night)             ← here
//   8. readActivity(today_local)         ← here
//
// Failures are isolated via Promise.allSettled across steps 5–8; one
// vital's failure does not block the others. Each successful read
// advances its per-vital cursor (per D13 §3.4) and pushes samples into
// the matching state slice's pending buffer (offline-first guarantee).
//
// After all reads settle, the pipeline batches the slices' pending
// arrays into a single MultiVitalsPayload and posts to /sync. On
// success, each slice's acceptSyncResult moves rows from pending →
// recent and clears the corresponding MMKV pending entries. On
// failure, samples stay in pending; the next reconnect retries the
// network leg (the per-vital cursor already advanced, so the watch
// won't be re-read).
//
// Sprint 7.5 simplifications (flagged for follow-up sprints):
//   • Always pulls "today" / "last night" — no multi-day backfill yet.
//     Per D13 §3.4 the cursor enables backfill; wiring lands later.
//   • Sleep session boundaries are synthesized from totalMinutes (the
//     0x07 reply doesn't expose start/end). sessionEnd = day 08:00 UTC,
//     sessionStart = sessionEnd - totalMinutes. Score's efficiency
//     component is therefore 1.0 on real-watch data — flagged in D13
//     §15.4 Q-D13-3.
//   • Activity hourly[24] = zeros. Per-hour distribution requires a
//     different ingest path (raw step samples via 0x73 0x04 notify) —
//     Sprint 8.5 vital-detail screens may add this.
//   • setUserParams + setGoals dirty-checks always return false for
//     now; the dirty-tracker hooks into Settings UI when it lands.
//
// Per CLAUDE.md data rule: counts only in analytics events.

import type { UrionDevice } from '../ble/UrionDevice';
import { readHRHistory } from '../ble/commands/readHRHistory';
import { readSpO2History } from '../ble/commands/readSpO2History';
import { readDayInfo } from '../ble/commands/readDayInfo';
import {
  getVitalCursor,
  setVitalCursor,
  watchTimestampToUtcSec,
} from './syncBacklog';
import { postMultiVitals, isPayloadEmpty } from './postMultiVitals';
import { useHR } from '../../state/hr';
import { useSpO2 } from '../../state/spo2';
import { useSleep } from '../../state/sleep';
import { useActivity } from '../../state/activity';
import { logger } from '../analytics/logger';
import type {
  HRSample,
  SpO2Sample,
  SleepSession,
  ActivityDay,
  CaloriesDay,
  DeviceMeta,
  MultiVitalsPayload,
  SleepStage,
} from '../../types/vitals';

const APP_VERSION = '0.0.1'; // bumped via package.json on release
const HR_DEFAULT_WINDOW_SEC = 30 * 60;
const SPO2_DEFAULT_WINDOW_SEC = 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;

export interface SyncMultiVitalsResult {
  /** True when every step succeeded. False if ANY of steps 5–8 failed
   *  OR the /sync POST failed; per-step errors collected in `errors`. */
  ok: boolean;
  /** Per-step error messages, keyed by step name. Empty when ok=true. */
  errors: Record<string, string>;
  /** Counts pulled from the watch (BEFORE dedup against cursor). */
  pulled: { hr: number; spo2: number; sleep: number; activity: number };
  /** Counts inserted server-side (post /sync). null when /sync was
   *  not called (empty payload). */
  inserted: { bp: number; hr: number; spo2: number; sleep: number; steps: number; calories: number } | null;
}

// ────────────────────────────────────────────────────────────────────
// Date helpers — UTC-anchored to match the slice aggregators. The
// watch-firmware-shift moves per-sample timestamps to TRUE UTC at
// ingest, so per-day boundaries computed in UTC produce user-local
// answers when the user's TZ matches the phone's TZ at capture time.

function dayLocalFromNow(nowSec: number): string {
  return new Date(nowSec * 1000).toISOString().slice(0, 10);
}

function dayStartSec(nowSec: number): number {
  // Start-of-day UTC for the day containing nowSec.
  return Math.floor(nowSec / SECONDS_PER_DAY) * SECONDS_PER_DAY;
}

function dayLocalFromBcd(yc: number, month: number, day: number): string {
  const yyyy = 2000 + yc;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function unixSecFromDayLocal(dayLocal: string): number {
  return Math.floor(new Date(`${dayLocal}T00:00:00Z`).getTime() / 1000);
}

// ────────────────────────────────────────────────────────────────────
// Per-vital read steps. Each pushes to the matching slice's pending
// buffer (synchronous MMKV write — offline-first durability) and
// advances the per-vital cursor on success. Returns the count of
// samples pulled.

async function syncHRStep(
  device: UrionDevice,
  deviceBleId: string,
  nowSec: number,
): Promise<number> {
  const cursor = getVitalCursor(deviceBleId);
  // Per D13 §3.5 + readHRHistory.ts: the wrapper returns RAW watch
  // seconds. Apply watchTimestampToUtcSec when converting to HRSample.
  const samples = await readHRHistory(device, {
    dayTimestampSec: dayStartSec(nowSec),
  });
  // Dedup against cursor.hr (raw watch sec): keep only newer samples.
  const fresh = cursor.hr > 0
    ? samples.filter((s) => s.timestampSec > cursor.hr)
    : samples;
  if (fresh.length === 0) return 0;
  const addPending = useHR.getState().addPending;
  let newestRaw = cursor.hr;
  for (const s of fresh) {
    const sample: HRSample = {
      measuredAtSec: watchTimestampToUtcSec(s.timestampSec),
      bpm: s.bpm,
      sampleWindowSec: HR_DEFAULT_WINDOW_SEC,
      // The 0x15 history packet does not expose motion-state per sample.
      // Classifier's sensor-error fallback ignores motion='unknown' for
      // baseline computation but still classifies extreme values.
      motionState: 'unknown',
      isSpotCheck: false,
    };
    addPending(sample);
    if (s.timestampSec > newestRaw) newestRaw = s.timestampSec;
  }
  if (newestRaw > cursor.hr) {
    setVitalCursor(deviceBleId, 'hr', newestRaw);
  }
  return fresh.length;
}

async function syncSpO2Step(
  device: UrionDevice,
  deviceBleId: string,
  nowSec: number,
): Promise<number> {
  const todayLocal = dayLocalFromNow(nowSec);
  // Bug fix (caught on-device 2026-05-08): the original Sprint 7.5
  // implementation short-circuited when `cursor.spo2 === todayLocal`,
  // which locked out same-day re-reads after the very first sync of
  // the day. Watch SpO2 samples accumulate across the day; the lockout
  // meant new samples never reached the slice until the next calendar
  // day. We now always read; the slice dedupes by measuredAtSec so
  // already-known samples are no-ops.
  const samples = await readSpO2History(device, {
    dayTimestampSec: dayStartSec(nowSec),
  });
  if (samples.length === 0) {
    // Cursor still advances — empty days are valid "synced" days.
    setVitalCursor(deviceBleId, 'spo2', todayLocal);
    return 0;
  }
  const addPending = useSpO2.getState().addPending;
  for (const s of samples) {
    const sample: SpO2Sample = {
      measuredAtSec: watchTimestampToUtcSec(s.timestampSec),
      percent: s.percent,
      maxInWindow: s.maxInWindow,
      minInWindow: s.minInWindow,
      sampleWindowSec: SPO2_DEFAULT_WINDOW_SEC,
      isSpotCheck: false,
      // 0x2D doesn't expose perfusion index per sample.
      perfusionIndex: null,
    };
    addPending(sample);
  }
  setVitalCursor(deviceBleId, 'spo2', todayLocal);
  return samples.length;
}

async function syncSleepStep(
  device: UrionDevice,
  deviceBleId: string,
  nowSec: number,
): Promise<number> {
  const todayLocal = dayLocalFromNow(nowSec);
  const cursor = getVitalCursor(deviceBleId);
  if (cursor.sleep === todayLocal) return 0;
  // daysAgo=0 — last completed sleep ending this morning. The 0x07 reply
  // returns the day's totals; we DON'T re-pull yesterday because the
  // session that ended this morning is reported under today's date.
  const info = await readDayInfo(device, { daysAgo: 0 });
  if (!info.sleep || info.sleep.totalMinutes === 0) {
    setVitalCursor(deviceBleId, 'sleep', todayLocal);
    return 0;
  }
  const dayLocal = dayLocalFromBcd(
    info.sleep.yearOfCentury,
    info.sleep.month,
    info.sleep.day,
  );
  const dayStart = unixSecFromDayLocal(dayLocal);
  // Synthesize session boundaries (see file header §"simplifications"):
  // sessionEnd = day 08:00 UTC (proxy for "this morning's wake"),
  // sessionStart = sessionEnd - totalMinutes.
  const sessionEndSec = dayStart + 8 * 3600;
  const sessionStartSec = sessionEndSec - info.sleep.totalMinutes * 60;
  const session: SleepSession = {
    sessionStartSec,
    sessionEndSec,
    sessionStartLocal: new Date(sessionStartSec * 1000).toISOString(),
    sessionEndLocal: new Date(sessionEndSec * 1000).toISOString(),
    totalMinutes: info.sleep.totalMinutes,
    deepMinutes: info.sleep.deepMinutes,
    remMinutes: 0, // 0x07 doesn't expose REM; classifier handles 0 gracefully
    lightMinutes: info.sleep.lightMinutes,
    awakeMinutes: 0,
    awakeCount: 0,
    transitions: [] as { atSec: number; stage: SleepStage }[],
    sleepScore: 0, // computed by classifier downstream
  };
  useSleep.getState().addPending(session);
  setVitalCursor(deviceBleId, 'sleep', todayLocal);
  return 1;
}

async function syncActivityStep(
  device: UrionDevice,
  deviceBleId: string,
  nowSec: number,
): Promise<number> {
  const todayLocal = dayLocalFromNow(nowSec);
  // Bug fix (caught on-device 2026-05-08): the original Sprint 7.5
  // implementation short-circuited when `cursor.activity === todayLocal`,
  // which locked out same-day re-reads. The watch's day-step total
  // grows throughout the day; the lockout meant the first sync of the
  // day (often with steps=0) was the only chance to capture activity.
  // The slice dedupes by dayLocal so re-reading + replacing today's
  // row is the right behaviour. Cursor still advances at the end so
  // backfill loops (Sprint 7.7+) can reason about "we've seen today".
  const info = await readDayInfo(device, { daysAgo: 0 });
  if (!info.activity) {
    setVitalCursor(deviceBleId, 'activity', todayLocal);
    return 0;
  }
  const dayLocal = dayLocalFromBcd(
    info.activity.yearOfCentury,
    info.activity.month,
    info.activity.day,
  );
  const dayStart = unixSecFromDayLocal(dayLocal);
  const activityDay: ActivityDay = {
    dayLocal,
    measuredAtSec: dayStart,
    totalSteps: info.activity.totalSteps,
    targetSteps: 6000, // D13 §15.4 Q-D13-1 default; orchestrator overrides when Settings UI ships
    lastSampleAtSec: dayStart + 23 * 3600 + 59 * 60,
    // Sprint 7.5 limitation: per-hour distribution comes from the
    // 0x73 0x04 step-event notify path, not 0x07. Filled with zeros
    // until that path is wired.
    hourly: new Array<number>(24).fill(0),
  };
  const caloriesDay: CaloriesDay = {
    dayLocal,
    measuredAtSec: dayStart,
    totalKcal: info.activity.totalKcal,
    // 0x07 doesn't split active vs basal; until setUserParams gives us
    // BMR-input data we attribute the total to activity.
    activityKcal: info.activity.totalKcal,
    bmrKcal: 0,
    targetKcal: null,
  };
  useActivity.getState().addPendingSteps(activityDay);
  useActivity.getState().addPendingCalories(caloriesDay);
  setVitalCursor(deviceBleId, 'activity', todayLocal);
  return 1;
}

// ────────────────────────────────────────────────────────────────────
// Pipeline entry point.

export async function syncMultiVitals(
  device: UrionDevice,
  deviceBleId: string,
  deviceMeta: DeviceMeta,
  options: { nowSec?: number } = {},
): Promise<SyncMultiVitalsResult> {
  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const errors: Record<string, string> = {};
  const pulled = { hr: 0, spo2: 0, sleep: 0, activity: 0 };

  // Steps 2-3 — dirty-tracked writers. Stubbed for Sprint 7.5: always
  // returns false (no-op) until Settings UI lands.

  // Steps 5-8 — per-vital reads. Promise.allSettled isolates failures
  // (one vital error doesn't block the others). Each step manages its
  // own cursor + pending-buffer push.
  const [hrR, spo2R, sleepR, actR] = await Promise.allSettled([
    syncHRStep(device, deviceBleId, nowSec),
    syncSpO2Step(device, deviceBleId, nowSec),
    syncSleepStep(device, deviceBleId, nowSec),
    syncActivityStep(device, deviceBleId, nowSec),
  ]);
  if (hrR.status === 'fulfilled') pulled.hr = hrR.value;
  else errors.hr = hrR.reason instanceof Error ? hrR.reason.message : String(hrR.reason);
  if (spo2R.status === 'fulfilled') pulled.spo2 = spo2R.value;
  else errors.spo2 = spo2R.reason instanceof Error ? spo2R.reason.message : String(spo2R.reason);
  if (sleepR.status === 'fulfilled') pulled.sleep = sleepR.value;
  else errors.sleep = sleepR.reason instanceof Error ? sleepR.reason.message : String(sleepR.reason);
  if (actR.status === 'fulfilled') pulled.activity = actR.value;
  else errors.activity = actR.reason instanceof Error ? actR.reason.message : String(actR.reason);

  // Build the batched payload from the slices' pending arrays.
  const hrPending = useHR.getState().pending;
  const spo2Pending = useSpO2.getState().pending;
  const sleepPending = useSleep.getState().pending;
  const stepsPending = useActivity.getState().pendingSteps;
  const caloriesPending = useActivity.getState().pendingCalories;

  const payload: MultiVitalsPayload = {
    device: deviceMeta,
    hrSamples: hrPending.length ? hrPending : undefined,
    spo2Samples: spo2Pending.length ? spo2Pending : undefined,
    sleepSessions: sleepPending.length ? sleepPending : undefined,
    activityDays: stepsPending.length ? stepsPending : undefined,
    caloriesDays: caloriesPending.length ? caloriesPending : undefined,
    clientSyncedAtSec: nowSec,
    clientAppVersion: APP_VERSION,
  };

  if (isPayloadEmpty(payload)) {
    return {
      ok: Object.keys(errors).length === 0,
      errors,
      pulled,
      inserted: null,
    };
  }

  try {
    const response = await postMultiVitals(payload);
    // Move pending → recent on each slice using the keys we pushed.
    // The /sync response gives us insert/duplicate counts; treat any
    // sample we sent as accepted (the server has it; cursor already
    // advanced; whether THIS request inserted vs found-as-duplicate
    // is irrelevant for client-side state).
    if (hrPending.length) {
      useHR.getState().acceptSyncResult(
        hrPending.map((s) => String(s.measuredAtSec)),
      );
    }
    if (spo2Pending.length) {
      useSpO2.getState().acceptSyncResult(
        spo2Pending.map((s) => String(s.measuredAtSec)),
      );
    }
    if (sleepPending.length) {
      useSleep.getState().acceptSyncResult(
        sleepPending.map((s) => String(s.sessionStartSec)),
      );
    }
    if (stepsPending.length) {
      useActivity.getState().acceptStepsSyncResult(
        stepsPending.map((d) => d.dayLocal),
      );
    }
    if (caloriesPending.length) {
      useActivity.getState().acceptCaloriesSyncResult(
        caloriesPending.map((d) => d.dayLocal),
      );
    }
    logger.track('vital_sync_accepted', {
      vital_type: 'hr',
      count: response.inserted.hr,
    });
    return {
      ok: Object.keys(errors).length === 0,
      errors,
      pulled,
      inserted: response.inserted,
    };
  } catch (e) {
    errors.sync = e instanceof Error ? e.message : 'sync failed';
    return { ok: false, errors, pulled, inserted: null };
  }
}
