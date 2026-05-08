# Screen — Vital Detail · Blood Pressure

Sourced from D13 §8.2 (BP detail layout) + D12 §11.2 (detail-screen scaffolding) + the design bundle in `docs/_reference/design-bundles.md` (`leiko-detail-screens.jsx` lines 4–111). Sprint 8.5 deliverable. Replaces the Sprint 6 BPDetail visual prototype.

---

## Audience
- Self-buyer (their own BP)
- Caregiver (a parent's BP — same surface; copy still uses second-person "your reading" because the caregiver is reading the screen on the parent's behalf, and the per-parent context is set upstream)

## Purpose
The single-vital deep dive for blood pressure. Everything a person wants when they tap the BP tile from the constellation hero: latest reading + classification, 7-day stat headlines, today's hour-by-hour twin chart (sys + dia), a calm Tier-B paragraph explaining the pattern, and a list of the most recent readings.

---

## Layout (top → bottom)

| Element | Spec |
| --- | --- |
| `DetailShell` chrome | Vital-tinted top glow + back chevron + "BP" eyebrow + `TimeRangePills` (7d / 30d / 90d) below the hero |
| `VitalHero` | Ring (BP color, fill = `bpFillFromTier(tier)`) with the BP `Drop` icon centred. Giant numericXl primary `122`, smaller numericM secondary `/ 78`. Mono uppercase sub "Latest · 6:42 am". Range line keyed to tier — see table below. `livePulse` is `false` (BP is on-demand, not streaming). |
| `StatTrio` | 7-day avg · Lowest · Highest. Each value formatted `sys/dia`. Unit lines: `mmHg` for the avg; weekday short labels (e.g. "Tue") for low / high cells. |
| `BPTwinLineChart` (in card) | Eyebrow "Today · systolic & diastolic". Range band [110, 130] mmHg. 8 hour buckets (12a, 3a, 6a, 9a, 12p, 3p, 6p, 9p) — averaged from today's readings, with the design's mock series as fallback for empty buckets. Two-line legend: "Systolic · the first number" / "Diastolic". |
| `VitalInsightCard` | Tier-B placeholder paragraph until Sprint 12.5. Default body paraphrases the design's morning-coffee insight in voice-clean form. |
| Section eyebrow + `RecentReadingsList` | "Today's readings" + the last 4 BP readings sorted newest-first. Each row: vital-color rail + value + context line + relative time. Tap → `onSelectReading(localId)` so the router can push `ReadingDetail`. |

---

## Hero state copy table

The `range` line on `VitalHero` resolves from the BP `classification.tier`:

| `classification.tier` | Range line copy | Source |
| --- | --- | --- |
| `in_pattern` | `mmHg · within your range` | Tone A — Reassuring (D5 §3.5) |
| `calm_concerned` | `mmHg · worth a look` | Tone C — Calm-concerned (mirrors `tierChipText`) |
| `confirmed_urgent` | `mmHg · talk to your doctor today` | Tone D — Direct (mirrors `tierChipText`) |
| missing classification | `mmHg` | Fallback |

---

## Empty state (D8 §6.4)

When `data.bp.latest === null`:

- Hero: `primary` is `—`, `sub` reads `No readings yet`, `range` reads `Take your first reading whenever you're ready.`. Ring renders empty.
- `StatTrio`, `BPTwinLineChart`, and `RecentReadingsList` are **omitted entirely** — no skeletons, no placeholder rows. The empty hero + `VitalInsightCard` welcome paragraph is the full surface.
- `VitalInsightCard` body: "Once you take your first reading, this is where you'll see how it lands compared to your usual range. Patterns appear after a few days of readings."
- `TimeRangePills` still render — they're a no-op until data arrives, but their presence signals this screen will grow with the data.

No fear language, no "no data", no exclamation marks. Reassuring tone throughout.

---

## Behaviour

- Default route: tap the BP tile on `SelfBuyerHome` (or the equivalent caregiver tile) → `VitalDetailRouter` dispatches to `<BPDetail />`.
- Recent readings tap → `ReadingDetail` screen, deep-linked by `localId`.
- Range pill tap → state updates locally; the chart + stats will re-bin in Sprint 9 (data hookup is deferred to the trends sprint). For now the range pills swap visually but the body content stays "today" + "7-day stats".
- Live-pulse: BP is on-demand, not streaming, so `livePulse={false}` always. The hero ring renders idle.

---

## Voice rules

Per `docs/05-voice-and-claims.md`:

- All visible strings on this screen pass the HARD-FAIL dictionary. No `patient`, `diagnose`, `predict`, `prevent`, `dangerous`, `critical`, `silent killer`, `medical advice`, `loved one`, `you may have`, `we detected`, `smartwatch`.
- Tier-keyed copy mirrors the canonical `tierChipText()` strings: `In pattern` / `Worth a look` / `Talk to your doctor`. The hero's range line uses the contextualised `mmHg · ...` form.
- The `VitalInsightCard` placeholder paraphrases the design source: "Your morning numbers tend to climb roughly 8 points after coffee — a normal physiological response. The afternoon dip you usually see is here too. Talk to your doctor if you'd like to understand the morning band." This is voice-clean (informative tone, plain language, "talk to your doctor" anchor).
- Empty-state copy is Reassuring per D8 §6.4 ("Take your first reading whenever you're ready.").

---

## Sprint 8.5 acceptance criteria (BP slice)

- BP hero renders the latest sys/dia + tier-keyed range copy in dark + light mode.
- Empty state renders when `data.bp.latest === null` — no chart, no readings list, calm placeholder text.
- `BPTwinLineChart` renders 8 sys + 8 dia dots + a faint range band + the two-line legend, fed from today's hour-bucketed readings (or fallback when sparse).
- `RecentReadingsList` rows fire `onSelectReading(localId)` so the router can route to `ReadingDetail`.
- Voice gate passes on every visible string.
- Snapshot test in dark mode passes.
- The screen is presentational — no `useNavigation` calls — so the test suite mounts it without a `NavigationContainer`.

---

## Out of scope (Sprint 8.5)

- Real Tier-B insight generation (Sprint 12.5 — `VitalInsightCard` body is a placeholder).
- 30-day / 90-day chart data — the range pills swap visually only (Sprint 9).
- Cross-vital correlation strip (Sprint 9 / 12.5).
- BP anomaly engine refinements (Sprint 15).

## Source files

- Component: `apps/mobile/src/screens/VitalDetail/BPDetail.tsx`
- Specialised chart: `apps/mobile/src/components/BPTwinLineChart.tsx`
- Tests: `apps/mobile/src/screens/VitalDetail/__tests__/BPDetail.test.tsx`, `apps/mobile/src/components/__tests__/BPTwinLineChart.test.tsx`
- Design source: `docs/_reference/design-bundles.md` → bundle 01 → `leiko-detail-screens.jsx` lines 4–111.
