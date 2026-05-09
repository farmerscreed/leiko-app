// "Have we shown the platform-health opt-in yet?" — Sprint 9.5 / Task 8.
//
// One-shot flag in MMKV. The prompt itself ships in
// components/HealthPlatformPermissionPrompt.tsx and reads/writes here.
//
// Per D13 §12.5:
//   • Self-buyer asked once at end of onboarding (mounted from
//     SelfBuyerHome — fires on first home render after onboarding
//     completes).
//   • Parent (own phone) asked on first home-screen render.
//   • Caregiver NEVER asked — gating handled at the mount-site level
//     (CaregiverHome doesn't import the prompt component).
//
// The flag is binary: prompted true after Connect OR Maybe-later.
// Settings UI (Sprint 10) is the second-chance path; we never re-prompt
// automatically.

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../storage';

interface PermissionPromptState {
  prompted: boolean;
  markPrompted: () => void;
}

function readPersisted(): boolean {
  return mmkv.getBoolean(STORAGE_KEYS.healthPlatformPermissionPrompted) === true;
}

export const useHealthPlatformPermissionPrompt = create<PermissionPromptState>(
  (set) => ({
    prompted: readPersisted(),
    markPrompted: () => {
      mmkv.set(STORAGE_KEYS.healthPlatformPermissionPrompted, true);
      set({ prompted: true });
    },
  }),
);

// ---- non-React helpers ---------------------------------------------------

export function hasBeenPrompted(): boolean {
  return useHealthPlatformPermissionPrompt.getState().prompted;
}

export function markPrompted(): void {
  useHealthPlatformPermissionPrompt.getState().markPrompted();
}

// ---- test-only ---------------------------------------------------------

export function __resetForTest(): void {
  mmkv.remove(STORAGE_KEYS.healthPlatformPermissionPrompted);
  useHealthPlatformPermissionPrompt.setState({ prompted: false });
}
