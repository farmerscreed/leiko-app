# Screen — Vital Detail · Activity

Sourced from D13 §8.6, Q-D13-1, and the design bundle in
`docs/_reference/design-bundles.md` (`leiko-detail-screens.jsx` lines
360–507). One of five per-vital detail screens shipped in Sprint 8.5.

---

## Audience

- Self-buyer (primary — viewing their own day)
- Caregiver — tile drills here from the secondary-vital row on
  CaregiverHome (Sprint 9)

## Purpose

Show how today's movement is tracking against the user's daily step
goal, with calories + move minutes as supporting context, a 7-day bar
chart vs goal, and a calm goal-config affordance. No gamification.

---

## Layout (top → bottom)

| Section | Component | Notes |
| --- | --- | --- |
| Header | `DetailHeader` (vital="activity") | Standard chrome (back chevron, "ACTIVITY" eyebrow, ellipsis menu) |
| Hero | `ActivityRingsHero` (bespoke) | Three concentric rings (steps · calories · move) + giant step count + percent line + 3-dot legend |
| Range pills | `TimeRangePills` | 7d / 30d / 90d. Sprint 8.5 wires display only; Sprint 9 binds the data fetch |
| Stat trio | `StatTrio` | Daily avg (`steps · week`) · Best day (`<day name>`) · Streak (`days at goal`) |
| Weekly bars | `ActivityWeeklyBars` | 7 vertical bars + dashed goal line + `goal Nk` label · today bar carries a 0.5pt vital-color border |
| Pattern callout | `VitalInsightCard` (vital="activity") | Tier-B placeholder text until Sprint 12.5 |
| Recent days | Section eyebrow + `RecentReadingsList` (vital="activity") | Today + most-recent prior days with non-zero steps; each row has a vital-color rail |
| Daily step goal | Section eyebrow + tappable row → `ActivityGoalSheet` | Compact bottom sheet with 5 segmented options (4k / 6k / 8k / 10k / 12k) + helper copy + Save |

---

## Empty state

When `data.activity.stepsToday === 0` AND the rolling 7-day window has
no non-zero days:

- Hero shows `—` and the supportive line **"Start moving to see your day
  fill in."**
- Stat trio + weekly bars + recent-days list hide entirely.
- The `VitalInsightCard` body switches to a welcome paragraph.
- The goal-config row stays visible so the user can adjust their goal
  immediately if they want.

---

## Goal config

- Sheet uses `BottomSheet` (size="compact") so the underlying screen
  stays partially visible — the sheet is a nudge, not a modal hijack.
- 5 options: **4,000 / 6,000 / 8,000 / 10,000 / 12,000**.
- **Default goal is 6,000** (Q-D13-1) — lower than the typical 10,000.
  This is intentional and appropriate for hypertensive adults including
  elders.
- Helper line: *"We start at 6,000 — comfortable for most people. Adjust
  whenever you'd like."* No urgency, no "easy", no "simple".
- `onSubmit(newGoal)` fires on Save tap; the screen calls `onClose()`
  immediately. **Sprint 8.5 does not persist the new goal** —
  `useActivity.setTargetSteps?.()` is not yet implemented (Sprint 10
  wires real persistence). The screen accepts an `onGoalChange`
  override so the navigator can wire it earlier if the founder
  requests.

---

## Behaviour

- Default route: tap the Activity tile on Self-Buyer Home →
  `navigation.navigate('VitalDetail', { vital: 'activity' })`.
- Bars enter with a 70ms-staggered scaleY 0→1 animation (cinematic
  ease, 800ms duration). Reduced-motion bypasses the animation.
- Hero rings fade-in with the existing VitalRing `state="filling"`
  pattern (Sprint 7.6 motion contract) — Sprint 8.5 ships the rings in
  `state="idle"` because the bespoke composition stacks three rings;
  staggering them is deferred to Sprint 9.

---

## Voice rules (the no-gamification rule, called out)

Per CLAUDE.md anti-patterns + `docs/05-voice-and-claims.md`:

- **No** "Crush your goal", "Beast mode", "Killer week", "Level up",
  flames, badges, trophies, "Streak n days · 🔥".
- **OK**: "Streak 4 days at goal" — factual, supportive. "Met goal" —
  factual. "Take a walk this evening to close the ring" — supportive,
  the design's tone.
- **No**: "patient", "diagnose", "predict", "dangerous", "critical",
  "silent killer", "loved one", "smartwatch", "easy", "simple".

The `ActivityGoalSheet` test file includes a regex-based voice grep
that fails the build if any forbidden word slips into the rendered
tree.

---

## Sprint 8.5 acceptance criteria

- [x] All sections render in dark mode (and remain consistent in light
      mode — colors come from theme tokens).
- [x] Range toggle (7d / 30d / 90d) works (display-only; Sprint 9 binds
      data).
- [x] Empty state hides the weekly bars + stat trio + recent-days list
      and shows the welcome message in the hero.
- [x] Goal-config tap opens the bottom sheet; saving fires
      `onGoalChange(newGoal)`.
- [x] Voice gate clean — `grep -niE "patient|diagnose|silent killer|
      dangerous|critical|loved one|smartwatch|crush|beast|killer|easy|
      simple"` returns 0 hits in the four screen / component files.
- [x] Snapshot tests for `ActivityRingsHero`, `ActivityWeeklyBars`,
      `ActivityGoalSheet`, and `ActivityDetail` (populated, dark).
