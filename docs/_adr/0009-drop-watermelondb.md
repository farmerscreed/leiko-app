# ADR-0009: Drop WatermelonDB — MMKV + Supabase is the persistence model

- **Status**: Accepted (founder decision 2026-06-02)
- **Date**: 2026-06-02
- **Amends**: `docs/00-tech-stack.md` (removes the "Local relational DB"
  lock), `docs/01-data-model.md` §"Local storage on device"
- **Supersedes (on this point)**: D4 Block 3.1.2, D7 §(local DB / storage),
  D13 §5.2 — all of which named WatermelonDB as the on-device relational
  cache. Those are historical reference docs (banner-stamped); this ADR is
  the current decision.

## Context

The stack docs locked **WatermelonDB 0.27+** as the on-device "relational
DB" for a queryable 30-day cache of readings (D4 → D7 → D13 → `00-tech-stack`).
The documentation-reconciliation audit (2026-06-02) found that **WatermelonDB
was never installed** — it is not in `apps/mobile/package.json`, and no code
imports it.

What the app actually does on device:

- **MMKV** (`react-native-mmkv`, encrypted via platform Keychain/Keystore) —
  auth tokens, user preferences, the offline **pending-readings buffer**, and
  feature-flag state. This is the offline-first guarantee in CLAUDE.md
  ("every reading is saved to MMKV before any sync attempt").
- **Zustand** — in-memory client/session state.
- **TanStack Query** — server-state cache over Supabase reads.
- **Supabase (Postgres)** — the queryable source of truth for reading
  history, vitals, family/circle membership, and device state. Trends,
  anomaly look-back, and the dashboards read from Supabase (cached by
  TanStack Query), not from a local relational store.

The founder confirmed (2026-06-02): **"we used Supabase — remove
Watermelon."**

## Decision

**Drop WatermelonDB from the stack.** There is **no separate on-device
relational database.** On-device persistence is **MMKV (encrypted KV) +
Zustand (client state)**; the queryable source of truth is **Supabase
(Postgres)**, read through **TanStack Query** with best-effort offline
behaviour backed by the MMKV pending buffer.

## Rationale

1. **It matches what shipped.** The app has worked through launch readiness
   on MMKV + Supabase + TanStack Query with no WatermelonDB. The lock
   described an intention that was never built; keeping it misleads.
2. **Supabase already is the queryable layer.** Postgres + the `/sync` edge
   function + TanStack Query cover the "queryable history" job WatermelonDB
   was locked for. A second relational store on device would be duplicate
   machinery.
3. **Offline-first is preserved.** The CLAUDE.md guarantee — write every
   reading to MMKV synchronously before any UI confirmation, sync
   best-effort — does not depend on WatermelonDB. The pending buffer is MMKV.
4. **Less to maintain and encrypt.** No SQLCipher key lifecycle, no schema
   migrations mirroring Supabase, no Nitro/JSI relational adapter to keep
   current with the New Architecture.

## Consequences

- `docs/00-tech-stack.md`: the "Local relational DB | WatermelonDB" row and
  its flag are removed; the encryption inventory's "Local relational DB |
  SQLCipher (WatermelonDB)" row is removed (MMKV-at-rest is covered by the
  mobile-keychain row).
- `docs/01-data-model.md` §"Local storage on device": the WatermelonDB
  section is replaced with the MMKV + Supabase + TanStack Query model; the
  sync strategy reads from Supabase (cached), not WatermelonDB.
- `docs/04-screens/take-reading.md`: the sync step no longer "inserts into
  WatermelonDB"; on success it writes to `public.readings` and drops the
  MMKV buffer entry.
- `README.md`: local-DB line updated to MMKV + Supabase.
- Reference docs (D4/D7/D8/D13) keep their bodies (historical, banner-stamped);
  this ADR is the pointer that they're superseded on the local-DB choice.

## Future option (not now)

If a future version needs richer **offline querying** (e.g. full history
available with no network, complex on-device filtering), revisit an
on-device store then — as a fresh ADR, weighing `op-sqlite` / Expo SQLite /
WatermelonDB against the need at that time. v1 does not need it.
