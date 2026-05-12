// useQuietHoursAffirm — Sprint 15.
//
// One-shot trigger for the quiet-hours-override affirm sheet. Auto-
// opens the first time the user reaches Home after a fresh install.
// Subsequent app launches read the MMKV guard and skip the prompt.

import { useEffect, useState } from 'react';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { useAuth } from '../state/auth';

export function useQuietHoursAffirm(): {
  visible: boolean;
  dismiss: () => void;
} {
  const status = useAuth((s) => s.status);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const alreadyAnswered = mmkv.getString(STORAGE_KEYS.anomalyBypassAffirmAnswered);
    if (alreadyAnswered === 'true') return;
    // Defer by a tick so the rest of Home renders first; the sheet
    // appears as an editorial moment, not a load-time blocker.
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, [status]);

  return {
    visible,
    dismiss: () => setVisible(false),
  };
}
