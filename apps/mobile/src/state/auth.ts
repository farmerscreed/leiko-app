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
import { linkSentryToUser } from '../services/sentry';
import type { AccountType, UserRow } from '../types/database';

type Status = 'loading' | 'unauthenticated' | 'authenticated';

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
  verifyOtp: (email: string, token: string) => Promise<void>;
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
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    await get()._setSession(data.session);

    supabase.auth.onAuthStateChange((_event, session) => {
      void get()._setSession(session);
    });
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

  async verifyOtp(email, token) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
    // Successful verification triggers handle_new_user (first-time)
    // and onAuthStateChange. Set state directly here too so the
    // calling screen sees the change synchronously without waiting
    // for the listener.
    await get()._setSession(data.session);
    // The fork choice has now been committed to the database — drop
    // it from MMKV so a future signed-out state doesn't replay it.
    if (data.session) get().clearPendingAccountType();
  },

  async refreshProfile() {
    const session = get().session;
    if (!session) return;
    const profile = await fetchProfile(session.user.id);
    set({ profile });
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // Best-effort: clear the RevenueCat subscriber so a different user
    // signing in on the same device doesn't inherit entitlements.
    void logoutPurchaser();
    set({ session: null, profile: null, status: 'unauthenticated' });
  },

  async _setSession(session) {
    if (!session) {
      linkSentryToUser(null);
      set({ session: null, profile: null, status: 'unauthenticated' });
      return;
    }
    const profile = await fetchProfile(session.user.id);
    set({ session, profile, status: 'authenticated' });
    // Stitch future crashes to this user. Only the row id leaves the
    // device — sendDefaultPii is off so no email / IP is attached.
    linkSentryToUser(session.user.id);
    // Identify with RevenueCat once we have the profile. The webhook is
    // the source of truth for entitlement; this call only ties future
    // purchase events to the right Supabase user.
    if (profile) {
      void identifyPurchaser(profile.id, {
        accountType: profile.account_type,
        familyId: mmkv.getString(STORAGE_KEYS.currentFamilyId) ?? null,
      });
    }
  },
}));
