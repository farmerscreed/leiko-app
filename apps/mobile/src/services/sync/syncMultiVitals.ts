// Multi-vitals sync pipeline — Sprint 7.5 / D13 §3.3, multi-day
// backfill added in Sprint 9 / D13 §3.4.
//
// Runs AFTER syncBacklogToCompletion (BP path) on every successful
// reconnect. Implements steps 5–8 of the D13 §3.3 sequence:
//   1. setTime                          (handled by syncBacklog)
//   2. setUserParams (dirty)             (stub for Sprint 7.5 — Settings UI lands later)
//   3. setGoals (dirty)                  (stub for Sprint 7.5)
//   4. readBPHistory                     (handled by syncBacklog)
//   5. readHRHistory                     ← here, looped per missing day
//   6. readSpO2History                   ← here, looped per missing day
//   7-8. readDayInfo (sleep + activity)  ← here, ONE call per day routed to both slices
//
// Failures are isolated via Promise.allSettled across the three step
// branches (HR, SpO2, DayInfo); one branch's failure does not block
// the others. Within a branch, the per-day loop advances the cursor
// after each successful day so partial backfills resume on the next
// reconnect.
//
// After all reads settle, the pipeline batches the slices' pending
// arrays into a single MultiVitalsPayload and posts to /sync. On
// success, each slice's acceptSyncResult moves rows from pending →
// recent and clears the corresponding MMKV pending entries. On
// failure, samples stay in pending; the next reconnect retries the
// network leg (the per-vital cursor already advanced, so the watch
// won't be re-read).
//
// Backfill rules (per vital):
//   • HR: cursor.hr is a watch-firmware second; backfill list includes
//     cursor's own day so intra-day samples newer than cursor.hr can be
//     picked up. Per-sample dedup via cursor.hr threshold + the slice's
//     measuredAtSec dedup. Today is always re-read.
//   • SpO2: cursor.spo2 is YYYY-MM-DD of last fully-synced day; backfill
//     list is (cursor+1 .. yesterday) plus today (always re-read; same-
//     day samples accumulate as the day progresses).
//   • Sleep: cursor.sleep is YYYY-MM-DD; backfill list is (cursor+1 ..
//     today). Last-night totals don't change once captured, so when
//     cursor === today we skip — no always-include-today rule.
//   • Activity: cursor.activity is YYYY-MM-DD; backfill list is
//     (cursor+1 .. yesterday) plus today (today's step total grows
//     throughout the day).
// The three day-cursor vitals share a single readDayInfo per day
// (request returns both sleep + activity reply packets) — the union
// of sleep-days and activity-days drives the loop.
//
// Sprint 7.5 simplifications still in force (flagged for follow-up
// sprints):
//   • Sleep session boundaries are synthesized from totalMinutes (the
//     0x07 reply doesn't expose start/end). sessionEnd = day 08:00 UTC,
//     sessionStart = sessionEnd - totalMinutes. Score's efficiency
//     component is therefore 1.0 on real-watch data — flagged in D13
//     §15.4 Q-D13-3.
//   • Activity hourly[24] = zeros. Per-hour distribution requires a
//     different ingest path (raw step samples via 0x73 0x04 notify) —
//     to be wired by a later sprint.
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
  watchVitalTimestampToUtcSec,
} from './syncBacklog';
import { postMultiVitals, isPayloadEmpty } from './postMultiVitals';
import { applyDeviceConfig } from './applyDeviceConfig';
import {
  bumpVitalFailure,
  clearVitalFailure,
  isVitalBackoffActive,
} from './syncFailureTracker';
import { forwardMultiVitalsToPlatform } from '../health-platform/syncBridge';
import { useHR } from '../../state/hr';
import { useSpO2 } from '../../state/spo2';
import { useSleep } from '../../state/sleep';
import { useActivity } from '../../state/activity';
import { logger } from '../analytics/logger';
import { userTz } from '../../utils/userTz';
import { inferWakeFromHR } from '../sleep/inferWakeFromHR';
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

// BLE_TRACE — Sprint 16.5a Phase A forensic-capture instrumentation.
// See apps/mobile/src/services/ble/UrionDevice.ts for the convention.
const BLE_TRACE = typeof __DEV__ !== 'undefined' && __DEV__;

const APP_VERSION = '0.0.1'; // bumped via package.json on release
// Sprint 18 / QUA-2 — removed HR_FALLBACK_WINDOW_SEC (was 30 * 60).
// readHRHistory now always returns intervalSec (5 min on U19M_013C,
// confirmed by Sprint 16.5b traces). On the no-data branch both
// intervalSec and samples are 0 together, so no fallback is reachable.
const SPO2_DEFAULT_WINDOW_SEC = 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;

/** First-connect look-back window. The watch's protocol §4.3 supports
 *  daysAgo up to 10; we default to 7 days so fresh users see a working
 *  Trends baseline immediately while staying inside the protocol cap. */
export const DEFAULT_FIRST_SYNC_DAYS = 7;

/** Hard cap on backfill window — matches U16PRO §4.3 daysAgo support. */
export const MAX_BACKFILL_DAYS = 10;

export interface SyncMultiVitalsOptions {
  /** Override the wall-clock used for "today" — test seam. */
  nowSec?: number;
  /** Days to look back when a vital's cursor is empty (first connect).
   *  Default DEFAULT_FIRST_SYNC_DAYS. Capped at maxBackfillDays. */
  firstSyncDays?: number;
  /** Hard ceiling on the look-back window. Default MAX_BACKFILL_DAYS. */
  maxBackfillDays?: number;
}

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

function dayLocalFromBcd(yc: number, month: number, day: number): string {
  const yyyy = 2000 + yc;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function unixSecFromDayLocal(dayLocal: string): number {
  return Math.floor(new Date(`${dayLocal}T00:00:00Z`).getTime() / 1000);
}

/** Add (or subtract) whole days to a YYYY-MM-DD string. UTC math. */
function addDays(dayLocal: string, n: number): string {
  const ms = new Date(`${dayLocal}T00:00:00Z`).getTime() + n * SECONDS_PER_DAY * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Inclusive list of YYYY-MM-DD from start to end. Empty when start > end. */
function enumerateDays(start: string, end: string): string[] {
  const out: string[] = [];
  let d = start;
  while (d <= end) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

/** Whole-day distance from `earlier` to `later`. Used to derive the
 *  watch's `daysAgo` argument for any target day. */
function countDaysBetween(earlier: string, later: string): number {
  const a = new Date(`${earlier}T00:00:00Z`).getTime();
  const b = new Date(`${later}T00:00:00Z`).getTime();
  return Math.round((b - a) / (SECONDS_PER_DAY * 1000));
}

interface DayListOpts {
  firstSyncDays: number;
  maxBackfillDays: number;
  /** Include cursor's own day in the list. HR uses true (intra-day
   *  samples newer than cursor.hr can still arrive on cursor's day);
   *  day-cursor vitals use false (cursor's day is fully synced). */
  inclusiveCursorDay: boolean;
  /** Append today regardless of cursor. SpO2 / Activity / HR use true
   *  (same-day data grows). Sleep uses false (last-night totals don't
   *  change once captured). */
  alwaysIncludeToday: boolean;
}

/** Compute the inclusive list of YYYY-MM-DD days the orchestrator
 *  should pull for a given vital. Empty list = nothing to do. */
export function computeBackfillDayList(
  cursorDayLocal: string,
  todayLocal: string,
  opts: DayListOpts,
): string[] {
  const earliestAllowed = addDays(todayLocal, -(opts.maxBackfillDays - 1));
  let start: string;
  if (!cursorDayLocal) {
    start = addDays(todayLocal, -(opts.firstSyncDays - 1));
  } else {
    start = opts.inclusiveCursorDay
      ? cursorDayLocal
      : addDays(cursorDayLocal, 1);
  }
  if (start < earliestAllowed) start = earliestAllowed;

  let days: string[] = [];
  if (start <= todayLocal) {
    days = enumerateDays(start, todayLocal);
  }
  if (
    opts.alwaysIncludeToday &&
    (days.length === 0 || days[days.length - 1] !== todayLocal)
  ) {
    days.push(todayLocal);
  }
  return days;
}

function resolveBackfillOptions(
  options: SyncMultiVitalsOptions,
): { firstSyncDays: number; maxBackfillDays: number } {
  const maxBackfillDays = Math.max(
    1,
    Math.min(options.maxBackfillDays ?? MAX_BACKFILL_DAYS, MAX_BACKFILL_DAYS),
  );
  const firstSyncDays = Math.max(
    1,
    Math.min(options.firstSyncDays ?? DEFAULT_FIRST_SYNC_DAYS, maxBackfillDays),
  );
  return { firstSyncDays, maxBackfillDays };
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
  options: SyncMultiVitalsOptions,
): Promise<number> {
  const { firstSyncDays, maxBackfillDays } = resolveBackfillOptions(options);
  const todayLocal = dayLocalFromNow(nowSec);
  const cursor = getVitalCursor(deviceBleId);

  // Sprint 16.5c — `cursor.hr` holds the watch's raw timestamp for the
  // newest HR sample we've ingested. HR/SpO2 use a DIFFERENT firmware
  // encoding than BP: the day-anchor is echoed back and per-sample
  // timestamps are `dayStart + i × intervalSec` where `dayStart` is
  // interpreted as `wall-clock-display-as-UTC`. To get TRUE UTC we
  // subtract the user's local offset — encapsulated in
  // `watchVitalTimestampToUtcSec`. (The BP +8h "Beijing wall clock"
  // shift `watchTimestampToUtcSec` is wrong here — that one is for the
  // 0x14 packet's TS field only.)
  const cursorDayLocal = cursor.hr > 0 ? dayLocalFromNow(watchVitalTimestampToUtcSec(cursor.hr)) : '';

  const days = computeBackfillDayList(cursorDayLocal, todayLocal, {
    firstSyncDays,
    maxBackfillDays,
    inclusiveCursorDay: true,
    alwaysIncludeToday: true,
  });

  if (BLE_TRACE) {
    console.log(
      `[ble-trace] syncMultiVitals.hr enter cursor.hr=${cursor.hr} days=[${days.join(',')}]`,
    );
  }

  const addPendingBatch = useHR.getState().addPendingBatch;
  let newestRaw = cursor.hr;
  let totalPulled = 0;

  for (const day of days) {
    const result = await readHRHistory(device, {
      dayTimestampSec: unixSecFromDayLocal(day),
    });
    const { samples, intervalSec: rawIntervalSec } = result;
    // Sprint 18 / QUA-2 — the watch's index packet always reports
    // intervalSec when samples are present (5 min on U19M_013C). No
    // fallback needed; when intervalSec is 0 the watch also returns
    // an empty samples array, so the loop below is a no-op.
    const sampleWindowSec = rawIntervalSec;
    if (BLE_TRACE) {
      console.log(
        `[ble-trace] syncMultiVitals.hr day=${day} readHRHistory returned ${samples.length} samples ` +
          `(intervalSec=${rawIntervalSec})`,
      );
    }
    // Invariant guard: if the watch ever returns samples WITHOUT an
    // interval, the per-sample window is undefined. Skip the day to
    // avoid persisting samples with sampleWindowSec=0 (which would
    // wedge the classifier). Should be unreachable per readHRHistory.
    if (samples.length > 0 && rawIntervalSec <= 0) {
      if (BLE_TRACE) {
        console.warn(
          `[ble-trace] syncMultiVitals.hr day=${day} skipped — samples without intervalSec`,
        );
      }
      continue;
    }
    // Sample-level dedup: keep only samples newer than cursor.hr.
    const fresh =
      cursor.hr > 0
        ? samples.filter((s) => s.timestampSec > cursor.hr)
        : samples;
    // Build the day's samples in memory, then persist in ONE batch.
    // Per-sample addPending caused an O(n^2) MMKV + render storm on
    // cold-start backfill (~1,800 samples) that froze the home.
    const batch: HRSample[] = [];
    for (const s of fresh) {
      const sample: HRSample = {
        // Sprint 16.5c: HR raw timestamps from the watch encode
        // `wall_clock_display_as_UTC`. For TRUE UTC we subtract the
        // user's local-offset (`watchVitalTimestampToUtcSec`). The BP
        // +7h Beijing shift `watchTimestampToUtcSec` was wrong here
        // (pushed samples 7 h into the future on Lagos clients) and
        // applying NO shift was also wrong (left them 1 h ahead).
        measuredAtSec: watchVitalTimestampToUtcSec(s.timestampSec),
        bpm: s.bpm,
        sampleWindowSec,
        // The 0x15 history packet does not expose motion-state per sample.
        // Classifier's sensor-error fallback ignores motion='unknown' for
        // baseline computation but still classifies extreme values.
        motionState: 'unknown',
        isSpotCheck: false,
      };
      batch.push(sample);
      if (s.timestampSec > newestRaw) newestRaw = s.timestampSec;
    }
    addPendingBatch(batch);
    totalPulled += fresh.length;
  }

  if (newestRaw > cursor.hr) {
    setVitalCursor(deviceBleId, 'hr', newestRaw);
  }
  if (BLE_TRACE) {
    console.log(
      `[ble-trace] syncMultiVitals.hr exit totalPulled=${totalPulled} newestRaw=${newestRaw}`,
    );
  }
  return totalPulled;
}

async function syncSpO2Step(
  device: UrionDevice,
  deviceBleId: string,
  nowSec: number,
  options: SyncMultiVitalsOptions,
): Promise<number> {
  const { firstSyncDays, maxBackfillDays } = resolveBackfillOptions(options);
  const todayLocal = dayLocalFromNow(nowSec);
  const cursor = getVitalCursor(deviceBleId);

  const days = computeBackfillDayList(cursor.spo2, todayLocal, {
    firstSyncDays,
    maxBackfillDays,
    inclusiveCursorDay: false,
    alwaysIncludeToday: true,
  });

  if (BLE_TRACE) {
    console.log(
      `[ble-trace] syncMultiVitals.spo2 enter cursor.spo2=${cursor.spo2 || '(empty)'} days=[${days.join(',')}]`,
    );
  }

  const addPending = useSpO2.getState().addPending;
  let totalPulled = 0;

  for (const day of days) {
    const samples = await readSpO2History(device, {
      dayTimestampSec: unixSecFromDayLocal(day),
    });
    if (BLE_TRACE) {
      console.log(
        `[ble-trace] syncMultiVitals.spo2 day=${day} readSpO2History returned ${samples.length} samples`,
      );
    }
    for (const s of samples) {
      const measuredAtSec = watchVitalTimestampToUtcSec(s.timestampSec);
      if (BLE_TRACE) {
        const isoLocal = new Date(measuredAtSec * 1000).toISOString();
        const hourLocal = new Date(measuredAtSec * 1000).getHours();
        console.log(
          `[ble-trace] spo2 store raw=${s.timestampSec} ` +
            `measuredAtSec=${measuredAtSec} percent=${s.percent} ` +
            `isoUTC=${isoLocal} getHours=${hourLocal}`,
        );
      }
      const sample: SpO2Sample = {
        // Sprint 16.5c: SpO2 encoding mirrors HR —
        // `wall_clock_display_as_UTC` raw timestamps that need the
        // user's local-offset subtracted to reach TRUE UTC.
        measuredAtSec,
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
    totalPulled += samples.length;
    // Advance per-day so a mid-loop failure leaves a resumable cursor.
    setVitalCursor(deviceBleId, 'spo2', day);
  }
  if (BLE_TRACE) {
    console.log(`[ble-trace] syncMultiVitals.spo2 exit totalPulled=${totalPulled}`);
  }
  return totalPulled;
}

/** Combined sleep + activity step. The 0x07 watch request returns both
 *  reply packets, so calling readDayInfo once per day services both
 *  vitals. Day list is the union of sleep-days and activity-days. */
async function syncDayInfoStep(
  device: UrionDevice,
  deviceBleId: string,
  nowSec: number,
  options: SyncMultiVitalsOptions,
): Promise<{ sleep: number; activity: number }> {
  const { firstSyncDays, maxBackfillDays } = resolveBackfillOptions(options);
  const todayLocal = dayLocalFromNow(nowSec);
  const cursor = getVitalCursor(deviceBleId);

  // Sprint 16.5c — `alwaysIncludeToday: true` for sleep.
  //
  // Pre-fix: sleep used `alwaysIncludeToday: false` with the rationale
  // "last-night totals don't change once captured." But the cursor
  // advanced inside the loop unconditionally — even on syncs that ran
  // before the user had actually slept (e.g., a morning sync immediately
  // after wake, before the watch's overnight session was persisted).
  // The cursor would jump to today, no sleep session was ever ingested,
  // and subsequent syncs computed an empty sleepDays list and skipped
  // today's `readDayInfo` sleep result entirely (the result kept coming
  // back from the watch but `sleepDaySet.has(day)` was false, so the
  // ingest branch was bypassed).
  //
  // Fix: always include today in sleepDays. The dayInfo branch's
  // `addPending(session)` dedupes by `sessionStartSec`, so re-pulling
  // today's sleep on every sync is idempotent. The cursor advances only
  // when there's a real session — see the `info.sleep` check below.
  const sleepDays = computeBackfillDayList(cursor.sleep, todayLocal, {
    firstSyncDays,
    maxBackfillDays,
    inclusiveCursorDay: false,
    alwaysIncludeToday: true,
  });
  const activityDays = computeBackfillDayList(cursor.activity, todayLocal, {
    firstSyncDays,
    maxBackfillDays,
    inclusiveCursorDay: false,
    alwaysIncludeToday: true,
  });

  const sleepDaySet = new Set(sleepDays);
  const activityDaySet = new Set(activityDays);
  const allDays = Array.from(
    new Set<string>([...sleepDays, ...activityDays]),
  ).sort();

  if (BLE_TRACE) {
    console.log(
      `[ble-trace] syncMultiVitals.dayInfo enter ` +
        `cursor.sleep=${cursor.sleep || '(empty)'} cursor.activity=${cursor.activity || '(empty)'} ` +
        `allDays=[${allDays.join(',')}]`,
    );
  }

  let sleepCount = 0;
  let activityCount = 0;

  for (const day of allDays) {
    const daysAgo = countDaysBetween(day, todayLocal);
    const info = await readDayInfo(device, { daysAgo });
    if (BLE_TRACE) {
      console.log(
        `[ble-trace] syncMultiVitals.dayInfo day=${day} daysAgo=${daysAgo} ` +
          `activity=${info.activity ? `steps=${info.activity.totalSteps}` : 'null'} ` +
          `sleep=${info.sleep ? `min=${info.sleep.totalMinutes}` : 'null'}`,
      );
    }

    if (sleepDaySet.has(day)) {
      if (info.sleep && info.sleep.totalMinutes > 0) {
        const dayLocal = dayLocalFromBcd(
          info.sleep.yearOfCentury,
          info.sleep.month,
          info.sleep.day,
        );
        const dayStart = unixSecFromDayLocal(dayLocal);
        // Legacy synthesized boundaries — kept as the canonical
        // sessionStartSec/sessionEndSec for server identity + client
        // dedup. Display layers prefer the `inferred*Sec` values below
        // (Sprint 18 / SLEEP_TIMEZONE_FIX_BRIEF).
        const sessionEndSec = dayStart + 8 * 3600;
        const sessionStartSec = sessionEndSec - info.sleep.totalMinutes * 60;
        // Sprint 18 — derive the display-time wake from HR samples
        // already in the slice (this ingest path runs in parallel with
        // syncHRStep, so HR for tonight may or may not be present yet;
        // when not, we fall back to a tz-aware 07:00-local synthesis
        // and the reconcile hook upgrades the session once HR catches
        // up). The legacy `sessionStartSec`/`sessionEndSec` are
        // untouched to preserve dedup identity.
        const tz = userTz();
        const hrState = useHR.getState();
        const hrSamples = [...hrState.pending, ...hrState.recent];
        const inferred = inferWakeFromHR(
          hrSamples,
          dayLocal,
          info.sleep.totalMinutes,
          tz,
        );
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
          inferredSessionStartSec: inferred.sessionStartSec,
          inferredSessionEndSec: inferred.sessionEndSec,
          wakeSource: inferred.source,
        };
        useSleep.getState().addPending(session);
        sleepCount += 1;
        // Sprint 16.5c — only advance the cursor when we actually
        // ingested a session. The pre-fix code advanced unconditionally,
        // so a sync that ran before the user had slept (or before the
        // watch had persisted the overnight session) burned today's
        // chance and locked out the eventual real session.
        setVitalCursor(deviceBleId, 'sleep', day);
      } else if (BLE_TRACE) {
        console.log(
          `[ble-trace] syncMultiVitals.dayInfo day=${day} sleep skipped ` +
            `(info.sleep=${info.sleep ? `min=${info.sleep.totalMinutes}` : 'null'}); cursor NOT advanced`,
        );
      }
    }

    if (activityDaySet.has(day)) {
      if (info.activity) {
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
          // Per-hour distribution comes from the 0x73 0x04 step-event notify
          // path, not 0x07. Filled with zeros until that path is wired.
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
        activityCount += 1;
      }
      setVitalCursor(deviceBleId, 'activity', day);
    }
  }

  if (BLE_TRACE) {
    console.log(
      `[ble-trace] syncMultiVitals.dayInfo exit sleepCount=${sleepCount} activityCount=${activityCount}`,
    );
  }
  return { sleep: sleepCount, activity: activityCount };
}

/** Sprint 16.5b — Edge Function CPU-soft-limit-safe HR chunk size.
 *  Empirically (2026-05-13 scenario 07 + 08 traces): the Supabase Deno
 *  isolate's CPU soft limit (~200ms) kills POSTs of ~300+ samples even
 *  when the rest of the payload is small. 100 HR samples/chunk → ~30
 *  POSTs for a worst-case 3000-sample backfill. The other vital arrays
 *  (SpO2 ~120/day, Sleep 7-10/week, Activity ~10/day) go in a SEPARATE
 *  first POST with NO HR samples — keeps the small-vitals POST bounded
 *  and decouples it from the HR backfill loop. */
const MULTIVITALS_HR_CHUNK_SIZE = 100;

function chunkArray<T>(arr: T[] | undefined, size: number): T[][] {
  if (!arr || arr.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function emptyCounts(): MultiVitalsCounts {
  return { bp: 0, hr: 0, spo2: 0, sleep: 0, steps: 0, calories: 0 };
}

function addCounts(a: MultiVitalsCounts, b: MultiVitalsCounts): MultiVitalsCounts {
  return {
    bp: a.bp + b.bp,
    hr: a.hr + b.hr,
    spo2: a.spo2 + b.spo2,
    sleep: a.sleep + b.sleep,
    steps: a.steps + b.steps,
    calories: a.calories + b.calories,
  };
}

/** Type alias so the local helpers above can reference the shape without
 *  pulling postMultiVitals's import (which is already imported below). */
type MultiVitalsCounts = {
  bp: number;
  hr: number;
  spo2: number;
  sleep: number;
  steps: number;
  calories: number;
};

/**
 * Sprint 16.5b — chunked POST that respects the Supabase Edge Function's
 * CPU soft limit. The HR array (which can hold thousands of samples after
 * a long offline period or a fresh-install backfill) is split into
 * MULTIVITALS_CHUNK_SIZE-sized batches; SpO2 / sleep / activity / calories
 * ride in the FIRST chunk only.
 *
 * Each chunk acceptSyncResult's its own slice ONLY after the chunk's
 * POST succeeds. A mid-stream failure aborts the loop and re-throws —
 * the unsent slices stay in pending for the next sync.
 *
 * Returns aggregate `MultiVitalsResponse` shape so the caller's
 * `inserted` count reflects all chunks combined.
 */
async function postMultiVitalsChunked(
  basePayload: MultiVitalsPayload,
  hrPending: HRSample[],
  spo2Pending: SpO2Sample[],
  sleepPending: SleepSession[],
  stepsPending: ActivityDay[],
  caloriesPending: CaloriesDay[],
): Promise<{ deviceId: string; inserted: MultiVitalsCounts; rejected: MultiVitalsCounts; duplicates: MultiVitalsCounts }> {
  let deviceId = '';
  let totalInserted: MultiVitalsCounts = emptyCounts();
  let totalRejected: MultiVitalsCounts = emptyCounts();
  let totalDuplicates: MultiVitalsCounts = emptyCounts();

  // Phase 1 — the "small vitals" POST. SpO2 (~120/day) + Sleep (~7-10
  // entries) + Activity (~10 days) + Calories (~10 days). NO HR samples.
  // Bounded enough to fit comfortably under the Edge Function CPU budget.
  if (
    spo2Pending.length > 0 ||
    sleepPending.length > 0 ||
    stepsPending.length > 0 ||
    caloriesPending.length > 0
  ) {
    const smallVitalsPayload: MultiVitalsPayload = {
      ...basePayload,
      hrSamples: undefined,
      spo2Samples: spo2Pending.length ? spo2Pending : undefined,
      sleepSessions: sleepPending.length ? sleepPending : undefined,
      activityDays: stepsPending.length ? stepsPending : undefined,
      caloriesDays: caloriesPending.length ? caloriesPending : undefined,
    };
    const response = await postMultiVitals(smallVitalsPayload);
    deviceId = response.deviceId;
    totalInserted = addCounts(totalInserted, response.inserted);
    totalRejected = addCounts(totalRejected, response.rejected);
    totalDuplicates = addCounts(totalDuplicates, response.duplicates);
    // Drain the slices we just sent.
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
  }

  // Phase 2 — HR-only chunks. Each chunk has MULTIVITALS_HR_CHUNK_SIZE
  // samples (100). For a worst-case 3000-sample HR backfill: 30 POSTs.
  // Per-chunk validation + insert + audit-log is bounded so the CPU
  // soft limit isn't tripped.
  const hrChunks = chunkArray(hrPending, MULTIVITALS_HR_CHUNK_SIZE);
  for (const hrSlice of hrChunks) {
    if (hrSlice.length === 0) continue;
    const hrChunkPayload: MultiVitalsPayload = {
      ...basePayload,
      hrSamples: hrSlice,
      spo2Samples: undefined,
      sleepSessions: undefined,
      activityDays: undefined,
      caloriesDays: undefined,
    };
    const response = await postMultiVitals(hrChunkPayload);
    deviceId = deviceId || response.deviceId;
    totalInserted = addCounts(totalInserted, response.inserted);
    totalRejected = addCounts(totalRejected, response.rejected);
    totalDuplicates = addCounts(totalDuplicates, response.duplicates);
    useHR.getState().acceptSyncResult(
      hrSlice.map((s) => String(s.measuredAtSec)),
    );
  }

  return {
    deviceId,
    inserted: totalInserted,
    rejected: totalRejected,
    duplicates: totalDuplicates,
  };
}

// ────────────────────────────────────────────────────────────────────
// Pipeline entry point.

export async function syncMultiVitals(
  device: UrionDevice,
  deviceBleId: string,
  deviceMeta: DeviceMeta,
  options: SyncMultiVitalsOptions = {},
): Promise<SyncMultiVitalsResult> {
  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const errors: Record<string, string> = {};
  const pulled = { hr: 0, spo2: 0, sleep: 0, activity: 0 };

  // Steps 2-3 — dirty-tracked writers (D13 §3.3). Closes the Sprint
  // 7.5 stub: applyDeviceConfig flushes vitalSetup + profile state to
  // the watch (auto-HR / auto-SpO2 / user params / goals). It's a
  // best-effort step — failures don't abort the data pull. The
  // dirty-flag stays true on partial failure so the next sync retries.
  try {
    const cfg = await applyDeviceConfig(device);
    if (cfg.error) {
      // Already logged inside applyDeviceConfig; surface as a step
      // error in the result so the caller sees it without it
      // poisoning the per-vital error map.
      errors.deviceConfig = cfg.error;
    }
  } catch (e) {
    // Defensive: applyDeviceConfig is supposed to never throw, but if
    // an unexpected error escapes (e.g. profile snapshot crash), log
    // and continue.
    errors.deviceConfig = e instanceof Error ? e.message : String(e);
  }

  // Sprint 16 — per-vital exponential backoff. A vital whose previous
  // sync failed waits for `nextRetryAtMs` (in syncFailureTracker)
  // before being attempted again. Healthy vitals keep running normally.
  const nowMs = nowSec * 1000;
  const hrBackedOff = isVitalBackoffActive('hr', nowMs);
  const spo2BackedOff = isVitalBackoffActive('spo2', nowMs);
  const dayInfoBackedOff =
    isVitalBackoffActive('sleep', nowMs) &&
    isVitalBackoffActive('activity', nowMs);

  // Steps 5-8 — three branches in parallel. Per-vital error isolation
  // via Promise.allSettled. Sleep + activity share readDayInfo, so
  // they're merged into one branch (1 BLE round-trip per day instead
  // of 2 across multi-day backfill). A vital in backoff resolves to
  // `null` and records a `backed_off` error without changing the
  // failure counter.
  const hrPromise: Promise<number | null> = hrBackedOff
    ? Promise.resolve(null)
    : syncHRStep(device, deviceBleId, nowSec, options);
  const spo2Promise: Promise<number | null> = spo2BackedOff
    ? Promise.resolve(null)
    : syncSpO2Step(device, deviceBleId, nowSec, options);
  const dayInfoPromise: Promise<{ sleep: number; activity: number } | null> =
    dayInfoBackedOff
      ? Promise.resolve(null)
      : syncDayInfoStep(device, deviceBleId, nowSec, options);

  const [hrR, spo2R, dayInfoR] = await Promise.allSettled([
    hrPromise,
    spo2Promise,
    dayInfoPromise,
  ]);
  if (hrR.status === 'fulfilled') {
    if (hrR.value === null) {
      errors.hr = 'backed_off';
    } else {
      pulled.hr = hrR.value;
      clearVitalFailure('hr');
    }
  } else {
    errors.hr = hrR.reason instanceof Error ? hrR.reason.message : String(hrR.reason);
    bumpVitalFailure('hr', nowMs);
  }
  if (spo2R.status === 'fulfilled') {
    if (spo2R.value === null) {
      errors.spo2 = 'backed_off';
    } else {
      pulled.spo2 = spo2R.value;
      clearVitalFailure('spo2');
    }
  } else {
    errors.spo2 =
      spo2R.reason instanceof Error ? spo2R.reason.message : String(spo2R.reason);
    bumpVitalFailure('spo2', nowMs);
  }
  if (dayInfoR.status === 'fulfilled') {
    if (dayInfoR.value === null) {
      errors.sleep = 'backed_off';
      errors.activity = 'backed_off';
    } else {
      pulled.sleep = dayInfoR.value.sleep;
      pulled.activity = dayInfoR.value.activity;
      clearVitalFailure('sleep');
      clearVitalFailure('activity');
    }
  } else {
    const msg =
      dayInfoR.reason instanceof Error
        ? dayInfoR.reason.message
        : String(dayInfoR.reason);
    // The merged step covers both vitals; surface the failure under both.
    errors.sleep = msg;
    errors.activity = msg;
    bumpVitalFailure('sleep', nowMs);
    bumpVitalFailure('activity', nowMs);
  }

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

  // Sprint 16.5b — chunk the multi-vitals POST when the payload is
  // large. The Supabase Edge Function's CPU soft limit (~200ms) kills
  // the isolate when validation + insert + audit-log for ~3000 HR
  // samples runs in a single request. Symptom: every multi-vitals POST
  // returns "non-2xx status code" after `CPU time soft limit reached`
  // in the function log; pending arrays grow indefinitely.
  //
  // Chunking strategy: HR is the high-volume vital (5-min cadence →
  // ~250-300/day per user). Send HR in batches of MULTIVITALS_CHUNK_SIZE.
  // SpO2 / Sleep / Activity / Calories ride along in the FIRST chunk
  // only (they're small enough not to stress the function alone).
  // After each successful chunk, that slice of HR moves pending → recent.
  // Subsequent chunks run only if the previous one succeeded; first
  // failure aborts the rest (preserves pending for retry next sync).
  try {
    const response = await postMultiVitalsChunked(
      payload,
      hrPending,
      spo2Pending,
      sleepPending,
      stepsPending,
      caloriesPending,
    );
    logger.track('vital_sync_accepted', {
      vital_type: 'hr',
      count: response.inserted.hr,
    });
    // Forward to Apple Health / Health Connect — Sprint 9.5. Fire-and-
    // forget; the bridge gates on account_type + master/per-vital
    // toggles, swallows all errors. Uses the same payload we just sent
    // upstream — HK/HC dedup absorbs any sample we resend on retry.
    void forwardMultiVitalsToPlatform(payload);
    return {
      ok: Object.keys(errors).length === 0,
      errors,
      pulled,
      inserted: response.inserted,
    };
  } catch (e) {
    errors.sync = e instanceof Error ? e.message : 'sync failed';
    // Sprint 16.5b — make the upload failure VISIBLE. The orchestrator
    // historically ignored syncMultiVitals's return value, so this
    // analytics event is the only signal future bench traces have for
    // diagnosing why HR/SpO2/Sleep/Activity pending arrays accumulate.
    // Per CLAUDE.md voice + data rules: includes counts + error code,
    // never sample values.
    logger.track('multi_vitals_sync_failed', {
      reason: errors.sync,
      hr_pending: hrPending.length,
      spo2_pending: spo2Pending.length,
      sleep_pending: sleepPending.length,
      steps_pending: stepsPending.length,
      calories_pending: caloriesPending.length,
    });
    return { ok: false, errors, pulled, inserted: null };
  }
}
