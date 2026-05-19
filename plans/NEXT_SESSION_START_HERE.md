# Start here — Sprint 16.6 mid-flight handoff (2026-05-19 PM)

Last touched: 2026-05-19 Lagos. Supersedes the previous mid-Sprint-16.6
handoff. Branch: `claude/competent-goldberg-737194`. Latest tip:
`67172b6` (or newer — check `git log`).

## 90-second context

Sprint 16.6 caregiver-flow polish + Issue #1 (invite-code UX) closed
this session. Founder is ready to perform a **from-scratch two-phone
test** and then move on to a per-person dashboard drill-in (replacing
the Sprint 7 placeholder "X readings synced" page that opens today
when a parent card is tapped).

Bench right now:
- **Phone 1** (Pixel 8, `43230DLJH001YY`): self-buyer `biebele@gmail.com`,
  Watch 1 paired, has BP history.
- **Phone 2** (OnePlus Nord N30, `8fae80bc`): caregiver `TheOne`
  (`lawonelimited@gmail.com`), already past onboarding, currently sees
  Biebele in the family circle.
- **PC**: Supabase local stack on `192.168.0.166:54321`, Metro running
  from `apps/mobile/` with `EXPO_NO_METRO_WORKSPACE_ROOT=1`.
  `apps/mobile/.env.local` is set to `http://localhost:54321` (USB
  reverse path; not LAN).

## What shipped this session (22 commits)

Numbered by theme, oldest → newest. Use `git show <hash>` for body.

### Design alignment to the unified template (5 commits)
| Commit    | What                                                      |
|-----------|-----------------------------------------------------------|
| `1b45648` | Palette tokens → design oklch values (warm-near-white)    |
| `67e44a5` | CaregiverHome warm radial canopy + 7 ambient star dots    |
| `3bf3dc2` | PersonOrb true gradient halo + restore Instrument Serif   |
| `3da5cd8` | ConstellationField "YOU" → quiet 8.5pt mono tertiary      |
| `e9b380d` | ConstellationLegend typography hierarchy revert           |

### Header + action bar polish (3 commits)
| Commit    | What                                                      |
|-----------|-----------------------------------------------------------|
| `6e57b95` | CaregiverActionBar warm-dark glass + typography revert    |
| `24086a1` | PersonCard typography hierarchy revert                    |
| `fa4fbf8` | Inline view toggle in header next to "Good morning"       |

### On-device legibility iteration loop (6 commits)
| Commit    | What                                                      |
|-----------|-----------------------------------------------------------|
| `194aa95` | PersonOrb name forced pure white (interim symptom fix)    |
| `c0cae46` | Pure-white pass on dim text (interim, then reverted)      |
| `bbf9d93` | Warm-bright text gradation, drop inline overrides         |
| `b8f4c18` | TEMP — A/B color test on orb names + relation tags        |
| `fb5f48d` | Consolidate to warm bone-cream #F9F6EE (A/B winner)       |
| `db4f3bb` | Pure white across all dark-mode text tokens (interim)     |

### ROOT CAUSE FOUND for on-device dim-text problem (1 commit)
| Commit    | What                                                      |
|-----------|-----------------------------------------------------------|
| `d57206f` | ThemeProvider default → 'dark'. Phone 2 OS was in light   |
|           | mode → app silently resolved to semanticColorsLight →     |
|           | text.primary = #0F121C (near-black) on hardcoded warm-    |
|           | dark canopy = read as dim/dark. NONE of the previous      |
|           | palette work fired on Phone 2 because dark-mode never     |
|           | resolved. **This is the load-bearing fix of the session.**|

### Final palette landing (2 commits)
| Commit    | What                                                      |
|-----------|-----------------------------------------------------------|
| `244dd1a` | 3-tone gradation: #FFFFFF / #F5EFE2 / #D9D2C2             |
| `fee9af3` | Off-white tones moved into the offline-status hue family: |
|           | bone[50]=#FFFFFF primary, bone[100]=#B8B2AA secondary,    |
|           | stone[300]=#857F7A tertiary (exact match to the offline   |
|           | "No recent reading" StatusPill tone — founder's pick).    |
|           | ViewToggle gets text+icon labels back ("BIRD'S-EYE" /     |
|           | "DETAILED") so it's unmistakably tappable. Animated       |
|           | coral thumb + spring physics retained.                    |

### Founder-requested feature (1 commit)
| Commit    | What                                                      |
|-----------|-----------------------------------------------------------|
| `130a223` | Parent age threaded into PersonCard eyebrow ("MOM · 71"). |
|           | Existing formatter; the data path was the gap.            |

### Issue #1 — Invite-code UX (3 commits)
| Commit    | What                                                      |
|-----------|-----------------------------------------------------------|
| `da9b95f` | Extract AcceptInviteSheet from Settings into reusable     |
|           | component. Same UI / error mapping / service call.        |
| `ba2a804` | Empty-state CTAs on CaregiverHome: primary "I have an     |
|           | invite code" (opens sheet) + secondary "Or invite         |
|           | someone yourself →" (routes to Settings → Family).        |
| `67172b6` | "Someone invited me" third card on FamilyWatch + new      |
|           | `completeViaInvite(familyId)` state method (atomic        |
|           | onboarding finalize, no create_family — joins existing    |
|           | family the invite resolved to).                           |

## Bench environment state

```powershell
& "$PWD\scripts\dev-phone-reconnect.ps1"
```

Checks: phone connected, Metro on :8081, Supabase Kong on :54321,
Edge Functions runtime alive, adb reverse forwards set. Re-apply the
reverses on every USB unplug/replug:
```
adb -s <serial> reverse tcp:8081 tcp:8081
adb -s <serial> reverse tcp:54321 tcp:54321
adb -s <serial> reverse tcp:54324 tcp:54324
```

Metro launch (the env var is **non-negotiable** — see DO/DON'T):
```
cd apps/mobile && EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo start --dev-client
```

Edge Functions:
```
supabase functions serve --env-file supabase/functions/.env
```

If `.env.local` is missing on a fresh checkout, copy from
`C:\Users\admin\Documents\APP\kena-app\` (gitignored). Make sure it
reads `EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321` for USB
testing — LAN works on paper but the MTN extender has historically
been flaky.

## What the next session needs to do

### A. From-scratch two-phone caregiver test (founder-driven)

Goal: walk the new Sprint 16.6 invite-code flow end-to-end on both
phones, starting from a clean state. The verified flow becomes a
PASS row in `plans/CAREGIVER_TEST_RESULTS.md`.

Sequence:

1. **Wipe + reinstall** on both phones to clear MMKV + auth state.
   Either uninstall the APK (`adb -s <serial> uninstall com.leiko.app`)
   then `scripts/build-preview-apk.ps1` from the main checkout, OR
   `adb shell pm clear com.leiko.app` to reset state without reinstall.
2. **Phone 1 — Biebele as self-buyer** (caregiving themselves):
   sign up via Mailpit OTP at http://localhost:54324 → onboard as
   self-buyer with their year-of-birth set (so PersonCard eyebrow
   renders the age) → pair Watch 1.
3. **Phone 1 — invite TheOne**: Settings → Family → "Invite a
   caregiver" → `lawonelimited@gmail.com` → Invite. Note the 6-digit
   code.
4. **Phone 2 — TheOne as caregiver, via the new invite path**:
   sign up via Mailpit OTP → caregiver onboarding (Intro1/2/3 +
   FamilyYou name) → FamilyWatch → **"Someone invited me"** (the
   new third card from `67172b6`) → AcceptInviteSheet → enter the
   code from step 3 + their own email → join. Should land
   straight on caregiver Home with Biebele in the constellation.
5. **Alt path** — bench the empty-state CTAs by also creating a
   third test caregiver who completes onboarding via "Add a watch
   later" (no invite), lands on empty Home, taps "I have an invite
   code", redeems → constellation populates.
6. **Cross-flow** — take a BP reading on Phone 1's watch, confirm it
   appears on Phone 2 in both bird's-eye + detailed views.

### B. Per-person dashboard drill-in (engineering — main task)

The current tap → "X readings synced" placeholder is `ParentReadingsList.tsx`
(Sprint 7 stopgap, header comment confirms: "Sprint 7 placeholder").
The founder wants the rich Self-Buyer-style immersive home for that
parent — every vital tile, every detail screen, the same look + drill
semantics as if they were viewing their own data.

**The smell:** `apps/mobile/src/screens/Home/CaregiverHome.tsx` line
~202 routes parent taps to `'ParentReadings'` (the placeholder). The
full target is the existing `SelfBuyerHome` (path:
`apps/mobile/src/screens/Home/SelfBuyerHome.tsx`) but family-scoped
to the tapped parent's `familyId`.

**Key constraints to design around:**

1. **Data scoping**. SelfBuyerHome reads from the signed-in user's
   own local readings + the server hydration hooks. For a parent
   view, every hook needs to filter by the parent's `familyId` not
   the caregiver's own family. Audit `useReadings`, `useSleep`,
   `useActivity`, `useHR`, `useSpO2`, `useFamilyReadings` (and the
   `useHydrate*FromServer` hooks) for the scoping path.
2. **Sleep / Activity / HR / SpO2 hydration**. The 5 hydration hooks
   currently target the signed-in user's family. A parent drill-in
   needs to take a `familyId` parameter — or a parallel set of hooks
   that swap the scope. See `memory/sprint_16_5e_close_out.md` for
   the existing hydration pattern; **READ IT BEFORE TOUCHING THE
   HOOKS** — that work is load-bearing and the 9 hard rules are
   listed in `memory/sprint_16_5d_close_out.md`.
3. **Detail screens already exist**:
   `apps/mobile/src/screens/VitalDetail/{BP,HR,SpO2,Sleep,Activity}Detail.tsx`.
   They likely need the same scoping treatment.
4. **Navigation contract**. The route currently is
   `ParentReadings: { familyId: string }` (`navigation/types.ts`).
   Either rename to `ParentDashboard` + replace the component, or
   keep the route name and swap the component. Renaming is cleaner
   but touches more files.
5. **Voice-rule check on every new string**. If the dashboard reuses
   the self-buyer's first-person copy ("Your BP is …"), it needs
   second-person rewording ("Biebele's BP is …" — or whatever
   relation + name carries the moment). See
   `docs/05-voice-and-claims.md`.

**Suggested plan shape (the next session should propose before
writing code):**

1. **Sprint card**. Decide if this is a continuation of 16.6 or a
   new Sprint 17a. It's a real chunk of work — probably 2-3 days.
2. **Architecture discovery**. Read SelfBuyerHome + the 5 hydration
   hooks + the existing VitalDetail screens + the family-scoped
   data services. Map exactly what needs to change to pass a
   `familyId` through.
3. **Foundation refactor**. Either:
   - **Option A**: parameterize the existing hydration hooks with
     an optional `familyId` (default = own user's family). One
     code path; less duplication; risk of regression on SelfBuyer.
   - **Option B**: parallel `useParentReadings(familyId)` /
     `useParentSleep(familyId)` etc. set. Cleaner separation;
     more files; harder to keep in sync if the canonical hook
     changes.
4. **Build `ParentDashboard` screen** (or `CaregiverParentHome` —
   name TBD) that composes the same primitives as SelfBuyerHome.
5. **Update CaregiverHome `handlePersonPress`** to route there.
6. **Voice-lint pass** on every reused string.
7. **Bench verify** on Phone 2 — tap Biebele on the bird's-eye view,
   see the full immersive dashboard with their data.

## Hard rules carried over (don't repeat the lessons)

1. **Dark mode is the default** (`d57206f`). Don't reintroduce
   `'system'` as the readPersistedOverride default — that's how the
   light-mode dim-text bug returns.
2. **Off-white tones live in the offline-status hue family**
   (`fee9af3`). bone[100] = #B8B2AA, stone[300] = #857F7A. These
   match the "No recent reading" pill tone the founder picked.
3. **Pure white #FFFFFF only for primary focal text** (orb names,
   person names, headlines, vital values). Body + tertiary use the
   warm-grey tones — pure white everywhere flattens the editorial
   register.
4. **No new family record on the invite path** (`67172b6`).
   `completeViaInvite` does NOT call create_family — the
   accept-family-invite Edge Function already linked the user via
   family_members.
5. **Metro is `cd apps/mobile && EXPO_NO_METRO_WORKSPACE_ROOT=1
   npx expo start --dev-client`** — anywhere else and the
   dev-client 500s on `Unable to resolve module ../../App`.
6. **Build the APK from the main checkout** (`C:\Users\admin\Documents\APP\kena-app`),
   never from a `.claude\worktrees\...` subtree.
7. **HR/SpO2 day-anchor timestamps use
   `watchVitalTimestampToUtcSec`** (memory rules from Sprint 16.5d).
   Server is source of truth for historical day-data.
8. **`useReadings.syncPending` sort by `measuredAtSec` DESC before
   slicing.** Hydration-hook gate is `localCount < FETCH_LIMIT`,
   not `=== 0`.
9. **`account_type` is immutable** — two-phone testing requires two
   real accounts (per the bench env memo).

## Background processes (may or may not still be alive)

If the next session starts cold, restart both:
- Metro: `cd apps/mobile && EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo start --dev-client`
- Edge Functions: `supabase functions serve --env-file supabase/functions/.env`

The reconnect script verifies state.

## Open prompt (what to say to the next session)

> Sprint 16.6 caregiver-flow polish + Issue #1 closed last session.
> Read `plans/NEXT_SESSION_START_HERE.md`, then
> `plans/sprint-16-6-pre-launch-validation.md`. Two parallel goals:
> (a) the founder will perform a from-scratch two-phone test of the
> new invite-code flow — be ready to triage any bug they hit; (b) the
> engineering task is to replace the Sprint 7 "X readings synced"
> placeholder with a proper per-person immersive dashboard, reusing
> the SelfBuyerHome primitives but family-scoped. Read
> `memory/sprint_16_5e_close_out.md` BEFORE touching any hydration
> hook — the 9 hard rules there are load-bearing. Propose a plan
> before writing code.
