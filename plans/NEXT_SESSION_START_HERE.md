# Start here — Sprint 18 handoff (2026-05-20 PM)

Last touched: 2026-05-20 Lagos. Supersedes the Sprint 16.6
mid-session handoff. Branch: `claude/competent-goldberg-737194`.
Latest tip: `d7c5a38` (check `git log -1` for newer).

## 90-second context

Three sprints closed in rapid succession over the last 24 hours:

- **Sprint 16.6** — caregiver-flow polish + Issue #1 invite-code UX
  (closed earlier; this is the spring of stuff the older handoff
  doc covered).
- **Sprint 17a** — Per-Person Dashboard. Replaced the Sprint 7
  "X readings synced" placeholder with a full Daily-Pulse-style
  immersive surface, family-scoped to the tapped parent. The 5
  VitalDetail screens are now parameterised with optional
  `familyId`. New query-only family-scoped data layer
  (`fetchParentPulseData` + `useParentDailyPulseData` +
  `useParentVitalsRecent`). Full closeout in
  `memory/sprint_17a_close_out.md`.
- **Sprint 17b** — Family Member Management + Visibility
  Enforcement. Family members screen got tap-to-remove (owner) /
  tap-to-leave (self) confirmation sheets, plus a link to
  CaregiverVisibility. Removed users get a push (`family_removed`
  category) plus an in-app banner (`useFamilyRemovalBanner`).
  Visibility toggles **actually enforce now** — migration `0022`
  added RLS gating on `readings` + `vitals_other`, and
  `useEnforceVisibility` purges singleton-slice `recent` arrays +
  TanStack caches when a vital flips visible → hidden. Full
  closeout in `memory/sprint_17b_close_out.md`.

Plus a fistful of bench-found bugs squashed:
- `e844a36` invite-sheet `already_member` error mapping
- `95c6d9e` Button label centering on every onboarding screen
- `558405a` listMembers ambiguous FK embed (PGRST201)
- `dd93a4b` listCaregivers same bug + collapsed Loading/Error render
- `d7c5a38` settings gear glyph + DaySpine HR rounding

Bench state right now:
- **Phone 1** (Pixel 8, `43230DLJH001YY`): self-buyer
  `biebele@gmail.com`, family `b9b88437-7e46-46fc-a1b7-f2a855b7c164`,
  Watch 1 paired, BP history intact. **NEVER WIPE** — months of BP
  data lives here and it's the SEC-1 migration test case.
- **Phone 2** (OnePlus Nord N30, `8fae80bc`): caregiver(s) on
  Biebele's family. Currently `TheTest` (`bokpokiri@gmail.com`,
  `09e15d4b-...`) is the active session. TheOne is also a member.

## What the next session needs to do

**Sprint 18 — Launch Readiness Blitz.** Read CLAUDE.md, then
`plans/sprint-18-launch-readiness.md`. Five-day blitz:

| Day | Theme | Driver |
|---|---|---|
| 1 | SEC-1 — MMKV encryption at rest | Engineer (me), founder reviews |
| 2 | Founder ops blitz (OPS-1..12) | Founder, engineer alongside |
| 3 | Doctor-PDF wiring + App Store metadata | Engineer |
| 4 | CI deploy workflows + Help/Support row | Engineer |
| 5 | Bench verification day | Founder, engineer triages |

Day 1 is the biggest engineering lift — the boot-ordering refactor
to await the keychain before mounting any MMKV consumer, plus a
careful migration path for existing installs (Phone 1 is the test
case).

## Bench environment

```powershell
& "$PWD\scripts\dev-phone-reconnect.ps1"
```

Checks: phone connected, Metro on :8081, Supabase Kong on :54321,
Edge Functions runtime alive, adb reverse forwards set. Re-apply
the reverses on every USB unplug/replug:
```
adb -s 43230DLJH001YY reverse tcp:8081 tcp:8081
adb -s 43230DLJH001YY reverse tcp:54321 tcp:54321
adb -s 43230DLJH001YY reverse tcp:54324 tcp:54324
adb -s 8fae80bc       reverse tcp:8081 tcp:8081
adb -s 8fae80bc       reverse tcp:54321 tcp:54321
adb -s 8fae80bc       reverse tcp:54324 tcp:54324
```

Metro launch (the env var is **non-negotiable** — see DO/DON'T):
```
cd apps/mobile && EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo start --dev-client
```

Edge Functions:
```
supabase functions serve --env-file supabase/functions/.env
```

`apps/mobile/.env.local` is configured for `localhost:54321` (USB
reverse path). Leave it — DON'T switch to the LAN IP without
re-reading the bench memo (`memory/running_on_phone.md`).

## Hard rules carried forward

1. **Two FK-embed traps already burnt us** (listMembers,
   listCaregivers). Any new `family_members.select(..., users(...))`
   query MUST disambiguate to `users!family_members_user_id_fkey(...)`
   — there are two FKs to `users` (`user_id` + `invited_by`).
2. **audit_log INSERT requires service_role.** Client-side
   `authenticated` role can READ its own + family-scoped rows but
   never INSERT. Any audit-emitting action goes through an Edge
   Function. See `manage-family-membership/index.ts` for the
   pattern.
3. **Visibility enforcement requires BOTH layers** — server RLS
   (migration 0022) AND client purge hook (`useEnforceVisibility`).
   Server alone leaves stale data in MMKV.
4. **OnePlus Nord N30 blocks `adb pm clear`.** Wipe Phone 2 via
   Settings → Apps → Leiko → Storage usage → Clear data. The
   adb command returns SecurityException.
5. **Dark mode is the default** (`d57206f`). Don't reintroduce
   `'system'` as the readPersistedOverride default — that's how
   the light-mode dim-text bug returns.
6. **HR/SpO2 day-anchor timestamps use
   `watchVitalTimestampToUtcSec`** (Sprint 16.5d). Server is
   source of truth for historical day-data.
7. **`account_type` is immutable.** Two-phone testing requires two
   real accounts.

## Background processes (may or may not still be alive)

If the next session starts cold, restart both:
- Metro: `cd apps/mobile && EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo start --dev-client`
- Edge Functions: `supabase functions serve --env-file supabase/functions/.env`

The reconnect script verifies state.

## Open prompt (what to say to the next session)

> Sprint 18 — Launch Readiness Blitz. Read CLAUDE.md, then
> `plans/sprint-18-launch-readiness.md`, then
> `plans/PRODUCTION_READINESS.md` (partly stale — confirm via
> `git log --grep="FUN-\\|OPS-"` which items already shipped).
>
> Day 1 is **SEC-1 (MMKV encryption at rest)** — the biggest
> engineering lift in the sprint. Read
> `apps/mobile/src/services/storage.ts` + every consumer that
> calls `mmkv.getString` / `mmkv.set` to scope the boot-ordering
> refactor before touching code. The migration path for existing
> installs (Phone 1 has months of BP history) is the riskiest
> step — bench-test on a phone with data BEFORE shipping.
>
> Propose the plan + the migration's failure-fallback strategy
> before writing code. Wait for founder approval.
