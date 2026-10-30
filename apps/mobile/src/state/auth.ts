// Auth store — single source of truth for the session, the signed-in
// user's profile row, and the fork-screen choice that's pending commit
// to the database.
//
// Flow shape (Sprint 2):
//   1. Splash hydrates → calls auth.hydrate() once on app start.
//      hydrate() calls supabase.auth.getSession(); if a session exists,
//      it pulls the public.users row.
//   2. Fork screen → setPendingAccountType(choice) writes the choice to
//      MMKV. The user is still unauthenticated.
//   3. SignUp screen → calls signUpWithOtp(email). The pendingAccountType
//      is passed through to signInWithOtp options.data, which becomes
//      raw_user_meta_data and is read by the handle_new_user trigger.
//   4. OTPVerify screen → verifyOtp(email, token) → on success the
//      onAuthStateChange listener fires, hydrate-on-signed-in pulls the
//      user row, and the navigator re-evaluates.
//
// Why separate signInWithOtp (existing user) from signUpWithOtp (new
// user)? They hit the same Supabase API but signUpWithOtp passes the
// account_type metadata. The DB trigger requires it on first insert
// (per migration 0002) and ignores it on subsequent calls.

import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { identifyPurchaser, logoutPurchaser } from '../services/purchases';
import { checkOnboardingState } from '../services/users/checkOnboardingState';
import { useKnownAccounts } from './knownAccounts';
import { useOnboarding } from './onboarding';
import { linkSentryToUser } from '../services/sentry';
import { linkPosthogToUser } from '../services/analytics/posthog';
import { stopBleForegroundService } from '../services/ble/foregroundService';
import { secureSupabaseStorage } from '../services/secureStorage';
import { withTimeout } from '../utils/withTimeout';
import type { AccountType, UserRow } from '../types/database';

// 'offline' — launch could not reach the server AND there is no saved
// profile on this device to open with. RootNavigator shows a calm
// "Try again" screen instead of the endless spinner this used to be.
type Status = 'loading' | 'unauthenticated' | 'authenticated' | 'offline';

/** Deadline for each network step on the launch path. RN's Android HTTP
 *  stack has no timeout of its own, so without this a stalled network
 *  (airport Wi-Fi, weak 3G) left the app on the spinner forever.
 *  Exported for tests. */
export const STARTUP_TIMEOUT_MS = 10_000;

/** Must match `storageKey` in services/supabase.ts. */
const SUPABASE_SESSION_KEY = 'leiko.auth.session';

function readCachedProfile(): UserRow | null {
  const raw = mmkv.getString(STORAGE_KEYS.cachedProfile);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserRow;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: UserRow | null): void {
  if (profile) mmkv.set(STORAGE_KEYS.cachedProfile, JSON.stringify(profile));
  else mmkv.remove(STORAGE_KEYS.cachedProfile);
}

/** The session supabase-js persisted last time, read straight from
 *  secure storage with no network. Used only when the live
 *  getSession() (which may need a network token refresh) misses the
 *  launch deadline. supabase-js keeps refreshing in the background and
 *  onAuthStateChange swaps in the fresh session when it lands. */
async function readStoredSession(): Promise<Session | null> {
  try {
    const raw = await secureSupabaseStorage.getItem(SUPABASE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session | { currentSession?: Session };
    const session = 'currentSession' in parsed ? parsed.currentSession : parsed;
    return session && (session as Session).user?.id ? (session as Session) : null;
  } catch {
    return null;
  }
}

let authListenerRegistered = false;

interface AuthState {
  status: Status;
  session: Session | null;
  profile: UserRow | null;
  pendingAccountType: AccountType | null;
  lastOtpEmail: string | null;

  hydrate: () => Promise<void>;
  setPendingAccountType: (kind: AccountType) => void;
  clearPendingAccountType: () => void;

  signUpWithOtp: (email: string) => Promise<void>;
  signInWithOtp: (email: string) => Promise<void>;
  /** Sprint 19 Block 9 — optional `delayMs` defers the session flip
   *  (and the resulting navigator transition) by N ms so the OTP
   *  screen can render a brief "Welcome back" success state. Default
   *  0 preserves existing behaviour for tests + non-UI callers. */
  verifyOtp: (
    email: string,
    token: string,
    options?: { delayMs?: number },
  ) => Promise<void>;
  signOut: () => Promise<void>;

  /** Refresh the profile from Supabase. Settings → Profile edits call
   *  this after a successful update so derived UI re-renders. */
  refreshProfile: () => Promise<void>;

  // Test surface — public for jest only. Not called by app code.
  _setSession: (session: Session | null) => Promise<void>;
}

function readPendingAccountType(): AccountType | null {
  const raw = mmkv.getString(STORAGE_KEYS.pendingAccountType);
  if (raw === 'caregiver' || raw === 'self_buyer' || raw === 'parent') {
    return raw;
  }
  return null;
}

async function fetchProfile(userId: string): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  session: null,
  profile: null,
  pendingAccountType: readPendingAccountType(),
  lastOtpEmail: null,

  async hydrate() {
    // Retry (from the offline screen) re-enters here: show the spinner
    // again, but never stack a second auth listener.
    if (get().status === 'offline') set({ status: 'loading' });

    // Register first so a session refresh that lands AFTER the launch
    // deadline still flips the app into the right state on its own.
    if (!authListenerRegistered) {
      authListenerRegistered = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        void get()._setSession(session);
      });
    }

    const live = supabase.auth.getSession();
    try {
      const { data, error } = await withTimeout(live, STARTUP_TIMEOUT_MS, 'getSession');
      if (error) throw error;
      await get()._setSession(data.session);
    } catch {
      // Network stalled or failed. Open from what this device already
      // has rather than waiting on the network.
      const stored = await readStoredSession();
      if (!stored) {
        // Nothing stored means nobody is signed in on this device —
        // that needs no network to know.
        set({ session: null, profile: null, status: 'unauthenticated' });
        return;
      }
      await get()._setSession(stored);
      // If the live call eventually succeeds, adopt its fresh session.
      live
        .then(({ data }) => {
          if (data.session) void get()._setSession(data.session);
        })
        .catch(() => {
          /* still offline — onAuthStateChange covers later recovery */
        });
    }
  },

  setPendingAccountType(kind) {
    mmkv.set(STORAGE_KEYS.pendingAccountType, kind);
    set({ pendingAccountType: kind });
  },

  clearPendingAccountType() {
    mmkv.remove(STORAGE_KEYS.pendingAccountType);
    set({ pendingAccountType: null });
  },

  async signUpWithOtp(email) {
    const pending = get().pendingAccountType;
    if (!pending) {
      // Defensive: the navigator should never route to SignUp without
      // a fork choice. If somehow it does, surface the state error
      // rather than silently dropping the user into a default mode.
      throw new Error('No account type selected. Go back to the fork screen.');
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        // Becomes raw_user_meta_data on auth.users → read by
        // handle_new_user (migration 0002) and stamped onto
        // public.users.account_type.
        data: { account_type: pending },
      },
    });
    if (error) throw error;
    set({ lastOtpEmail: email });
  },

  async signInWithOtp(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;
    set({ lastOtpEmail: email });
  },

  async verifyOtp(email, token, options) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
    // Sprint 19 Block 9 — optional delay before the session flip so
    // OTPVerify can render a brief "Welcome back" success view.
    const delayMs = options?.delayMs ?? 0;
    if (delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
    // Successful verification triggers handle_new_user (first-time)
    // and onAuthStateChange. Set state directly here too so the
    // calling screen sees the change synchronously without waiting
    // for the listener.
    await get()._setSession(data.session);
    // The fork choice has now been committed to the database — drop
    // it from MMKV so a future signed-out state doesn't replay it.
    if (data.session) get().clearPendingAccountType();
    // Sprint 19 Block 4 — remember this account for the switcher.
    if (data.session) useKnownAccounts.getState().add(email);
  },

  async refreshProfile() {
    const session = get().session;
    if (!session) return;
    const profile = await fetchProfile(session.user.id);
    set({ profile });
  },

  async signOut() {
    // Stop the BLE foreground service before tearing down the session —
    // a signed-out app has no business holding the watch link or the
    // persistent notification open. No-op on iOS / when not running.
    void stopBleForegroundService();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // Best-effort: clear the RevenueCat subscriber so a different user
    // signing in on the same device doesn't inherit entitlements.
    void logoutPurchaser();
    writeCachedProfile(null);
    set({ session: null, profile: null, status: 'unauthenticated' });
  },

  async _setSession(session) {
    if (!session) {
      linkSentryToUser(null);
      linkPosthogToUser(null);
      writeCachedProfile(null);
      set({ session: null, profile: null, status: 'unauthenticated' });
      return;
    }
    let profile: UserRow | null;
    try {
      profile = await withTimeout(fetchProfile(session.user.id), STARTUP_TIMEOUT_MS, 'fetchProfile');
      writeCachedProfile(profile);
    } catch {
      // Offline or slow: open with the profile saved on this device.
      // A later _setSession (token refresh, retry) replaces it.
      const cached = readCachedProfile();
      if (cached && cached.id === session.user.id) {
        set({ session, profile: cached, status: 'authenticated' });
        linkSentryToUser(session.user.id);
        return;
      }
      // Already showing a signed-in app for this user (e.g. a
      // background refresh failed mid-session): keep it as is.
      const current = get();
      if (current.status === 'authenticated' && current.profile?.id === session.user.id) {
        return;
      }
      set({ session, profile: null, status: 'offline' });
      return;
    }
    // Sprint 19 Block 8 — derive onboarding-complete from server
    // state. Without this, a returning user on a fresh install (or
    // post-MMKV-wipe) signs in cleanly but the navigator sends them
    // back through onboarding because the per-device MMKV flag is
    // false. The fix queries `family_members` for any active row and
    // back-fills the appropriate MMKV flag, then hydrates the
    // useOnboarding store so the navigator re-evaluates.
    //
    // Quietly best-effort: a network failure here leaves the existing
    // MMKV state alone (next session retries).
    if (profile) {
      try {
        const { hasOnboarded, primaryFamilyId } = await withTimeout(
          checkOnboardingState(profile.id),
          STARTUP_TIMEOUT_MS,
          'checkOnboardingState',
        );
        if (hasOnboarded) {
          if (profile.account_type === 'caregiver') {
            mmkv.set(STORAGE_KEYS.caregiverOnboardingComplete, true);
          } else if (profile.account_type === 'self_buyer') {
            mmkv.set(STORAGE_KEYS.selfBuyerOnboardingComplete, true);
          }
          // v7 hotfix — also seed currentFamilyId from the server when
          // the user has any active family. Pre-fix the onboarding flag
          // was set but currentFamilyId stayed null on a fresh install,
          // which routed the user out of onboarding but into an empty
          // home view that couldn't query any family data. Only write
          // when MMKV is empty so the chooser-driven currentFamilyId
          // (Sprint 19 Block 2) isn't clobbered for caregivers with
          // multiple families.
          if (primaryFamilyId && !mmkv.getString(STORAGE_KEYS.currentFamilyId)) {
            mmkv.set(STORAGE_KEYS.currentFamilyId, primaryFamilyId);
          }
          useOnboarding.getState().hydrate();
        }
      } catch {
        // Best-effort — leave MMKV alone on failure.
      }
    }
    set({ session, profile, status: 'authenticated' });
    // Stitch future crashes to this user. Only the row id leaves the
    // device — sendDefaultPii is off so no email / IP is attached.
    linkSentryToUser(session.user.id);
    // Identify with RevenueCat once we have the profile. The webhook is
    // the source of truth for entitlement; this call only ties future
    // purchase events to the right Supabase user.
    if (profile) {
      const familyId = mmkv.getString(STORAGE_KEYS.currentFamilyId) ?? null;
      void identifyPurchaser(profile.id, {
        accountType: profile.account_type,
        familyId,
      });
      // Stitch future PostHog events to this user. Identity travels
      // as row-id + account_type + family_id only; email and raw
      // metadata never leave the device.
      linkPosthogToUser(profile.id, { accountType: profile.account_type, familyId });
    }
  },
}));
