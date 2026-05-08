# Screen — Self-Buyer Home / Daily Pulse

**SUPERSEDES** D8a §6 (the Family Circle reframe → BP-only single-protagonist
layout) for the constellation pivot. Sourced from D11 (brand repositioning),
D12 §11.2.3 (DailyPulseHero), D13 §7 (Daily Pulse Hero behaviour), and the
design bundle linked in `docs/_reference/design-bundles.md` — specifically
`leiko-home.html` with the 4th "Recents" section swapped for the **Day Spine**
("Through your day") from `leiko-home-v2.html`.

> The screen that defines the brand. The constellation hero is the headline,
> the Day Spine is the narrative. Six scrolling sections plus a persistent
> tab bar and a Take-a-Reading FAB.

---

## Audience

Self-buyer (`account_type = 'self_buyer'`). Default tab on app launch (Tab Bar
position 1).

## Purpose

Show the user their five vitals at a glance, woven into a calm narrative of
the day so far. The constellation makes BP the headline; the Day Spine turns
isolated readings into a story; the AI narration ties them together in one
sentence (placeholder string until Sprint 12.5).

---

## Section order (top → bottom)

1. **Header** — "Tuesday · May 8" eyebrow + "Good morning, Adaeze." greeting + avatar
2. **Anomaly banner** (conditional) — `AnomalyBanner` per docs/10-anomaly-logic.md §5, **self-framed copy variant** per D8a §12.1
3. **DailyPulseHero (immersive)** — five concentric vital rings + adaptive central value (D13 §7.2) + ambient glow + AI narration line (placeholder until Sprint 12.5)
4. **AI narration card** — expandable contextual card under the rings; placeholder strings in Sprint 8 ("Your daily pulse is here.")
5. **Vital tile strip** — horizontal scroll, five `VitalTile` instances (BP · HR · SpO2 · Sleep · Activity)
6. **Correlation strip** — `CorrelationStrip` showing sleep × resting HR over the last 7 days
7. **Through your day** — `DaySpine` vertical timeline of moments derived from real readings + sleep boundaries (the swap; replaces the design's "Recents" history list)
8. **Tab bar (visual)** — four tabs (Home · Trends · Family · Settings). Sprint 8 wires Home + Settings only; Trends and Family render but route to a "Coming soon" placeholder until Sprints 9 / 10.
9. **Take-a-Reading FAB** — `button.accent`, anchored above the tab bar, opens the existing TakeReading walkthrough.

---

## Adaptive central value (D13 §7.2)

Pure function `pickCentralValue(data, nowSec)` picks one of four states by
priority:

| Priority | Condition | Format | Label |
|---|---|---|---|
| 1 | Fresh BP reading ≤ 8h old | `"128/82"` | `"morning BP"` (before noon local) / `"latest BP"` |
| 2 | HR sample ≤ 12h old | `"62"` | `"resting HR"` |
| 3 | Last night's sleep recorded | `"7h 24m"` | `"last night"` |
| 4 | None of the above | `"—"` | `"no readings yet today"` |

Tested in `apps/mobile/src/utils/__tests__/dayMoments.test.ts` (the priority
function is exported from the same module).

---

## DailyPulseHero — adapted states

The new constellation hero replaces the old D8a §6.2 hero card. The seven
"hero states" from the old spec map onto behaviour as follows:

| Old state | New behaviour |
|---|---|
| `fresh` | BP central value, AnomalyBanner absent |
| `fresh-elevated` | BP central value, calm-concerned AnomalyBanner above |
| `stale` | central value carries the most recent vital; AINarration card swaps to "Time for a new reading?" |
| `silent` (>72h) | central value falls through to `—`; AINarration card prompts for first reading |
| `anomaly-noted` | calm-concerned AnomalyBanner above hero |
| `confirmed-urgent` | confirmed-urgent AnomalyBanner above hero (no dismiss) |
| `watch-pending` | hero renders at no-data; AINarration card carries the wait-state copy |

Anomaly severity is sourced from the BP classification tier
(`in_pattern` / `calm_concerned` / `confirmed_urgent`) on `latestReading`.

---

## Through your day — Day Spine (the swap)

Replaces the design's "Recents" history list. Translates the v2 spine
visual: vertical thin coral-fading-to-rim line, time label (mono, right-
aligned, 10pt), colored dot per vital on the spine, serif title, sub-line.
Past moments at 0.55 opacity.

Moments are derived (no AI prose) from real data via `deriveDayMoments`:

| Source | Moment title | Sub-line |
|---|---|---|
| Last night's sleep session | "Sleep began" / "A quieter night" | `"7h 24m · X awakenings"` |
| Today's first BP reading | "Morning reading" / "Latest reading" | `"BP {sys}/{dia} · pulse {pulse}"` |
| Today's resting HR | "Heart resting" | `"{bpm} bpm"` |
| Today's overnight SpO2 dip if `< 92%` | "A brief oxygen dip" | `"SpO₂ {low}% — back up by morning"` |
| Today's step count if > 0 | "Moving so far" | `"{steps} steps"` |

All moment strings pass voice rules (no "patient" / "diagnose" / "predict" /
"dangerous"). Empty state: a single calm placeholder line ("Your day will fill
in as readings come in.") — never "No data".

---

## Hero card states — voice copy

| State | Eyebrow on hero | Inline AI card body |
|---|---|---|
| fresh | "Morning · in pattern" | "Your daily pulse is here." (placeholder until Sprint 12.5) |
| stale | "Latest reading" | "Time for a new reading? Tap below." |
| silent | "Welcome back" | "It's been a few days. Want to take a reading now?" |
| watch-pending | "Welcome" | "Your watch is on its way. We'll let you know when it arrives." |

Anomaly copy — from `AnomalyBanner.title` / `body`:

| Severity | Title | Body |
|---|---|---|
| calm-concerned | "Worth a look" | "Three of your readings this week were higher than usual. Might be worth talking to your doctor." |
| confirmed-urgent | "Talk to your doctor today" | "These last few readings are unusually high. We recommend talking to your doctor today." |

---

## Behaviour

- Pull-to-refresh + auto-refresh on app foreground via `useFamilyReadings`
  (re-used from caregiver home; the same Realtime channel covers self-buyers
  in their own family).
- Hero tap → opens `ReadingDetail` for the latest BP reading (or no-op when
  no reading exists).
- Tile tap → routes to `VitalDetail` (Sprint 8.5 deliverable; Sprint 8 ships
  a placeholder screen).
- DaySpine moment tap → opens `ReadingDetail` for the underlying reading
  (BP moments only; HR/SpO2/Sleep/Activity moments are inert until Sprint 8.5).
- FAB tap → `TakeReading` walkthrough (existing route, no regression).
- Tab bar — Home is active; Settings routes to `Settings`; Trends + Family
  route to a placeholder ("Coming soon — Sprints 9 / 10").

---

## Removed affordances vs caregiver home

- **No Family Constellation orbs** — single-protagonist, not a family-of-many.
- **No view toggle** (the constellation IS the view) — caregiver's
  bird's-eye/detailed toggle does not apply.
- **No "Add a family member" CTA** — equivalent action lives in Settings.

---

## Free vs Plus

Per `docs/09-paywall-and-iap.md`:

- Free tier sees latest reading + last 7 days of correlation. Beyond 7 days
  requires Plus.
- **Latest reading is NEVER paywalled** (D5 §3.4).
- AnomalyBanner is suppressed for free tier.
- Per D8a §2.3: **never up-sell on the home screen.** Paywall fires on the
  6th reading, not earlier.

---

## Voice rules (D8a §2.3 + §12.1 + docs/05-voice-and-claims.md)

- All self-buyer copy is **second-person**: "your reading", not "Mum's reading".
- Reassuring tone by default. Never countdowns. Never urgency timers.
- Forbidden: "patient", "user", "you may have", "we detected", "predict",
  "diagnose", "dangerous", "critical", "silent killer".
- Confirmed-urgent uses Tone D direct: "Talk to your doctor today" —
  never "you must" / "act now" / "before it's too late".

---

## Anti-patterns (CLAUDE.md + D8a §2.3 + D11 §3)

- **No streaks, badges, progress rings.** Self-buyers churn on apps that
  gamify their condition.
- **No count badges.**
- **No fear-based push.**
- **Don't use red for normal-state UI.** Crimson is reserved for
  `confirmed-urgent` AnomalyBanner only.
- **Don't auto-refresh the constellation aggressively.** Calm-before-clever:
  the daily-pulse-reveal animation fires once per session.

---

## Accessibility

- Hero exposes a single composed `accessibilityLabel` (per `DailyPulseHero`
  spec) reading the central value + every ring + the narration as one sentence.
- FAB: `accessibilityLabel: "Take a reading"`, hint "Walks you through taking
  a reading on your watch".
- DaySpine: each moment is a `Pressable` with label
  `"{time}: {title}. {sub}"`; the vertical spine is decorative (`accessibilityElementsHidden`).
- Tab bar: each tab is `accessibilityRole="tab"` with the active state surfaced
  on `accessibilityState={{ selected: ... }}`.

---

## Sprint 8 acceptance criteria

- All 4 D13 §7.2 central-value priority states render correctly
  (BP-fresh / HR-fallback / sleep-fallback / no-data).
- All 5 ring states render correctly per vital classification.
- Daily-pulse-reveal animation fires once per session.
- Live-pulse animation runs when any vital is currently capturing.
- AINarration card shows the placeholder string in Sprint 8
  ("Your daily pulse is here.") — replaced by real generator output in Sprint 12.5.
- FAB tap → existing TakeReading flow, no regression.
- Tile tap → navigates to `VitalDetail` placeholder route.
- DaySpine renders empty state when there are no derivable moments;
  renders past moments at 0.55 opacity; voice-checked.
- Anomaly banner renders above hero when latest reading classifies as
  `calm_concerned` / `confirmed_urgent`.
- Voice gate passes on every string.
- Snapshot tests cover all 4 central-value states + dark mode (light mode
  follow-up — caregiver-warm surfaces are dark-canonical for v1.0 per
  `apps/mobile/src/theme/tokens/color.ts`).
