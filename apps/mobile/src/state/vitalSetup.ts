// Vital-setup store — Sprint 10b.2.
//
// Owns the user-facing toggles + targets that map to the U16PRO
// configuration commands (setAutoHR, setAutoSpO2, setGoals). Backed by
// MMKV so a settings change persists across cold starts; orchestrator
// flushes to the watch on the next sync run via applyDeviceConfig.
//
// Why a dedicated store rather than scattering the booleans into the
// existing slices (hr.ts, spo2.ts, etc.):
//   • Those slices are about *captured samples* — read paths that fan
//     out from /sync. Setup is a write path with different cardinality
//     (one packet per setting, not one per sample).
//   • The "dirty" marker is the contract between Settings UI and the
//     orchestrator: dirty=true means "next connect MUST flush to the
//     watch". Localising that flag in one place keeps the
//     applyDeviceConfig step clean.
//
// Defaults per docs/_reference/D13-multi-vitals-constellation-spec.md
// §3 + Q-D13-1 (steps target = 6000):
//   autoHrEnabled    : true   — most users want passive HR
//   autoSpo2Enabled  : false  — opt-in (battery-heavy on the U16)
//   stepsTarget      : 6000   — Q-D13-1 default
//   sleepTargetMin   : 480    — 8 hours
//
// Dirty bookkeeping: every set* call sets dirty=true. clearDirty() is
// called by applyDeviceConfig on a successful flush. A failed flush
// leaves dirty=true so the next sync retries.

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../services/storage';

export interface VitalSetup {
  autoHrEnabled: boolean;
  autoSpo2Enabled: boolean;
  /** Daily steps target (BLE setGoals). 2000..20000 in 1000-step
   *  increments per the Settings picker. */
  stepsTarget: number;
  /** Daily sleep target in minutes (BLE setGoals). 6h..10h in 30-min
   *  increments per the Settings picker. */
  sleepTargetMin: number;
  /** True iff at least one setting has changed since the last
   *  successful watch flush. */
  dirty: boolean;
  /** Sprint 16.5b — wall-clock ms of the last successful applyDeviceConfig
   *  flush. Used by applyDeviceConfig's debounce so background syncs
   *  push config periodically (refreshing demographics, auto-HR/SpO2,
   *  goals on the watch) instead of being silently dirty-gated. 0 = never
   *  flushed, treated as "stale → flush on next sync." */
  lastFlushedAtMs: number;
}

const DEFAULTS: VitalSetup = {
  autoHrEnabled: true,
  // Sprint 16.5b — flipped from false to true. Pre-16.5b most users never
  // saw SpO2 data because the watch wasn't sampling unless they explicitly
  // toggled this in Settings → Vital Streams. Battery cost is small (~1
  // sample per hour); the data gap is large (no overnight SpO2 lows for
  // anomaly engine, no SpO2 trend for AI). Phase A scenario 1 confirmed
  // 11 SpO2 samples per hour when on. Voice-claim review note: enabling
  // by default means we tell users "we measure your blood oxygen" — keep
  // that copy aligned with docs/05-voice-and-claims.md when the Settings
  // surface is rebuilt in Phase 16.5c.
  autoSpo2Enabled: true,
  stepsTarget: 6000,
  sleepTargetMin: 480,
  dirty: false,
  lastFlushedAtMs: 0,
};

export const STEPS_TARGET_MIN = 2000;
export const STEPS_TARGET_MAX = 20000;
export const STEPS_TARGET_STEP = 1000;
export const SLEEP_TARGET_MIN = 360; // 6h
export const SLEEP_TARGET_MAX = 600; // 10h
export const SLEEP_TARGET_STEP = 30;

function readPersisted(): VitalSetup {
  const raw = mmkv.getString(STORAGE_KEYS.vitalSetup);
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<VitalSetup>;
    return {
      autoHrEnabled:
        typeof parsed.autoHrEnabled === 'boolean'
          ? parsed.autoHrEnabled
          : DEFAULTS.autoHrEnabled,
      autoSpo2Enabled:
        typeof parsed.autoSpo2Enabled === 'boolean'
          ? parsed.autoSpo2Enabled
          : DEFAULTS.autoSpo2Enabled,
      stepsTarget:
        typeof parsed.stepsTarget === 'number' && Number.isFinite(parsed.stepsTarget)
          ? clampSteps(parsed.stepsTarget)
          : DEFAULTS.stepsTarget,
      sleepTargetMin:
        typeof parsed.sleepTargetMin === 'number' && Number.isFinite(parsed.sleepTargetMin)
          ? clampSleep(parsed.sleepTargetMin)
          : DEFAULTS.sleepTargetMin,
      dirty: typeof parsed.dirty === 'boolean' ? parsed.dirty : DEFAULTS.dirty,
      lastFlushedAtMs:
        typeof parsed.lastFlushedAtMs === 'number' && Number.isFinite(parsed.lastFlushedAtMs)
          ? parsed.lastFlushedAtMs
          : DEFAULTS.lastFlushedAtMs,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist(value: VitalSetup): void {
  mmkv.set(STORAGE_KEYS.vitalSetup, JSON.stringify(value));
}

function clampSteps(value: number): number {
  if (value < STEPS_TARGET_MIN) return STEPS_TARGET_MIN;
  if (value > STEPS_TARGET_MAX) return STEPS_TARGET_MAX;
  // Snap to the nearest 1000.
  return Math.round(value / STEPS_TARGET_STEP) * STEPS_TARGET_STEP;
}

function clampSleep(value: number): number {
  if (value < SLEEP_TARGET_MIN) return SLEEP_TARGET_MIN;
  if (value > SLEEP_TARGET_MAX) return SLEEP_TARGET_MAX;
  return Math.round(value / SLEEP_TARGET_STEP) * SLEEP_TARGET_STEP;
}

interface VitalSetupStore extends VitalSetup {
  setAutoHr: (enabled: boolean) => void;
  setAutoSpo2: (enabled: boolean) => void;
  setStepsTarget: (value: number) => void;
  setSleepTargetMin: (value: number) => void;
  /** Mark settings as flushed to the watch — called by
   *  applyDeviceConfig after a successful BLE round-trip.
   *  Sprint 16.5b: also stamps `lastFlushedAtMs` so the next sync's
   *  applyDeviceConfig can debounce repeat flushes. */
  clearDirty: () => void;
  /** Test-only reset. */
  __resetForTest: () => void;
}

export const useVitalSetup = create<VitalSetupStore>((set, get) => {
  const initial = readPersisted();
  return {
    ...initial,

    setAutoHr: (enabled) => {
      const next: VitalSetup = {
        autoHrEnabled: enabled,
        autoSpo2Enabled: get().autoSpo2Enabled,
        stepsTarget: get().stepsTarget,
        sleepTargetMin: get().sleepTargetMin,
        dirty: true,
        lastFlushedAtMs: get().lastFlushedAtMs,
      };
      set(next);
      persist(next);
    },

    setAutoSpo2: (enabled) => {
      const next: VitalSetup = {
        autoHrEnabled: get().autoHrEnabled,
        autoSpo2Enabled: enabled,
        stepsTarget: get().stepsTarget,
        sleepTargetMin: get().sleepTargetMin,
        dirty: true,
        lastFlushedAtMs: get().lastFlushedAtMs,
      };
      set(next);
      persist(next);
    },

    setStepsTarget: (value) => {
      const next: VitalSetup = {
        autoHrEnabled: get().autoHrEnabled,
        autoSpo2Enabled: get().autoSpo2Enabled,
        stepsTarget: clampSteps(value),
        sleepTargetMin: get().sleepTargetMin,
        dirty: true,
        lastFlushedAtMs: get().lastFlushedAtMs,
      };
      set(next);
      persist(next);
    },

    setSleepTargetMin: (value) => {
      const next: VitalSetup = {
        autoHrEnabled: get().autoHrEnabled,
        autoSpo2Enabled: get().autoSpo2Enabled,
        stepsTarget: get().stepsTarget,
        sleepTargetMin: clampSleep(value),
        dirty: true,
        lastFlushedAtMs: get().lastFlushedAtMs,
      };
      set(next);
      persist(next);
    },

    clearDirty: () => {
      const current: VitalSetup = {
        autoHrEnabled: get().autoHrEnabled,
        autoSpo2Enabled: get().autoSpo2Enabled,
        stepsTarget: get().stepsTarget,
        sleepTargetMin: get().sleepTargetMin,
        dirty: false,
        lastFlushedAtMs: Date.now(),
      };
      set({ dirty: false, lastFlushedAtMs: current.lastFlushedAtMs });
      persist(current);
    },

    __resetForTest: () => {
      mmkv.remove(STORAGE_KEYS.vitalSetup);
      set({ ...DEFAULTS });
    },
  };
});

// Non-React snapshot for the orchestrator (which runs outside any React tree).
export function getVitalSetup(): VitalSetup {
  const s = useVitalSetup.getState();
  return {
    autoHrEnabled: s.autoHrEnabled,
    autoSpo2Enabled: s.autoSpo2Enabled,
    stepsTarget: s.stepsTarget,
    sleepTargetMin: s.sleepTargetMin,
    dirty: s.dirty,
    lastFlushedAtMs: s.lastFlushedAtMs,
  };
}
