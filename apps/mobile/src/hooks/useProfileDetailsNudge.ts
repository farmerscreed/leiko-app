// useProfileDetailsNudge — ADR-0006 follow-up.
//
// Decides whether to show the home "add your details" nudge. Shows when:
//   • the viewer is a WEARER (has a self-circle — only then does the
//     watch consume their demographics), AND
//   • any of gender / height_cm / weight_kg is missing on their profile,
//     AND
//   • they haven't dismissed it.
//
// Hides automatically once the fields are filled (no dismissal needed),
// so it self-resolves. year_of_birth is intentionally NOT required here —
// it's optional per D8a, and the strongest step/calorie gains come from
// height + weight + gender.

import { useCallback, useEffect, useState } from 'react';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { useAuth } from '../state/auth';

export interface UseProfileDetailsNudgeResult {
  /** True when the nudge should render. */
  show: boolean;
  /** Persist dismissal so it doesn't reappear. */
  dismiss: () => void;
}

export function useProfileDetailsNudge(isWearer: boolean): UseProfileDetailsNudgeResult {
  const profile = useAuth((s) => s.profile);
  const [dismissed, setDismissed] = useState<boolean>(() =>
    mmkv.getBoolean(STORAGE_KEYS.profileNudgeDismissed) ?? false,
  );

  // Re-read dismissal on mount (survives across remounts).
  useEffect(() => {
    setDismissed(mmkv.getBoolean(STORAGE_KEYS.profileNudgeDismissed) ?? false);
  }, []);

  const dismiss = useCallback(() => {
    mmkv.set(STORAGE_KEYS.profileNudgeDismissed, true);
    setDismissed(true);
  }, []);

  const missingDemographics =
    !profile?.gender || profile?.height_cm == null || profile?.weight_kg == null;

  const show = isWearer && missingDemographics && !dismissed;

  return { show, dismiss };
}
