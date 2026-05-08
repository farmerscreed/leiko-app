# Screen — Caregiver Home

Sourced from D11 (brand repositioning) + D13 §7.4 (Family Circle) + the
Sprint 7.7 design `leiko-caregiver-unified.html`.

**Status:** Sprint 7.7a shipped 2026-05-08 (bird's-eye view). Sprint 7.7b
ships the editorial-card view + segmented toggle + cinematic transition.

---

## Audience
Caregiver. Default tab on app launch (Tab Bar position 1).

## Purpose
At-a-glance status of every family member the caregiver is looking after.
The single screen the caregiver should be able to glance at and feel
reassured.

---

## Two view modes (one screen)

The caregiver home presents the same data through two complementary lenses,
toggled by a top-right segmented control. The choice persists across launches
via MMKV (`leiko.caregiver.viewMode`).

### Bird's-eye (`birds`, default — Sprint 7.7a)
Each loved one is a glowing `PersonOrb` arranged around a centre "You" mark
in a `ConstellationField` (SVG starfield + dashed orbital rings + faint
per-person connection lines). Status drives glow + pulse + dot:

| Status | Halo behaviour | Overlay |
| --- | --- | --- |
| clear / watch | Gentle 4s pulse | none |
| attention / urgent | Faster 1.6s pulse | top-right status dot |
| sleeping | Static, faded (25%) | top-right moon glyph |
| offline | Static, dim | none (legend StatusPill carries the label) |

A `ConstellationLegend` below the field has one row per person — accent
dot + first-name + relation + headline + StatusPill. Both the orbs and
the legend rows are tap targets.

### Detailed (`cards` — Sprint 7.7b)
Vertical stack of editorial cards, one per person. Portrait initial +
italic Instrument-Serif headline ("A calm morning.") + AI prose paragraph
+ four-vital row (BP/HR/SpO₂/Sleep) + footer with last-read timestamp +
"Open ›".

---

## Shared chrome (both modes)

| Element | Spec |
| --- | --- |
| Header | "Leiko · Family" eyebrow (mono uppercase, brand coral) + date (mono uppercase, text.tertiary) on one line; "Good morning" greeting below (mono uppercase, text.tertiary). User-name personalisation (e.g. "Good morning, Adaeze") is deferred to Sprint 10 user-profile work. |
| Anomaly Banner (conditional) | `<AnomalyBanner>` — most-severe-wins across all family members. Confirmed-urgent fires immediately ("Talk to {firstName} now"); calm-concerned only if no urgent person exists ("Worth a chat with {firstName}"). CTA routes to that person's drill-in. |
| View toggle (Sprint 7.7b) | Top-right segmented control — Bird's-eye ↔ Detailed. Glass background, coral active state. |
| Action bar | `<CaregiverActionBar>` pinned at the bottom: "{count} · all in your circle" + "+ Add someone" affordance (only visible if caregiver is `family_owner` with capacity remaining — Plus = up to 5 caregivers; gate not yet wired in 7.7a). |
| Background | `surface.warmBase` (warm-charcoal `#0A0908`). Light mode is intentionally a Sprint 1.6 follow-up — caregiver home is dark-canonical for v1.0. |
| Tab bar | Visible — Home tab active |

---

## Drill-in

Tap any orb (or legend row, in Sprint 7.7b also any editorial card) →
navigates to `ReadingDetail` with the person's latest `readingLocalId`.
Sprint 8.5 introduces a per-parent immersive `DailyPulseHero` screen as
the proper drill target; until then the existing `ReadingDetail` carries
the load.

When a person has no latest reading and no paired watch, tapping routes
to `Pairing`. When they have a paired watch but no readings yet, the tap
is a no-op (Sprint 8.5 takes over).

---

## Empty states

Per `docs/05-voice-and-claims.md` (verified empty-state copy):

### No parents in family circle

| Element | Value |
| --- | --- |
| Headline | "Your family circle is quiet for now" (Instrument-Serif, displayM) |
| Body | "Add a family member to start sharing care." |
| CTA | `button.primary` "Add a family member" |

### Parents added but no readings yet

The empty per-person headline is `"No readings yet"` (carried in the
legend `headline`). The per-person `bpLabel` shows `"—"` and the
`status` is `clear`. The screen-level CTA is "Pair watch" → routes to
Sprint 5 watch-pairing — only when `pairedDevice` is null.

Per CLAUDE.md anti-pattern: **every screen has an empty state**. This is
canonical. Never "No data".

---

## Behaviour

- **Pull-to-refresh** triggers `/sync` via the orchestrator + invalidates
  the family-readings TanStack Query.
- **Realtime updates**: existing `useFamilyReadings` Supabase Realtime
  subscription on `public.readings WHERE family_id IN (caregiver's
  families)`. New readings push into the bird's-eye + legend live.
- **Owning-phone first-paint merge**: if the local-MMKV latest reading
  is newer than the server's view of the owner-family, prepend it. Same
  helper (`mergeLocalLatest`) the legacy screen used.

---

## Status taxonomy (six states)

`docs/_reference/D13-multi-vitals-constellation-spec.md §6` + the
classifier in `apps/mobile/src/utils/classification.ts`. Mapping is in
`apps/mobile/src/utils/caregiverPerson.ts`:

| Status | Source | Surface label |
| --- | --- | --- |
| clear | `classifyReading.tier === 'in_pattern'` AND fresh (≤12h) | "All clear" |
| watch | 3-day BP trend up (Sprint 15 deferral; v1 treats as clear) | "Watch" |
| attention | `classifyReading.tier === 'calm_concerned'` | "Needs attention" |
| urgent | `classifyReading.tier === 'confirmed_urgent'` | "Urgent" |
| offline | latest BP measured > 12h ago (D13 §6 BP threshold) | "No recent reading" |
| sleeping | active sleep session within last 4h (Sprint 8.5+ deferral; never returned by v1 hook) | "Sleeping" |

**Staleness wins over classification.** A 13-hour-old 200/130 reads as
`offline`, not `urgent` — the data is too old to act on. Sprint 15
anomaly engine may revisit.

---

## Per-person palette

Three rotating accents — `theme.colors.person.{1,2,3}`:

1. Coral `#FF7350`
2. Amber `#F2A618`
3. Periwinkle `#7B67CC`

Caregivers with > 3 family members rotate through. The palette draws
from the same chromatic family as `theme.colors.vital.*` (HR coral,
BP/SpO2 amber/teal, sleep violet) so the system reads as one.

---

## Voice

Per `docs/05-voice-and-claims.md`:
- Reassuring tone by default; calm-concerned only when a parent is in
  that state.
- Headlines sentence-case. Never countdowns. Never urgency timers.
- Per-person headlines are deterministic placeholders until Sprint 12.5
  AI narration:
  - clear: `"Read 4 hr ago — in pattern."`
  - attention: `"Worth a chat — pattern's a little off."`
  - urgent: `"A calm check-in helps right now."`
  - offline: `"Last reading 13 hr ago"`
  - no-data: `"No readings yet"`

---

## Anti-patterns (CLAUDE.md)

- **Don't use red for normal-state UI.** Red (`status.urgent` `#EE343B`)
  is reserved for confirmed-urgent — orb attention dot + AnomalyBanner
  surface only.
- **Don't add count badges.** No "3 new" pill on the family circle.
- **Don't auto-fill medical data fields based on prior values.**
- **Don't add fear-based push notifications.** This screen reflects what
  the user receives — keep it calm.

---

## Accessibility

- Each `PersonOrb` is a button with composed `accessibilityLabel`:
  `"{firstName}, {status label}, blood pressure {bpLabel}"`.
- Each `ConstellationLegend` row is a button with composed label:
  `"{firstName}, {relation}, {status label}, {headline}"`.
- AnomalyBanner: `accessibilityRole="alert"` + `accessibilityLiveRegion`
  (`"assertive"` on confirmed-urgent, `"polite"` on calm-concerned).
- VoiceOver order: header → banner (if present) → constellation field →
  legend rows top-to-bottom → action bar.
- Reduced motion (D12 §7.4): orb halo pulse + `dailyPulseReveal`
  staggered entrances are DISABLED. Verified by
  `apps/mobile/src/components/__tests__/reducedMotion.test.tsx`.

---

## Sprint 7.7a acceptance criteria (closed 2026-05-08)
- Bird's-eye view renders correctly in dark mode.
- Empty + populated states render correctly.
- Realtime new-reading insertion updates the correct person's status
  via `useCaregiverFamily` → `useFamilyReadings` Realtime path.
- Tap a person → `ReadingDetail` for that parent's latest reading.
- AnomalyBanner shows for at least one calm-concerned + one
  confirmed-urgent fixture (most-severe-wins).
- Voice gate passes on every authored string.
- Component + integration tests cover empty, populated, anomaly,
  drill-in states.
- All caregiver-mode token contrasts ≥ 3:1 against
  `surface.warmBase` (verified — best 9.7:1 amber, worst 4.4:1
  periwinkle/sleep).

---

## D8a status — SUPERSEDED

D8a §6 SUPERSEDES D8 §4.5 for the self-buyer track. This document
SUPERSEDES D8 §4.5 for the caregiver track as of 2026-05-08 — the
Family Circle metaphor is preserved per D13 §7.4, but the BP-only
ReadingCard stack is replaced by the Family Constellation per the
`leiko-caregiver-unified.html` design.

The legacy implementation lives at
`apps/mobile/src/screens/Home/CaregiverHome.legacy.tsx` until Sprint
7.7b ships the editorial-card view; remove the legacy file in the 7.7b
close-out.

In **hybrid mode** (a self-buyer who invited a caregiver), the caregiver
sees this screen with the self-buyer's data as one orb in their Family
Circle. Per D8a §1.3 hybrid asymmetry: each user sees the metaphor that
fits their role.
