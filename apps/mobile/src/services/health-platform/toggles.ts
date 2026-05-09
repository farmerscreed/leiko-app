// Toggle state surface for the platform-health bridge — Sprint 9.5
// Task 4. Persisted to MMKV; exposed as a Zustand store so React
// components can subscribe to changes (Sprint 10 Settings UI), and as
// pure helpers for non-React callers (Task 5's /sync write hook).
//
// Defaults per D13 §12.5: master OFF, every per-vital toggle OFF.
// "Opt-in, default off" — nothing reads or writes the platform store
// until the user has answered the permission prompt and turned the
// master toggle on.
//
// Master-off shadow: even if a per-vital toggle is true, an off master
// shadows it. The helpers expose this with isWriteEnabled() /
// isReadEnabled() so callers don't have to AND the two booleans
// themselves.

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../storage';
import {
  ALL_READ_KINDS,
  ALL_WRITE_KINDS,
  type ReadVitalKind,
  type WriteVitalKind,
} from './types';

export interface HealthPlatformToggles {
  master: boolean;
  perVitalWrite: Record<WriteVitalKind, boolean>;
  perVitalRead: Record<ReadVitalKind, boolean>;
}

function emptyWriteMap(): Record<WriteVitalKind, boolean> {
  const out = {} as Record<WriteVitalKind, boolean>;
  for (const k of ALL_WRITE_KINDS) out[k] = false;
  return out;
}

function emptyReadMap(): Record<ReadVitalKind, boolean> {
  const out = {} as Record<ReadVitalKind, boolean>;
  for (const k of ALL_READ_KINDS) out[k] = false;
  return out;
}

function defaultToggles(): HealthPlatformToggles {
  return {
    master: false,
    perVitalWrite: emptyWriteMap(),
    perVitalRead: emptyReadMap(),
  };
}

function readPersisted(): HealthPlatformToggles {
  const raw = mmkv.getString(STORAGE_KEYS.healthPlatformToggles);
  if (!raw) return defaultToggles();
  try {
    const parsed = JSON.parse(raw) as Partial<HealthPlatformToggles>;
    const base = defaultToggles();
    return {
      master: typeof parsed.master === 'boolean' ? parsed.master : base.master,
      // Merge into base so a future-added vital kind defaults OFF when
      // hydrating an older payload.
      perVitalWrite: { ...base.perVitalWrite, ...(parsed.perVitalWrite ?? {}) },
      perVitalRead: { ...base.perVitalRead, ...(parsed.perVitalRead ?? {}) },
    };
  } catch {
    return defaultToggles();
  }
}

function persist(value: HealthPlatformToggles): void {
  mmkv.set(STORAGE_KEYS.healthPlatformToggles, JSON.stringify(value));
}

interface ToggleStore extends HealthPlatformToggles {
  setMaster: (value: boolean) => void;
  setWriteVital: (kind: WriteVitalKind, value: boolean) => void;
  setReadVital: (kind: ReadVitalKind, value: boolean) => void;
  resetAll: () => void;
}

export const useHealthPlatformToggles = create<ToggleStore>((set, get) => {
  const initial = readPersisted();
  return {
    ...initial,
    setMaster: (value) => {
      set({ master: value });
      persist({
        master: value,
        perVitalWrite: get().perVitalWrite,
        perVitalRead: get().perVitalRead,
      });
    },
    setWriteVital: (kind, value) => {
      const next = { ...get().perVitalWrite, [kind]: value };
      set({ perVitalWrite: next });
      persist({
        master: get().master,
        perVitalWrite: next,
        perVitalRead: get().perVitalRead,
      });
    },
    setReadVital: (kind, value) => {
      const next = { ...get().perVitalRead, [kind]: value };
      set({ perVitalRead: next });
      persist({
        master: get().master,
        perVitalWrite: get().perVitalWrite,
        perVitalRead: next,
      });
    },
    resetAll: () => {
      const fresh = defaultToggles();
      set(fresh);
      persist(fresh);
    },
  };
});

// ---- non-React helpers ---------------------------------------------------
// These mirror the store getters but live as plain functions so the
// Task 5 /sync write hook (which runs outside any React tree) can gate
// without needing to thread a store reference around.

export function getToggles(): HealthPlatformToggles {
  const s = useHealthPlatformToggles.getState();
  return {
    master: s.master,
    perVitalWrite: { ...s.perVitalWrite },
    perVitalRead: { ...s.perVitalRead },
  };
}

export function isWriteEnabled(kind: WriteVitalKind): boolean {
  const s = useHealthPlatformToggles.getState();
  return s.master && s.perVitalWrite[kind];
}

export function isReadEnabled(kind: ReadVitalKind): boolean {
  const s = useHealthPlatformToggles.getState();
  return s.master && s.perVitalRead[kind];
}

export function setMaster(value: boolean): void {
  useHealthPlatformToggles.getState().setMaster(value);
}

export function setWriteVital(kind: WriteVitalKind, value: boolean): void {
  useHealthPlatformToggles.getState().setWriteVital(kind, value);
}

export function setReadVital(kind: ReadVitalKind, value: boolean): void {
  useHealthPlatformToggles.getState().setReadVital(kind, value);
}

// ---- test-only ---------------------------------------------------------

export function __resetForTest(): void {
  useHealthPlatformToggles.getState().resetAll();
  mmkv.remove(STORAGE_KEYS.healthPlatformToggles);
}
