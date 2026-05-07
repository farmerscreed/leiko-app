// Take-Reading store — Sprint 6.
//
// Drives the in-app "Take a reading" flow per Option 1 of the Sprint 6
// proposal: the U16PRO protocol has no remote-trigger BP command, so
// the app cannot tell the watch to inflate. Flow:
//
//   1. User taps the "Take a reading" FAB → begin().
//   2. begin() reconnects to the persisted device, subscribes to 0x73
//      notifications, waits for the 0x73 0x02 (BP-ready) signal.
//   3. Parent presses the BP button on the watch → watch inflates,
//      measures, fires 0x73 0x02.
//   4. Notify handler runs readLatestBP via 0x14, builds a
//      LocalReading, writes to the readings store (which classifies +
//      persists to MMKV synchronously + best-effort syncs to /sync).
//   5. UI renders success view; user taps Done → exit().
//
// Manual entry skips the watch entirely: addManualReading() validates
// + writes directly to the readings store.
//
// Connection lifecycle: this store owns the in-flight UrionDevice
// while the take-reading sheet is open and disconnects on exit.
// Pairing-store's pairedDevice is the read-only source of truth for
// what to connect to.

import { create } from 'zustand';
import { connectToUrion } from '../services/ble/bleManager';
import { subscribeToNotifications } from '../services/ble/notify';
import type { UrionDevice } from '../services/ble/UrionDevice';
import { syncBacklog } from '../services/sync/syncBacklog';
import { logger } from '../services/analytics/logger';
import { usePairing } from './pairing';
import { useReadings, type LocalReading } from './readings';

export type TakeReadingPhase =
  | 'idle'
  | 'connecting'
  | 'waiting_for_watch'
  | 'fetching'
  | 'success'
  | 'failure';

export type TakeReadingError =
  | { code: 'no_paired_device'; friendly: string }
  | { code: 'connect_failed'; friendly: string }
  | { code: 'no_reading'; friendly: string }
  | { code: 'fetch_failed'; friendly: string }
  | { code: 'watch_timeout'; friendly: string };

const FRIENDLY: Record<TakeReadingError['code'], string> = {
  no_paired_device: 'Pair the watch first, then take a reading.',
  connect_failed:
    "We couldn't reach the watch. Bring the phone closer and try again.",
  no_reading:
    "We couldn't get a clean reading. Make sure the cuff is snug and try again.",
  fetch_failed:
    "We couldn't read from the watch. Bring the phone closer and try again.",
  watch_timeout:
    "We didn't see a reading. Press the BP button on the watch when you're ready.",
};

const WATCH_TIMEOUT_MS = 90_000;
const FETCH_TIMEOUT_MS = 10_000;

interface TakeReadingState {
  phase: TakeReadingPhase;
  error: TakeReadingError | null;
  /** localId of the just-captured reading; set on success. */
  lastReadingId: string | null;

  _device: UrionDevice | null;
  _unsubscribeNotify: (() => void) | null;
  _watchTimer: ReturnType<typeof setTimeout> | null;

  begin: () => Promise<void>;
  addManualReading: (input: {
    systolic: number;
    diastolic: number;
    pulse: number | null;
    measuredAtSec?: number;
  }) => LocalReading;
  retry: () => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
  // Internal — called from the notify subscription + lifecycle teardown.
  // Surfaced on the type so the implementation can call them via
  // `get()`; intentionally omitted from PublicTakeReadingState.
  _onBPReady: () => Promise<void>;
  _teardownDevice: () => Promise<void>;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export const useTakeReading = create<TakeReadingState>((set, get) => ({
  phase: 'idle',
  error: null,
  lastReadingId: null,
  _device: null,
  _unsubscribeNotify: null,
  _watchTimer: null,

  begin: async () => {
    const paired = usePairing.getState().pairedDevice;
    if (!paired) {
      console.log('[take-reading] begin: no paired device');
      set({
        phase: 'failure',
        error: { code: 'no_paired_device', friendly: FRIENDLY.no_paired_device },
      });
      return;
    }
    console.log('[take-reading] begin: connecting to', paired.bleId);
    set({ phase: 'connecting', error: null, lastReadingId: null });
    logger.track('take_reading_started', { trigger: 'fab' });

    try {
      const device = await connectToUrion(paired.bleId);
      console.log('[take-reading] connected; running backlog sync');
      set({ _device: device });
      // Cursor-aware backfill: pull anything captured on the watch
      // since the last successful sync. Silent (no UI change) — the
      // user still sees the waiting_for_watch view and presses the
      // button for a fresh reading. Any backfilled rows surface on
      // home via the readings store + ReadingCard.
      try {
        const result = await syncBacklog(device, paired.bleId);
        console.log(
          `[take-reading] backlog sync pulled ${result.pulled} reading(s)`,
        );
      } catch (e) {
        // Backlog sync failure shouldn't block the live-capture flow —
        // the watch still works for the new reading the user is about
        // to take. Log and continue.
        console.log('[take-reading] backlog sync failed:', e);
      }
      console.log('[take-reading] subscribing to notifications');
      const unsub = subscribeToNotifications(device, {
        onBP: () => {
          console.log('[take-reading] 0x73 0x02 BP-ready notification received');
          void get()._onBPReady();
        },
      });
      // If the GATT link drops while we're still waiting (watch went
      // out of range, OS BT stack hiccup, stock Urion app jumped in),
      // fail loudly instead of sitting on the spinner until the 90s
      // watch_timeout fires.
      const unsubDisconnect = device.onDisconnected(() => {
        if (get().phase !== 'waiting_for_watch') return;
        console.log('[take-reading] device disconnected mid-wait');
        if (get()._watchTimer) clearTimeout(get()._watchTimer!);
        set({
          phase: 'failure',
          error: { code: 'connect_failed', friendly: FRIENDLY.connect_failed },
          _device: null,
          _unsubscribeNotify: null,
          _watchTimer: null,
        });
      });
      // Wrap the original unsub to also clear the disconnect listener.
      const wrappedUnsub = () => {
        unsub();
        unsubDisconnect();
      };
      const timer = setTimeout(() => {
        if (get().phase === 'waiting_for_watch') {
          console.log('[take-reading] watch timeout — no BP-ready in 90s');
          logger.track('take_reading_failed', { reason: 'watch_timeout' });
          set({
            phase: 'failure',
            error: { code: 'watch_timeout', friendly: FRIENDLY.watch_timeout },
          });
          void get().cancel();
        }
      }, WATCH_TIMEOUT_MS);
      console.log('[take-reading] phase: waiting_for_watch (press the BP button)');
      set({
        phase: 'waiting_for_watch',
        _unsubscribeNotify: wrappedUnsub,
        _watchTimer: timer,
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'unknown';
      console.log('[take-reading] connect failed:', reason);
      logger.track('take_reading_failed', { reason: `connect:${reason}` });
      set({
        phase: 'failure',
        error: { code: 'connect_failed', friendly: FRIENDLY.connect_failed },
        _device: null,
      });
    }
  },

  // INTERNAL — fired by the 0x73 0x02 notify handler. Re-runs the
  // backlog sync, which catches the just-captured reading plus
  // anything else buffered since lastSync. The just-captured one is
  // the newest (highest timestampSec); we surface it as the success
  // view's hero numeric via useReadings.latest().
  _onBPReady: async () => {
    const { _device, _watchTimer } = get();
    if (!_device) return;
    const paired = usePairing.getState().pairedDevice;
    if (!paired) return;
    if (_watchTimer) clearTimeout(_watchTimer);
    set({ phase: 'fetching', _watchTimer: null });
    try {
      const before = useReadings.getState().latest();
      const result = await syncBacklog(_device, paired.bleId, {
        timeoutMs: FETCH_TIMEOUT_MS,
      });
      if (result.pulled === 0) {
        // Watch fired the notify but the read returned nothing new —
        // either a stale notify or the cursor is ahead of the firmware.
        logger.track('take_reading_failed', { reason: 'no_reading' });
        set({
          phase: 'failure',
          error: { code: 'no_reading', friendly: FRIENDLY.no_reading },
        });
        return;
      }
      const after = useReadings.getState().latest();
      const newest = after && after !== before ? after : before;
      logger.track('take_reading_received', { source: 'watch' });
      set({
        phase: 'success',
        lastReadingId: newest?.localId ?? null,
      });
      // Connection's job is done; release it so the watch+phone
      // batteries don't drain on an idle GATT link. Sprint 7 sync
      // orchestrator re-attaches on demand.
      void get()._teardownDevice();
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'unknown';
      logger.track('take_reading_failed', { reason: `fetch:${reason}` });
      set({
        phase: 'failure',
        error: { code: 'fetch_failed', friendly: FRIENDLY.fetch_failed },
      });
    }
  },

  addManualReading: (input) => {
    const measuredAtSec = input.measuredAtSec ?? nowSec();
    logger.track('take_reading_started', { trigger: 'manual_sheet' });
    const row = useReadings.getState().addPendingReading({
      measuredAtSec,
      systolic: input.systolic,
      diastolic: input.diastolic,
      pulse: input.pulse,
      source: 'manual',
      deviceBleId: null,
    });
    logger.track('take_reading_received', { source: 'manual' });
    set({ phase: 'success', lastReadingId: row.localId, error: null });
    return row;
  },

  retry: async () => {
    void get()._teardownDevice();
    set({ phase: 'idle', error: null, lastReadingId: null });
    await get().begin();
  },

  cancel: async () => {
    void get()._teardownDevice();
    set({ phase: 'idle', error: null });
  },

  reset: () => {
    void get()._teardownDevice();
    set({ phase: 'idle', error: null, lastReadingId: null });
  },

  _teardownDevice: async () => {
    const { _unsubscribeNotify, _watchTimer, _device } = get();
    if (_watchTimer) clearTimeout(_watchTimer);
    if (_unsubscribeNotify) _unsubscribeNotify();
    if (_device) {
      try { await _device.disconnect(); } catch { /* already gone */ }
    }
    set({ _device: null, _unsubscribeNotify: null, _watchTimer: null });
  },
}));

// TS: the store has private _ methods used internally. Augment the
// public type so call sites only see the documented surface.
export type PublicTakeReadingState = Omit<
  TakeReadingState,
  | '_device'
  | '_unsubscribeNotify'
  | '_watchTimer'
  | '_onBPReady'
  | '_teardownDevice'
>;
