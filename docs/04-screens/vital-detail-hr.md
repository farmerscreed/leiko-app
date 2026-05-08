# Screen — Vital Detail · Heart Rate

Sourced from D13 §8.3 + the design reference at `leiko-detail-screens.jsx` lines 113–188 (see `docs/_reference/design-bundles.md`).

The HR detail screen is one of five per-vital deep-dives reachable from the Self-Buyer Home constellation. Built on the Sprint 8.5 shared primitives: `DetailShell` + `VitalHero` + `StatTrio` + `VitalTrendChart` + `VitalInsightCard` + `CorrelationStrip` + the HR-specific `HRZonesCard`.

---

## Audience
- Self-buyer (primary)
- Caregiver — same screen viewed for self if a caregiver has an attached watch (Sprint 10 unlocks per-parent HR detail in family view)

## Purpose
Show the user a calm, full-context view of their heart rate today: resting BPM, headline stats (resting average, peak, variability), continuous trend through the day, time spent in HR zones, and a correlation between sleep and resting HR over the last seven days.

---

## Layout (top → bottom)

| Element | Spec |
| --- | --- |
| Header (DetailShell) | Glass back chevron + `HR` eyebrow + ellipsis menu (disabled until Sprint 10) |
| Vital hero | `VitalHero vital="hr"`. Resting BPM as `numericXl`; sub `Now · resting`; range copy `bpm · within your range`; ring fills via `hrFill(restingToday)` (D13 §7.1: `(resting − 40) / 80`, clamped). `livePulse={false}` until Sprint 15 streams HR. |
| Range pills | `7d / 30d / 90d` (DetailShell-owned). Sprint 8.5 ships the toggle UI; per-range data binning lands in Sprint 9. |
| Stat trio | Resting (7-day rounded avg) · Peak (max in last 24h) · Variability (placeholder `—` until Sprint 15 introduces HR streaming + HRV) |
| Trend chart | `VitalTrendChart` continuous line over the last 24h, ~16 binned points, range band `[60, 95]`, peak + trough markers, "Today · resting HR" caption. Hidden when there are < 2 samples in the window. |
| HR zones card | `HRZonesCard` — four rows: Resting < 60, Calm 60–80, Active 80–110, Vigorous 110+. Bars use the HR vital color with progressively higher opacity per zone (`.35 / .60 / .80 / 1`). Hidden when no samples have classified into any zone. |
| Correlation strip | `CorrelationStrip` — sleep × resting HR over the last 7 days. Caption "Sleep × resting HR — last 7 days". Hidden when either series has fewer than 2 days of data. |
| Insight card | `VitalInsightCard vital="hr"`. Placeholder body until Sprint 12.5's ambient-AI generator. |

---

## Hero state copy

- `restingToday` available → primary `<bpm>`, sub `Now · resting`, range `bpm · within your range`.
- `restingToday === null` → primary `—`, sub `Heart rate`, range `Wear the watch to start tracking your heart rate.`

All strings are voice-rule clean (no "patient", "diagnose", "predict", "dangerous", "critical", "loved one", "smartwatch"). The empty-state line frames the zero-data path as an invitation to start tracking, not as a missing or anomalous reading.

---

## Empty state

Triggered when `useDailyPulseData().hr.restingToday === null`:

- Hero shows `—`, the welcome line, and the inactive ring.
- Stat trio renders `—` for resting/peak; `Variability` stays placeholder.
- Trend chart and zones card are skipped.
- Correlation strip still renders if both HR-recent and sleep-recent have ≥2 days of history.
- Insight card body switches to the welcome paragraph.

---

## Behavior

- Default route: tap the HR tile on Self-Buyer Home → `VitalDetail` route with `params.vital === 'hr'` → `HRDetail` screen.
- Back chevron unwinds via the `onBack` prop the navigator wires.
- Range pill changes are local-only in Sprint 8.5; Sprint 9 reads the value to re-bin trend + correlation data.
- Live pulse on the hero ring stays off until Sprint 15 wires HR notify streaming detection.
- Reduced-motion (OS `Reduce Motion` enabled): trend draw-on, zone bar reveal, and ring breathe all bypass per the existing primitives' contracts.

---

## Voice rules

Per `docs/05-voice-and-claims.md`. Every string in this screen passes the voice gate:

- "Now · resting" — calm, plain language.
- "bpm · within your range" — descriptive, not predictive.
- "Wear the watch to start tracking your heart rate." — invitation, not warning.
- Insight paragraphs frame patterns ("settled three points lower", "tend to move together"); no diagnosis, no fear language.

Forbidden words (not present): "patient", "diagnose", "predict", "dangerous level", "critical level", "silent killer", "loved one", "smartwatch", "you may have", "we detected".

---

## Sprint 8.5 acceptance criteria

- `HRDetail` renders for both has-data and no-data paths.
- StatTrio, VitalTrendChart, HRZonesCard, CorrelationStrip, and VitalInsightCard all wire to the correct `useDailyPulseData` / `useHR` / `useSleep` selectors.
- Voice gate passes on every visible string.
- HRZonesCard renders four rows in the order Resting → Calm → Active → Vigorous, each with the right name, range, and percent.
- CorrelationStrip hides gracefully when sleep-or-HR history is absent.
- Trend chart hides when there are fewer than 2 samples in the last 24h.
- Snapshot test in dark mode covers the full has-data render.
- `npx tsc --noEmit` passes; `jest` for `HRDetail.test.tsx` + `HRZonesCard.test.tsx` passes.

D13 §8.3 reference.
