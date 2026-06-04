# Screen — Parent Dashboard

> Sourced from [ADR-0006](../_adr/0006-unified-caregiver-self-buyer-model.md)
> (the unified caregiver / self-buyer model) and Sprint 17a. This is the
> **rich personal view** the unified constellation home opens when you tap a
> node. It replaces the Sprint 7 `ParentReadingsList` placeholder. The layout
> is the same Daily-Pulse-style immersive surface a self-buyer sees on their
> own Home (`self-buyer-home.md`), **family-scoped to the tapped person's
> `familyId`** instead of the viewer's own singleton data.

Implemented in `apps/mobile/src/screens/Home/ParentDashboard.tsx`. Its hero
composition helpers (`buildHeroVitals`, `buildCentralSub`) and the
`pickCentralValue` / `deriveDayMoments` utilities are shared with
`SelfBuyerHome.tsx` (imported directly), so the two surfaces stay visually
identical by construction.

---

## Audience

Caregiver (or any viewer following a circle). The viewing user is **not** the
wearer here — they're checking in on someone they care for. All copy is
caregiver-POV: "Checking in on {parentName}", "Talk to {name} today" — never
first-person, never "patient".

## Purpose

Show one followed person's five vitals at a glance, woven into the same calm
day-narrative the self-buyer gets for themselves: BP is the headline ring, the
Day Spine is the story, a calm-concerned banner surfaces when the person's BP
classification warrants a gentle check-in.

---

## When it's reached

- Route: `ParentDashboard` on `CaregiverStackParamList`, params `{ familyId }`
  (`apps/mobile/src/navigation/types.ts`).
- Entry: tapping a person's orb / `PersonCard` on the constellation Home
  (`caregiver-home.md`). On the unified home this is *any* node — including the
  viewer's own "You" node, which routes here scoped to the viewer's own circle.
- Back: the header chevron (`accessibilityLabel: "Back to family circle"`)
  pops to the constellation Home.

## Data sources

- **Identity** (display name, relationship, year of birth) — read from the
  `useFamilyReadings()` cache that CaregiverHome already keeps warm; the
  matching `ParentSummary` is found by `familyId`
  (`fetchParentSummaries.ts`). `parentDisplayName` drives every name string;
  fallback when absent is the neutral `"your loved one"`.
- **Vitals** — `useParentDailyPulseData(familyId)` (the Daily Pulse shape) and
  `useParentVitalsRecent(familyId)` (sleep + HR samples for the correlation).
  Both are **query-only**: no MMKV, no singleton writes. The dashboard never
  mutates the followed person's data.
- **Realtime** — one Supabase channel per `(table, familyId)` on `readings`
  and `vitals_other`; an INSERT for this `familyId` invalidates the
  `['parent-pulse', familyId]` query key and the view re-fetches. No manual
  refresh needed.

---

## Section order (top → bottom)

1. **PulseHeader** — eyebrow date ("Tuesday · May 8" style) + "Checking in on
   *{parentName}*." + a back chevron (replaces the self-buyer's settings
   avatar).
2. **SyncReassuranceBanner** — always present.
3. **ScreenAnomalyBanner** — global/account-level banner slot.
4. **Local AnomalyBanner** (conditional) — derived from the person's BP
   classification tier (`deriveParentBanner`). Caregiver-flavored copy.
5. **DailyPulseHero** — five concentric vital rings + adaptive central value;
   the whole hero is a `Pressable` → BP `VitalDetail`. `live: false` (the
   caregiver isn't capturing on this phone).
6. **Narration card** — **static placeholder** for v1: "Here's how
   {parentName} has been doing today." Tier-A AI narration is first-person /
   singleton-scoped; the parent-scoped variant is a deferred follow-up
   (sprint 17a decision §7). Labelled "Leiko · today".
7. **HomeLearnCard** (conditional) — general health-literacy slot from
   `useSeededLearnCard`; **not** scoped to the person's data. Opening an
   article routes to `Article`.
8. **Vital tile strip** — horizontal scroll, five `VitalTile`s (BP · HR · SpO2
   · Sleep · Activity). Each tap → `VitalDetail` for that vital + `familyId`.
9. **CorrelationStrip** (conditional) — sleep × resting HR over the last 7
   days, caption "Sleep × resting HR — last 7 days".
10. **DaySpine** — "Through the day" moments derived from the person's data;
    each moment tap → that vital's `VitalDetail`.

---

## The five vital tiles

| Vital | Value shown | Secondary | `no-data` shows |
|---|---|---|---|
| BP | `{systolic}/{diastolic}` | "mmHg" | `—` |
| HR | rounded `displayBpm` | "bpm latest" or "bpm resting" (by source) | `—` |
| SpO2 | `{percent}%` | "oxygen" | `—` |
| Sleep | `{h}h {m}m` last night | "last night" | `—` |
| Activity | `stepsToday` (localized) | "steps today" | `—` |

Each tile's ring fill comes from `buildHeroVitals(data)`; `state` is `normal`
when a value exists, `no-data` otherwise. SpO2 follows the wellness-estimate
framing per `docs/05-voice-and-claims.md`.

---

## Adaptive central value

Reuses `pickCentralValue(data)` (shared with `self-buyer-home.md`): fresh BP →
HR fallback → last night's sleep → `—`. The central label maps to "Blood
pressure" when BP is the priority, otherwise the picked vital's label.

---

## Anomaly banner copy (`deriveParentBanner`)

Severity comes from the person's BP classification tier. Name is
`parentDisplayName`, falling back to "them".

| Tier | Severity | Title | Body |
|---|---|---|---|
| `confirmed_urgent` | `confirmed-urgent` | "Talk to {name} today" | "Their recent readings are unusually high. Worth talking to a doctor today." |
| `calm_concerned` | `calm-concerned` | "Worth a chat with {name}" | "A few of {name}'s recent readings have been higher than usual. Might be worth a gentle check-in." |
| else | — | (banner absent) | |

All strings are voice-clean: no "patient", "diagnose", "predict", "dangerous",
"critical", "silent killer". The "her" pronoun trap from the 16.5 retro is
avoided by using the name directly rather than a gendered pronoun.

---

## States

| State | Visual |
|---|---|
| `loading` | Header + SyncReassuranceBanner stay visible; body replaced by `LoadingState` — "Loading {parentName}'s data…". Fires when the initial fetch is in flight and `data === null`. |
| `error` | Header + SyncReassuranceBanner stay; body replaced by `ErrorState` with a retry that re-runs `handleRefresh`. |
| `empty` (truly no data) | Hero, tiles, spine render at their `no-data` / `—` states; DaySpine shows its own calm placeholder. The empty case is deliberately **not** the loading or error case — the caregiver is never told the person "has no data" while a fetch is still in flight or has just errored (Sprint 18). |
| `default` | All sections rendered. |
| refresh | Pull-to-refresh re-runs both the family-readings list (for identity) and the parent-pulse query. |

---

## Not mounted (vs `self-buyer-home.md`)

The personal-home affordances are intentionally absent here, because the
viewer is a follower, not the wearer:

- **SelfBuyerTabBar** — navigation lives on the constellation Home.
- **TakeReadingFAB** — the caregiver doesn't take this person's readings on
  their own phone.
- **AskLeikoFAB** — OFF until the Tier-A intent router gets parent-scoped
  support.
- **HealthPlatformPermissionPrompt** — not the caregiver's own health data.
- **SixthReadingPaywallHost** — the paywall is mounted at the family level on
  CaregiverHome, not duplicated here.

Settings stays on CaregiverHome's gear icon.

---

## Relationship to the other home surfaces

- **`caregiver-home.md`** (the constellation) is the *index*; this screen is
  the *detail*. You arrive here by tapping a node and leave via the back
  chevron.
- **`self-buyer-home.md`** (Daily Pulse) is the *same layout for your own
  data*. Under ADR-0006 the two converge: a self-buyer tapping their own "You"
  orb lands on this surface scoped to their own circle; a caregiver tapping a
  followed person lands on it scoped to that person. The difference is purely
  the data scope and the omitted personal affordances above — not the visual
  composition, which is shared code.

---

## Voice rules

Per `docs/05-voice-and-claims.md`, all copy is caregiver third-person:
"Checking in on {name}", "Talk to {name} today", "Worth a chat with {name}".
Forbidden throughout: "patient", "diagnose" / "treat" / "predict" / "prevent",
"dangerous level", "critical level", "silent killer", and any outcome promise.
The static narration placeholder and banner bodies are written to Tone A /
Tone C respectively and pass the copy-lint gate.

---

## Accessibility

- PulseHeader is `accessibilityRole="header"`; the back control has
  `accessibilityLabel: "Back to family circle"`.
- The hero `Pressable` is a `button` only when a BP reading exists (hint:
  "Opens {name}'s blood pressure detail"); it falls back to `text` role when
  there's no reading, so an empty hero isn't announced as actionable.
- Tiles, DaySpine moments, and the Learn card carry their own labels from
  their shared components.

---

## Test hooks

Screen elements expose stable `testID`s prefixed `parent-dashboard-*`
(`-scroll`, `-hero`, `-hero-pressable`, `-anomaly-banner`, `-tile-bp` …
`-tile-activity`, `-correlation`, `-day-spine`, `-loading`, `-error`,
`-narration`, `-learn-card`, `-back`, `-sync-reassurance`). The helpers
`deriveParentBanner`, `buildParentCorrelation`, and `buildParentHeader` are
exported from the screen module for unit testing.
