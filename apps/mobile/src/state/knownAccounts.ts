// Known accounts — Sprint 19 Block 4.
//
// MMKV-backed list of every email that has successfully signed in on
// this device. Drives the account switcher (Settings → Profile →
// "Switch account" / AccountSwitchScreen) so the user can hop between
// accounts without re-typing email each time.
//
// Behavior:
//   - `add(email)` upserts the entry and refreshes `lastSignedInAtMs`.
//     Called on every successful auth (verifyOtp success).
//   - `forget(email)` removes an entry. Surfaced in
//     AccountSwitchScreen via a per-row "Forget" affordance.
//   - `getAll()` returns the list sorted by `lastSignedInAtMs` desc
//     (most-recent first).
//   - Sign-out does NOT clear this list — the whole point of the
//     switcher is to remember accounts across sign-outs.
//   - Delete-account DOES remove the entry (the deleteAccount flow
//     calls forget after the server confirms).
//
// Voice rules: no user-visible strings live here; everything is data.

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../services/storage';

export interface KnownAccount {
  /** Email used for the OTP sign-in. Normalised to lowercase + trimmed. */
  email: string;
  /** Unix ms of the most recent successful sign-in for this email. */
  lastSignedInAtMs: number;
}

interface KnownAccountsState {
  accounts: KnownAccount[];

  hydrate: () => void;
  /** Upsert by email; bumps lastSignedInAtMs to now. */
  add: (email: string, nowMs?: number) => void;
  /** Remove an entry by email. No-op if not present. */
  forget: (email: string) => void;
  /** Convenience: list sorted by most-recent first. */
  getAll: () => KnownAccount[];
  /** Test helper — wipes the slice + the MMKV row. Not called from app. */
  _reset: () => void;
}

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

function readPersisted(): KnownAccount[] {
  const raw = mmkv.getString(STORAGE_KEYS.knownAccounts);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: KnownAccount[] = [];
    for (const row of parsed) {
      if (
        row &&
        typeof row === 'object' &&
        typeof (row as KnownAccount).email === 'string' &&
        typeof (row as KnownAccount).lastSignedInAtMs === 'number'
      ) {
        out.push({
          email: normalise((row as KnownAccount).email),
          lastSignedInAtMs: (row as KnownAccount).lastSignedInAtMs,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function persist(accounts: KnownAccount[]): void {
  mmkv.set(STORAGE_KEYS.knownAccounts, JSON.stringify(accounts));
}

function sortDesc(accounts: KnownAccount[]): KnownAccount[] {
  return [...accounts].sort((a, b) => b.lastSignedInAtMs - a.lastSignedInAtMs);
}

export const useKnownAccounts = create<KnownAccountsState>((set, get) => ({
  accounts: readPersisted(),

  hydrate() {
    set({ accounts: readPersisted() });
  },

  add(email, nowMs) {
    const e = normalise(email);
    if (!e || !e.includes('@')) return;
    const ts = nowMs ?? Date.now();
    const current = get().accounts;
    const without = current.filter((a) => a.email !== e);
    const next = sortDesc([{ email: e, lastSignedInAtMs: ts }, ...without]);
    set({ accounts: next });
    persist(next);
  },

  forget(email) {
    const e = normalise(email);
    if (!e) return;
    const next = get().accounts.filter((a) => a.email !== e);
    if (next.length === get().accounts.length) return;
    set({ accounts: next });
    persist(next);
  },

  getAll() {
    return sortDesc(get().accounts);
  },

  _reset() {
    set({ accounts: [] });
    mmkv.remove(STORAGE_KEYS.knownAccounts);
  },
}));
