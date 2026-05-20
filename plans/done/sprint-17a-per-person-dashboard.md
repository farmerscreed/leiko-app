# Sprint 17a — Per-Person Dashboard

## Goal

Replace the Sprint 7 `ParentReadingsList` placeholder ("X readings
synced" page) with a proper per-person immersive dashboard. When a
caregiver taps a parent's orb (or PersonCard) on the constellation
Home, they should land on the **same** Daily-Pulse-style surface a
self-buyer sees on their own Home — every vital tile, AI narration
slot, history, and drill-in detail screens — but family-scoped to the
tapped parent's `familyId`.

Founder intent (verbatim): *"reuse the SelfBuyerHome primitives + the 5
VitalDetail screens, but family-scoped to the tapped parent's
familyId. The same look I get when viewing my own data as a self-
buyer."*

## Hard dependencies

- Sprint 16.6 caregiver-flow polish + invite-code UX complete
  (`5405a62`).
- `useFamilyReadings` + `fetchParentSummaries` (Sprint 7) — the
  existing cross-family READ path; the new data layer mirrors its
  conventions.
- All 5 server hydration hooks (Sprint 16.5e) — the slice-level shape
  + classifiers the new family-scoped layer composes.

## Docs to load

- `docs/04-screens/self-buyer-home.md` — composition spec the
  ParentDashboard mirrors.
- `docs/05-voice-and-claims.md` — every reused string from
  SelfBuyerHome must be re-voiced for caregiver POV before commit.
- `docs/01-data-model.md` §readings + §vitals_other — confirm the
  family-scoped query shapes.
- `memory/sprint_16_5e_close_out.md` — the 9 hard rules from the
  existing hydration pattern (timestamps, classifiers, recent caps).
  Read BEFORE writing the fetcher.
- `memory/sprint_16_6_caregiver_polish_close.md` — palette + voice
  context for the caregiver surface.

## Architecture decisions (approved 2026-05-19/20)

1. **Query-only family-scoped data layer (NOT singleton-slice
   parameterization).** The existing Zustand slices
   (`useReadings`, `useHR`, `useSpO2`, `useSleep`, `useActivity`) are
   per-app singletons holding the signed-in user's data. Threading a
   `familyId` into the hydration hooks would write the parent's data
   into the caregiver's singleton, polluting it. Instead: TanStack
   Query-backed read-only hooks, no MMKV writes, no singleton writes.
   The offline-first contract is for the device-paired user — a
   caregiver viewing remote family data is inherently online.
2. **Rename `ParentReadings` → `ParentDashboard`.** Old route name
   describes a list; new route is a dashboard. The route + placeholder
   file `ParentReadingsList.tsx` get deleted.
3. **VitalDetail screens are parameterized, not duplicated.** Each of
   `BPDetail`, `HRDetail`, `SpO2Detail`, `SleepDetail`,
   `ActivityDetail` takes an optional `familyId` route param. When
   set, the screen swaps `useDailyPulseData` →
   `useParentDailyPulseData(familyId)` and `useReadings/useHR/...` →
   `useParent*(familyId)`. When unset, behavior preserved exactly.
4. **Caregiver `VitalDetail` route gated to ParentDashboard entry
   only.** No other natural entry point exists in the caregiver stack
   today; opening the door wider invites accidental misuse. If/when a
   parent-scoped Trends ships, the contract widens then.
5. **Ask Leiko OFF on ParentDashboard for v1.** Tier-A intent router
   and Tier-B system prompt are first-person-scoped; rewording for
   caregiver POV is non-trivial and not core to "look at Mum's data".
   Deferred follow-up.
6. **Hybrid-mode branch in `CaregiverHome.handlePersonPress` is
   untouched.** The `useReadings.byLocalId` → ReadingDetail path stays
   for the case when the caregiver IS the parent on that phone.
7. **AI narration is a static placeholder for v1.** The real
   Tier-A `useDailyNarration` hook reads singleton slices; writing a
   parent-scoped variant is more than this sprint should swallow. The
   ParentDashboard narration slot renders a calm static line like
   *"Here's how Mum's been doing today."* until a follow-up sprint
   wires the real narration with a parent-scoped data context.

## Duration

~2 days end-to-end. Foundation (B1) ~half-day. VitalDetail
parameterization (B2) ~half-day. ParentDashboard screen (B3) ~half-
day. Navigation rename + tests + voice pass (B4-B5) ~half-day.

---

## Deliverables

### B1. Query-only family-scoped data layer (foundation)

Sequential, no agents. Main thread implements + commits before B2 can
fan out.

1. **`apps/mobile/src/services/families/fetchParentPulseData.ts`** —
   pure async function. Takes `(client, familyId, nowSec)`. Pulls the
   five vital snapshots from the family-scoped tables:
   - BP: latest `readings` row + last 14 for the recent-list/sparkline.
   - HR: last 200 `vitals_other` rows where `vital_type='hr'`.
   - SpO2: last 200 `vitals_other` rows where `vital_type='spo2'`.
   - Sleep: latest `sleep_session` row + last 30.
   - Activity: latest `steps_day` + `calories_day` rows + last 30.

   Runs the same classifiers (`classifyHR`, `classifySpO2`,
   `classifySleep`, `classifyActivity`, plus the BP classification
   already on the reading row's metadata) and returns a
   `ParentPulseData` shape that's structurally identical to
   `DailyPulseData` from `state/dailyPulse.ts` so VitalDetail screens
   can swap data sources without conditional logic.

   The function ALSO returns the per-vital recent arrays in
   `ParentPulseRecent` so VitalDetail screens can render history without
   a second round-trip.

2. **`apps/mobile/src/hooks/useParentDailyPulseData.ts`** — TanStack
   Query wrapper. `useParentDailyPulseData(familyId)`. Same shape as
   `useDailyPulseData()`. Cache key: `['parent-pulse', familyId]`.
   Stale-while-revalidate; manual refresh exposed.

3. **`apps/mobile/src/hooks/useParentVitalsRecent.ts`** — sibling hook
   surfacing the `ParentPulseRecent` arrays
   (`readingsRecent`, `hrRecent`, `spo2Recent`, `sleepRecent`,
   `activityRecent`). One hook, multiple cached arrays, single
   familyId.

4. Realtime subscription for the parent's family — invalidate the
   `parent-pulse` cache key on INSERT into either `readings` or
   `vitals_other` for the active `familyId`. Same pattern
   `useFamilyReadings` already uses, mounted from the dashboard screen.

### B2. VitalDetail screen parameterization

Five small refactors. Each detail screen accepts an optional
`familyId` route param. When present:
- Swap `useDailyPulseData()` → `useParentDailyPulseData(familyId)`.
- Swap `useReadings(...)` / `useHR(...)` / etc. → the parent-scoped
  equivalents from `useParentVitalsRecent`.
- Header back action stays the same; on the caregiver stack, back
  returns to `ParentDashboard` automatically.

Behavior with no `familyId` (self-buyer entry) preserved exactly. No
parallel `Parent*Detail.tsx` files — one path per screen.

### B3. ParentDashboard screen

`apps/mobile/src/screens/Home/ParentDashboard.tsx`. Mirrors
`SelfBuyerHome.tsx` composition:

- Pulse header — eyebrow date + greeting ("Checking in on Mum") +
  back chevron (to caregiver Home). No Settings button on the right
  (top-right reads as "Settings" on self-buyer; on parent dashboard
  it's not needed — Settings stays on CaregiverHome).
- `SyncReassuranceBanner` + `ScreenAnomalyBanner` (both already
  family-scoped or anomaly-driven, no changes needed).
- Local `AnomalyBanner` derived from the parent's BP classification.
- `DailyPulseHero` — parent-scoped data. Tap routes to
  `VitalDetail{ vital: 'bp', familyId }`.
- Narration card — static placeholder copy (decision 7 above).
- "Worth a read" Learn card slot — same `useSeededLearnCard` hook
  (self-buyer flavor). Renders on the parent surface too — it's
  general health-literacy content, not user-data-scoped.
- Horizontal vital tile strip — 5 tiles, each taps into
  `VitalDetail{ vital, familyId }`.
- Correlation strip — sleep × HR for the parent.
- DaySpine — `deriveDayMoments(parentData)`. Moments tap into
  `VitalDetail{ vital, familyId }`.

NOT mounted on ParentDashboard:
- `SelfBuyerTabBar` (caregiver stack already has its own
  affordances). Use a top back-button instead.
- `AskLeikoFAB` (decision 5).
- `TakeReadingFAB` (the caregiver doesn't take the parent's readings
  on this phone).
- `HealthPlatformPermissionPrompt` (own-phone-only).
- `SixthReadingPaywallHost` (already mounted from CaregiverHome).

### B4. Navigation rename + plumbing

- `apps/mobile/src/navigation/types.ts` — rename
  `ParentReadings: { familyId: string }` →
  `ParentDashboard: { familyId: string }`. Add
  `VitalDetail: { vital, familyId }` to `CaregiverStackParamList`.
- `apps/mobile/src/navigation/RootNavigator.tsx` — register
  ParentDashboard + caregiver VitalDetail.
- `apps/mobile/src/screens/Home/CaregiverHome.tsx` lines 202 + 213 —
  navigate to `'ParentDashboard'` instead of `'ParentReadings'`.
- `apps/mobile/src/screens/Home/ParentReadingsList.tsx` — DELETE.
- `apps/mobile/src/screens/__tests__/CaregiverHome.test.tsx` — update
  expectation `ParentReadings` → `ParentDashboard`.
- `apps/mobile/src/components/HealthPlatformPermissionPrompt.tsx` —
  any stale `ParentReadings` reference (auditing needed).

### B5. Voice-lint pass + tests

- Every reused string from SelfBuyerHome rewritten for
  second/third-person caregiver POV. Examples:
  - "Good morning, {self_name}" → "Checking in on {parent_first}"
  - "Talk to your doctor today" →
    "Worth a chat with {parent_first} about seeing a doctor"
  - "Your blood pressure is in pattern" →
    "{parent_first}'s blood pressure is in pattern"
- Pronouns from `parentDisplayName` + `parentRelationship` (the 16.5e
  hard rule: hardcoded `'her'` is wrong).
- New unit tests for `fetchParentPulseData` (mocked Supabase client,
  exercise each vital's shape).
- New screen test for `ParentDashboard` (mocked
  `useParentDailyPulseData`, snapshot pass).
- One integration test: BPDetail with `familyId` route param sources
  from `useParentDailyPulseData` (not the singleton).

## Acceptance criteria

1. Tapping a parent's orb on Phone 2's bird's-eye Home opens
   `ParentDashboard` with the full immersive composition.
2. Each vital tile on `ParentDashboard` drills into the matching
   VitalDetail screen, showing the parent's data (not the caregiver's
   own).
3. Hybrid-mode (caregiver IS the parent on that phone) still routes
   to `ReadingDetail` for in-phone local readings. Unchanged.
4. The deleted `ParentReadingsList.tsx` "X readings synced"
   placeholder is gone.
5. `tsc --noEmit` + `npm run lint` + `jest` all pass.
6. Voice-lint passes on every new user-visible string.
7. On-device verification — tapping Biebele on Phone 2 lands on the
   immersive surface; tapping a vital tile drills in correctly; back
   returns to the constellation.

## Risk notes

- **Realtime sub fan-out**: each visible ParentDashboard will mount
  its own Realtime channel. With 1–3 parents this is fine. If a
  caregiver has many parents, a future polish could pool subscriptions
  via a context provider. Not a v1 concern.
- **No offline support on ParentDashboard**: by design (decision 1).
  If the network is down on Phone 2, the dashboard renders an empty
  state. Existing `OfflineBanner` is already mounted at the navigator
  level so the user sees a calm cue.
- **Voice-lint blast radius**: the pronoun substitution touches every
  reused copy line. Easy to miss one. Run voice-lint twice — once
  after authoring, once after on-device review.

## Out of scope (explicit deferrals)

- Real Tier-A AI narration on ParentDashboard (placeholder for v1).
- Parent-scoped Ask Leiko (Tier-A + Tier-B prompt rework).
- Parent-scoped Trends / For-your-doctor surfaces.
- Caregiver-mode anomaly-banner rewording per parent
  (`ScreenAnomalyBanner` is already family-scoped and works as-is).
- A `lookup-by-email` pre-check on `send-family-invite` to catch
  typos (would have caught the `hotmail`/`gmail` mismatch in
  `CAREGIVER_TEST_RESULTS.md` F2). Tracked as a follow-up.

## Open prompt for next session

Sprint 17a starts with the foundation: `fetchParentPulseData` +
`useParentDailyPulseData` + `useParentVitalsRecent`. Read
`memory/sprint_16_5e_close_out.md` BEFORE touching any data shape —
the 9 hard rules (especially HR/SpO2 day-anchor + the
`useReadings.syncPending` sort) are load-bearing here too. After the
foundation commits, fan out the 5 VitalDetail parameterizations in
parallel agents (one per screen).
