# Sleep Detail

Per-vital detail screen for sleep. Reached from the Sleep tile on the
Self-Buyer Home (Sprint 8) → `VitalDetail` route with
`route.params.vital === 'sleep'`. One of five per-vital detail screens
shipping in Sprint 8.5; spec sourced from D13 §8.5.

## Audience

Self-buyer (default) and caregiver. The screen does not adapt copy to
account_type — sleep is presented in the second person ("your night",
"your usual"); caregiver framing is handled at the Family layer, not
inside per-vital detail.

## Purpose

Show last night at a glance — total time asleep, the broad shape of the
night across stages, and how that connects to morning blood pressure.
The screen avoids any pretense of clinical precision: the watch's stage
data is decent, not diagnostic.

## Layout (top → bottom)

1. **DetailShell** chrome — back button, "SLEEP" eyebrow, range pills.
2. **VitalHero** — ring at sleep-score fill, "7:42 / hrs", sub
   "Last night · in bed 11:14 pm", range copy keyed off the sleep score.
3. **StatTrio** — Deep / REM / Light. Each cell shows hours
   (`h:mm`) and the percent of total ("hrs · 21%").
4. **SleepHypnogram** — a 30-bin SVG timeline with four stage bands
   (AWAKE / REM / LIGHT / DEEP). Single sleep accent color, four
   opacity steps so the deepest stages read as the visual foreground.
   Time markers along the bottom (start / mid / end). Skipped in the
   empty state.
5. **CorrelationStrip** (optional) — sleep score × morning BP over the
   last 7 days. Hidden when either series has fewer than 2 datapoints.
   Caption: "Sleep × morning BP — last 7 days".
6. **VitalInsightCard** — Tier-B placeholder paragraph. Mentions deep
   sleep percent and the connection to morning readings without
   diagnostic claims (uses "about", "tends to", "your usual").
7. **Section eyebrow** "Last seven nights" + **RecentReadingsList** —
   the past four sessions, value formatted "h:mm", context "Last night
   · 21% deep" or "Tuesday · 18% deep".

## Hero state copy

| Sleep score | Range copy |
| --- | --- |
| ≥ 80 | "A quieter night than last week" |
| 65–79 | "Roughly in line with your usual" |
| 50–64 | "A lighter night than your usual" |
| < 50 | "A more restless night than your usual" |

## Empty state

When `data.sleep.session === null`:

- Hero primary `—`, sub "No sleep recorded last night", range copy
  "Wear the watch overnight to track your sleep."
- Hypnogram, correlation strip, and recent-readings list are all
  skipped.
- The insight card stays, with welcome body: "Wear the watch to bed and
  your sleep shape will land here in the morning. We highlight the
  night's stages and how they tend to line up with your morning
  readings."

## Behavior

- The screen subscribes to `useDailyPulseData` for the current session
  and to `useSleep` for the last four nights' history. `useReadings`
  feeds the morning-BP correlation.
- The hypnogram pre-bins transitions to 30 broad bands (`binCount`
  prop overrides for tests). The dominant stage in each bin wins;
  ties favour deep > rem > light > awake so the more interesting
  stages foreground.
- All stage minutes round to whole numbers. No millisecond display.
- All animations honour `useReducedMotion`. Hypnogram fade-in caps at
  1.5s total regardless of bin count.

## Voice rules (docs/05-voice-and-claims.md)

Every user-visible string in this screen is descriptive, not
predictive. Forbidden in this surface:

- "patient", "diagnose", "predict", "dangerous", "critical", "silent
  killer", "you may have", "we detected", "loved one", "smartwatch".
- **No false precision on stage data.** Stage copy uses "about",
  "roughly", "tends to". No "exactly". No "diagnostic". No "lower BP".

The insight card body is a placeholder; Sprint 12.5 replaces with the
Tier-B ambient-AI generator. The placeholder still passes the voice
gate.

## Sprint 8.5 acceptance criteria

- Renders cleanly in dark + light modes.
- Hero shows total / sub / range; range copy keys off `sleepScore`.
- Empty state replaces the hypnogram, correlation, and recent list
  with just the welcome insight card.
- Hypnogram renders 30 bins by default and the AWAKE / REM / LIGHT /
  DEEP stage labels.
- `binTransitionsToBands` returns the dominant stage per bin and
  defaults to all-light when transitions are empty.
- Voice gate passes against `docs/05-voice-and-claims.md` HARD-FAIL
  list. Stage copy avoids precision claims.
- Snapshot test covers the dark-mode "happy path" with a session.
