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

function readPersisted(): CaregiverViewMode {
  const raw = mmkv.getString(STORAGE_KEYS.caregiverViewMode);
  return raw === 'birds' || raw === 'cards' ? raw : DEFAULT_VIEW_MODE;
}

export interface UseCaregiverViewModeResult {
  viewMode: CaregiverViewMode;
  setViewMode: (next: CaregiverViewMode) => void;
}

export function useCaregiverViewMode(): UseCaregiverViewModeResult {
  const [viewMode, setViewModeState] = useState<CaregiverViewMode>(() =>
    readPersisted(),
  );

  // Hydrate on mount in case MMKV was written while the hook wasn't
  // mounted (other tabs, dev hot-reload). Cheap; reads a single key.
  useEffect(() => {
    setViewModeState(readPersisted());
  }, []);

  const setViewMode = useCallback((next: CaregiverViewMode) => {
    mmkv.set(STORAGE_KEYS.caregiverViewMode, next);
    setViewModeState(next);
  }, []);

  return { viewMode, setViewMode };
}
