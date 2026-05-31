// Pairing store — Sprint 5.
//
// Drives the UI phase machine for the watch-pairing flow and persists
// the paired device to MMKV. Wraps the BLE service helpers in
// services/ble/bleManager.ts. The lower-level connection state machine
// (services/ble/connectionMachine.ts) is reserved for Sprint 6 sync;
// pairing is a one-shot scan→connect with its own UI phases.
//
// Phases:
//   idle                — entry point; nothing happening
//   permission_prime    — explainer screen before native prompt
//   permission_denied   — user said no; we show the settings deep-link
//   bluetooth_off       — system BT off; user must enable in settings
//   power_on            — "make sure the watch is on" instruction
//   searching           — startDeviceScan running; collecting results
//   found               — user is choosing among discovered devices
//   pairing             — connectToDevice in flight
//   success             — connect succeeded; setTime sent; row persisted
//   failure             — connect or post-connect setup failed
//
// Transitions are imperative (action methods on the store). The store
// is the single source of truth for the screen layer; screens read
// `phase` + `discovered` + `selectedDevice` + `error` and call
// `startScan` / `selectDevice` / `pair` / `cancel` / `retry` / `forget`.
//
// Per CLAUDE.md: every reading is saved to MMKV before any sync attempt.
// Same rule applied here for the paired device: MMKV write happens
// synchronously on success, before any Supabase insert. Supabase row
// creation is best-effort (Sprint 6 will reconcile).

import { create } from 'zustand';
import { Platform } from 'react-native';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { logger } from '../services/analytics/logger';
import {
  connectToUrion,
  observeBluetoothState,
  requestBlePermissions,
  scanForUrion,
} from '../services/ble/bleManager';
import { setTime } from '../services/ble/commands/setTime';
import { findWatch } from '../services/ble/commands/findWatch';
import {
  startBleForegroundService,
  stopBleForegroundService,
} from '../services/ble/foregroundService';
import type { UrionDevice } from '../services/ble/UrionDevice';

export type DiscoveredDevice = {
  bleId: string;
  name: string | null;
  macSuffix: string;
};

export type PairedDevice = {
  bleId: string;
  macSuffix: string;
  name: string | null;
  pairedAt: number;
};

export type PairingError =
  | { code: 'bluetooth_off'; friendly: string }
  | { code: 'permission_denied'; friendly: string }
  | { code: 'no_watch_found'; friendly: string }
  | { code: 'connect_failed'; friendly: string }
  | { code: 'set_time_failed'; friendly: string };

export type PairingPhase =
  | 'idle'
  | 'permission_prime'
  | 'permission_denied'
  | 'bluetooth_off'
  | 'power_on'
  | 'searching'
  | 'found'
  | 'pairing'
  | 'success'
  | 'failure';

const FRIENDLY: Record<PairingError['code'], string> = {
  bluetooth_off: 'Bluetooth is off. Turn it on so we can find the watch.',
  permission_denied: 'We need Bluetooth permission to talk to the watch.',
  no_watch_found:
    "We couldn't find the watch. Bring the phone closer and make sure the watch is on.",
  connect_failed:
    "We couldn't reach the watch. Bring the phone closer and try again.",
  set_time_failed:
    "Paired, but we couldn't set the watch clock. Try pairing again.",
};

function lastFour(bleId: string): string {
  return bleId.replace(/[^0-9a-f]/gi, '').slice(-4).toLowerCase();
}

interface PairingState {
  phase: PairingPhase;
  discovered: DiscoveredDevice[];
  selectedBleId: string | null;
  pairedDevice: PairedDevice | null;
  error: PairingError | null;

  // active connection — held in memory only, not in store, to avoid
  // serialisation issues. Buzz uses the in-flight wrapper from select-
  // and-connect; pair() finalises and disconnects (re-connect on demand
  // from home/sync).
  _activeDevice: UrionDevice | null;
  _stopScan: (() => void) | null;
  _stopStateObserver: (() => void) | null;
  _scanTimeout: ReturnType<typeof setTimeout> | null;

  hydrate: () => void;
  beginPairing: () => Promise<void>;
  acknowledgePermissions: () => Promise<void>;
  confirmWatchOn: () => Promise<void>;
  startScan: () => Promise<void>;
  stopScan: () => void;
  cancel: () => void;
  selectDevice: (bleId: string) => Promise<void>;
  buzzSelected: () => Promise<void>;
  confirmPair: () => Promise<void>;
  retry: () => Promise<void>;
  forget: () => Promise<void>;
  reset: () => void;
}

export const usePairing = create<PairingState>((set, get) => ({
  phase: 'idle',
  discovered: [],
  selectedBleId: null,
  pairedDevice: null,
  error: null,
  _activeDevice: null,
  _stopScan: null,
  _stopStateObserver: null,
  _scanTimeout: null,

  hydrate: () => {
    const raw = mmkv.getString(STORAGE_KEYS.pairedDevice);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PairedDevice;
      set({ pairedDevice: parsed });
    } catch {
      // corrupt — drop silently
      mmkv.remove(STORAGE_KEYS.pairedDevice);
    }
  },

  beginPairing: async () => {
    set({
      phase: 'permission_prime',
      discovered: [],
      selectedBleId: null,
      error: null,
    });
  },

  acknowledgePermissions: async () => {
    const perm = await requestBlePermissions();
    if (!perm.granted) {
      set({
        phase: 'permission_denied',
        error: { code: 'permission_denied', friendly: FRIENDLY.permission_denied },
      });
      return;
    }
    set({ phase: 'power_on' });
  },

  confirmWatchOn: async () => {
    await get().startScan();
  },

  startScan: async () => {
    // Bluetooth state — listen once; if off, transition to bluetooth_off.
    const stateUnsub = observeBluetoothState((state) => {
      if (state === 'PoweredOff') {
        const stop = get()._stopScan;
        if (stop) stop();
        logger.track('ble_bluetooth_off');
        set({
          phase: 'bluetooth_off',
          error: { code: 'bluetooth_off', friendly: FRIENDLY.bluetooth_off },
        });
      }
    });
    set({
      phase: 'searching',
      discovered: [],
      _stopStateObserver: () => stateUnsub.remove(),
    });
    const stop = scanForUrion(
      (device) => {
        const macSuffix = lastFour(device.id);
        const next: DiscoveredDevice = {
          bleId: device.id,
          name: device.name ?? device.localName ?? null,
          macSuffix,
        };
        const existing = get().discovered;
        if (existing.some((d) => d.bleId === next.bleId)) return;
        logger.track('ble_device_found', { macSuffix });
        set({ discovered: [...existing, next], phase: 'found' });
      },
      (error) => {
        logger.track('ble_pair_failed', { reason: error.message });
        set({
          phase: 'failure',
          error: { code: 'no_watch_found', friendly: FRIENDLY.no_watch_found },
        });
      },
    );
    // Hard timeout — 30s without any device → no_watch_found. Stored
    // on the store so reset()/cancel() can clear it; otherwise it
    // fires after the test/screen has unmounted and surprises Jest.
    const timeout = setTimeout(() => {
      if (get().phase === 'searching') {
        const s = get()._stopScan;
        if (s) s();
        set({
          phase: 'failure',
          error: { code: 'no_watch_found', friendly: FRIENDLY.no_watch_found },
          _scanTimeout: null,
        });
      }
    }, 30_000);
    set({ _stopScan: stop, _scanTimeout: timeout });
  },

  stopScan: () => {
    const s = get()._stopScan;
    if (s) s();
    const t = get()._scanTimeout;
    if (t) clearTimeout(t);
    set({ _stopScan: null, _scanTimeout: null });
  },

  cancel: () => {
    get().stopScan();
    const obs = get()._stopStateObserver;
    if (obs) obs();
    void get()._activeDevice?.disconnect();
    set({
      phase: 'idle',
      discovered: [],
      selectedBleId: null,
      error: null,
      _activeDevice: null,
      _stopStateObserver: null,
    });
  },

  selectDevice: async (bleId) => {
    set({ selectedBleId: bleId });
  },

  buzzSelected: async () => {
    const { selectedBleId, _activeDevice } = get();
    if (!selectedBleId) return;
    try {
      // If we have not yet connected, do a quick connect+buzz+disconnect
      // so the watch vibrates without committing to pairing yet.
      if (!_activeDevice) {
        const dev = await connectToUrion(selectedBleId);
        await findWatch(dev);
        // Hold the device for the imminent confirmPair so we don't
        // re-connect immediately. Disconnect on cancel.
        set({ _activeDevice: dev });
      } else {
        await findWatch(_activeDevice);
      }
    } catch {
      // Buzz is best-effort; surfacing a hard error here would dwarf
      // the actual pairing flow. Stay in 'found' so the user can retry
      // or proceed.
    }
  },

  confirmPair: async () => {
    const { selectedBleId, _activeDevice } = get();
    if (!selectedBleId) return;
    const macSuffix = lastFour(selectedBleId);
    set({ phase: 'pairing', error: null });
    const startedAt = Date.now();
    logger.track('ble_pair_attempt', { macSuffix });
    try {
      const device = _activeDevice ?? (await connectToUrion(selectedBleId));
      try {
        await setTime(device, { language: 'en' });
      } catch {
        logger.track('ble_pair_failed', { macSuffix, reason: 'set_time' });
        await device.disconnect();
        set({
          phase: 'failure',
          error: { code: 'set_time_failed', friendly: FRIENDLY.set_time_failed },
          _activeDevice: null,
        });
        return;
      }
      const paired: PairedDevice = {
        bleId: selectedBleId,
        macSuffix,
        name: device.name,
        pairedAt: Date.now(),
      };
      mmkv.set(STORAGE_KEYS.pairedDevice, JSON.stringify(paired));
      logger.track('ble_pair_success', {
        macSuffix,
        durationMs: Date.now() - startedAt,
      });
      // Disconnect after pairing — Sprint 6's sync layer will reconnect
      // when it needs the device. Holding the connection idle drains
      // both phone and watch batteries.
      await device.disconnect();
      set({
        phase: 'success',
        pairedDevice: paired,
        _activeDevice: null,
      });
      // Spin up the Android foreground service so the OS keeps the
      // process + BLE link alive while backgrounded (Family Circle's
      // "see readings as they arrive" promise). No-op on iOS.
      void startBleForegroundService();
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'unknown';
      logger.track('ble_pair_failed', { macSuffix, reason });
      set({
        phase: 'failure',
        error: { code: 'connect_failed', friendly: FRIENDLY.connect_failed },
        _activeDevice: null,
      });
    }
  },

  retry: async () => {
    // Surface the user back through the same flow — permissions may
    // have been revoked between attempts; the BT state may have flipped.
    await get().beginPairing();
  },

  forget: async () => {
    // Tear down the foreground service first — there's no watch to keep
    // a link to once it's forgotten, so the notification must go too.
    void stopBleForegroundService();
    const current = get().pairedDevice;
    if (current) logger.track('ble_forget_device', { deviceId: current.bleId });
    mmkv.remove(STORAGE_KEYS.pairedDevice);
    set({ pairedDevice: null });
  },

  reset: () => {
    get().stopScan();
    const obs = get()._stopStateObserver;
    if (obs) obs();
    void get()._activeDevice?.disconnect();
    set({
      phase: 'idle',
      discovered: [],
      selectedBleId: null,
      error: null,
      _activeDevice: null,
      _stopScan: null,
      _stopStateObserver: null,
      _scanTimeout: null,
    });
  },
}));

// Re-export Platform-aware web-Bluetooth eligibility for the QR-handoff
// bottom sheet (parent-side fallback per docs/06-ble-protocol.md §6).
export const supportsWebBluetoothHandoff = Platform.OS === 'android';
