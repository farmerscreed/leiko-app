// Caregiver Family Constellation view-mode preference — Sprint 7.7a/b.
//
// MMKV-backed; persists across reinstalls only as long as MMKV survives
// (uninstall wipes it, which is the correct behaviour per CLAUDE.md
// "no behaviour escapes the device unless the user signs in").
//
// Values:
//   - `birds` — the bird's-eye constellation (Sprint 7.7a)
//   - `cards` — the editorial card stack (Sprint 7.7b)
//
// In Sprint 7.7a only `birds` is rendered by CaregiverHome. The hook is
// plumbed now so the toggle UI in 7.7b can flip the value without
// touching the screen rewrite again.

import { useCallback, useEffect, useState } from 'react';
import { mmkv, STORAGE_KEYS } from '../services/storage';

export type CaregiverViewMode = 'birds' | 'cards';

const DEFAULT_VIEW_MODE: CaregiverViewMode = 'birds';

function readRaw(): CaregiverViewMode | null {
  const raw = mmkv.getString(STORAGE_KEYS.caregiverViewMode);
  return raw === 'birds' || raw === 'cards' ? raw : null;
}

function readPersisted(): CaregiverViewMode {
  return readRaw() ?? DEFAULT_VIEW_MODE;
}

export interface UseCaregiverViewModeResult {
  viewMode: CaregiverViewMode;
  setViewMode: (next: CaregiverViewMode) => void;
  /** ADR-0006 Phase 3 — true once the user has explicitly toggled the
   *  view. When false, the screen picks a count-based default (cards for
   *  ≤2 people, birds-eye for >2) instead of the static DEFAULT_VIEW_MODE. */
  hasExplicitPreference: boolean;
}

export function useCaregiverViewMode(): UseCaregiverViewModeResult {
  const [viewMode, setViewModeState] = useState<CaregiverViewMode>(() =>
    readPersisted(),
  );
  const [hasExplicitPreference, setHasExplicitPreference] = useState<boolean>(
    () => readRaw() !== null,
  );

  // Hydrate on mount in case MMKV was written while the hook wasn't
  // mounted (other tabs, dev hot-reload). Cheap; reads a single key.
  useEffect(() => {
    setViewModeState(readPersisted());
    setHasExplicitPreference(readRaw() !== null);
  }, []);

  const setViewMode = useCallback((next: CaregiverViewMode) => {
    mmkv.set(STORAGE_KEYS.caregiverViewMode, next);
    setViewModeState(next);
    setHasExplicitPreference(true);
  }, []);

  return { viewMode, setViewMode, hasExplicitPreference };
}
