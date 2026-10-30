// syncTimezoneFromDevice — keep users.timezone in step with where the
// phone is (founder request, 2026-10-30).
//
// Why: "today", "last night" and resting heart rate are all read in
// the profile timezone. The founder travelled Lagos → Los Angeles and
// the app kept using Africa/Lagos, so his resting heart rate came from
// afternoon readings and "today" started at 4 pm. The phone's own
// timezone follows the network/location automatically, so we follow
// the phone: when they differ, the profile is updated.
//
// Settings → Timezone already only offers "use my device's time zone",
// so following the device never overrides a deliberate manual choice.
// Best-effort: failures are swallowed; the next foreground retries.

import { useAuth } from '../../state/auth';
import { mmkv, STORAGE_KEYS } from '../storage';
import { updateProfile } from './updateProfile';
import { deviceTz } from '../../utils/userTz';
import { resolveTimeZone } from '../../utils/timeInZone';
import type { UserRow } from '../../types/database';

export interface SyncTimezoneDeps {
  getProfile: () => UserRow | null;
  getDeviceTz: () => string;
  update: (userId: string, patch: { timezone: string }) => Promise<UserRow>;
  applyProfile: (profile: UserRow) => void;
}

const defaultDeps: SyncTimezoneDeps = {
  getProfile: () => useAuth.getState().profile,
  getDeviceTz: deviceTz,
  update: (id, patch) => updateProfile(id, patch),
  applyProfile: (profile) => {
    useAuth.setState({ profile });
    mmkv.set(STORAGE_KEYS.cachedProfile, JSON.stringify(profile));
  },
};

let inFlight: Promise<'updated' | 'unchanged' | 'skipped' | 'failed'> | null = null;

export function syncTimezoneFromDevice(
  deps: SyncTimezoneDeps = defaultDeps,
): Promise<'updated' | 'unchanged' | 'skipped' | 'failed'> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const profile = deps.getProfile();
    if (!profile) return 'skipped' as const;
    const device = deps.getDeviceTz();
    // resolveTimeZone maps invalid / empty names to 'UTC'. Never write
    // a UTC fallback over a real zone because Intl had a bad moment.
    if (!device || resolveTimeZone(device) !== device || device === 'UTC') {
      return 'skipped' as const;
    }
    if (profile.timezone === device) return 'unchanged' as const;
    try {
      const updated = await deps.update(profile.id, { timezone: device });
      deps.applyProfile(updated);
      return 'updated' as const;
    } catch {
      return 'failed' as const;
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
