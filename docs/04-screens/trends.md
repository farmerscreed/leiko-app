# Screen — Trends

Sourced from D13 §10.1 (multi-vital trends + range selector) + D13 §9 (correlation cards) + D11 §3.6 (premium-precise voice) + D8a §9 (paywall trigger). Sprint 9 deliverable. Supersedes the Sprint 6 BP-only Trends spec.

> **Paywall lever**: ranges beyond 7 days are Plus-only. The 7-day range, the latest reading, and the multi-vital chart at 7d are always free. Per `docs/09-paywall-and-iap.md` §2.

---

## Audience

- Self-buyer (their own data)
- Caregiver (a parent's data — same surface; the per-parent context is set upstream by the family-member picker on Caregiver Home)
- Parent (read-only, large-text variant — see "Parent-side trends" below)

---

## Purpose

Show how the five vitals move across time, surface up to three meaningful cross-vital patterns, and produce a doctor-shareable PDF that captures the same picture in clinical-but-premium typesetting.

---

## Layout (top → bottom)

| Element | Spec |
| --- | --- |
| Header | Back chevron + `type.headline` **"Trends"** (caregiver) OR **"Your trends"** (self-buyer per D8a §8.1) |
| Range selector | `Pill` chips: **7d** (free) · **30d** (Plus) · **90d** (Plus) · **1y** (Plus). Default = 7d for free, 30d for Plus. Tapping a Plus-only chip while free → paywall sheet rises; chart returns to 7d on dismiss. |
| Vital toggle row | Five `Pill` chips with vital colour swatches: **BP · HR · SpO2 · Sleep · Activity**. Default visible: BP + HR + Sleep. SpO2 + Activity off. Toggle hides/shows the matching series live without re-fetching data. |
| `MultiVitalChart` (in card) | Multi-series SVG chart over the selected range. Each visible series is normalized to its own min–max so the chart reads as a *trend* picture rather than an absolute comparison; the legend row above the chart shows each vital's latest value in its own unit so absolute scale stays accessible. Anomaly points highlighted with a small marker. |
| Correlation cards | Up to **three** full-width cards, one per `is_meaningful = true` row from `public.correlations` (per D13 §9.1). Each card: `narrative_short` headline · `narrative_long` body · stat line ("over the last 30 days, n=24"). Sorted by `|pearson_r|` descending. |
| Weekly summary card | Tier-C narrative when `weekly_summary` rows exist for this user. Until Sprint 12.5 ships the generator, the card renders the placeholder copy below. |
| `RecentReadingsSection` | Mode-appropriate recent readings strip — same component as the home screen. Caregiver: per-parent. Self-buyer: own readings. |
| Export CTA | `button.primary` **"Share with your doctor"** (caregiver) OR `button.secondary` **"Save as PDF for my doctor"** (self-buyer per D8a §8.4). Free-tier tap → paywall sheet. Plus-tier tap → PDF preview sheet. |
| "View as table" toggle | `button.ghost` above the chart. Flips to a sortable list — accessibility essential per D8 §3.10. |

---

## Range chip behaviour

| Chip | Free tier | Plus tier |
| --- | --- | --- |
| 7d | Selectable, default | Selectable |
| 30d | Tap → paywall sheet (`hero=Understand your numbers` for self-buyer, `Stay close, every day` for caregiver) | Selectable, default |
| 90d | Same paywall trigger | Selectable |
| 1y | Same paywall trigger | Selectable |

The chart re-bins when the range changes:
- 7d: hourly buckets for HR/SpO2; daily aggregates for Sleep/Activity; reading-level for BP.
- 30d: daily aggregates for all five.
- 90d / 1y: weekly aggregates for all five.

---

## Vital toggle behaviour

- Toggling a vital chip flips the matching series visibility on `MultiVitalChart`.
- Toggle state persists per-session (resets on app restart — keep it simple for v1.0).
- a11y: each chip uses `accessibilityRole="switch"` + `accessibilityState: { checked: boolean }`.
- VoiceOver labels: e.g., "Show heart rate", "Hide blood pressure".

---

## Empty state

Per `docs/05-voice-and-claims.md`:

| Element | Value |
| --- | --- |
| Headline | "Trends will appear here next week" |
| Body | "We need a few days of readings before we can show a pattern." |
| CTA | (none) |

The empty state replaces the chart card. Range chips and the export CTA are hidden in this state — there's nothing to chart and nothing to export. Correlation cards and the weekly summary card are also hidden.

---

## Weekly summary placeholder (until Sprint 12.5)

Until Sprint 12.5 ships the Tier-C generator, the weekly summary card renders deterministic copy:

| Element | Value |
| --- | --- |
| Eyebrow | "This week" |
| Body | "Your first weekly summary will appear next Sunday." |
| State | `card.muted` — calm, no shimmer, not a banner |

When the generator lands, this card gets replaced with the real narrative; the layout slot stays the same so nothing else moves.

---

## Correlation cards

Cards are populated from `public.correlations` rows where `is_meaningful = true`, scoped to the selected user and the most recent `computed_at` per `correlation_type`. See `docs/15-correlation-engine.md` for the engine and statistical rules.

Layout:

| Element | Spec |
| --- | --- |
| Eyebrow | Vital-pair name in `type.eyebrow` (e.g., "Sleep · Blood pressure") |
| Headline | `narrative_short` — short, factual line (e.g., *"On nights you slept under 6 hours, your morning BP averaged 8 points higher."*) |
| Body | `narrative_long` — one paragraph, plain-language, voice-passing |
| Stat line | "Over the last 30 days · n=24" — sample-size disclosure |

States:
- `default` — `card.elevated`, vital-pair colour rail down the left edge
- `loading` — skeleton with the eyebrow + 2 lines of body
- `none` — when no meaningful correlations exist, the slot is hidden entirely (no "no patterns yet" empty card; restraint matters per D13 §9.1)

Cap: at most **3** cards, sorted by `|pearson_r|` descending. v1.0 has only three correlation types defined; this cap is also the natural ceiling.

---

## Doctor PDF export

The export CTA opens a bottom sheet (Plus only — free-tier taps the CTA, paywall sheet rises instead):

| Element | Spec |
| --- | --- |
| Title | "Share with your doctor" |
| Range selector | Mirrors the screen's current range. User can override before generation. |
| Options | Two checkboxes: "Include notes" · "Include caregiver comments" (caregiver only). Both default on. |
| Preview | Cover page thumbnail + page count |
| `button.primary` | "Generate PDF" |
| `button.ghost` | "Cancel" |

Tapping "Generate PDF" calls Edge Function `generate-doctor-pdf`. Returns a signed URL; the app opens the native share sheet. PDF structure + voice rules per `docs/15-correlation-engine.md` §"Doctor PDF" and D13 §10.2.

PDF cover line passes voice gate. Two variants by `account_type`:

- **Caregiver mode**: *"This report is general information from {parent_name}'s Leiko watch. It is not a diagnosis. Please discuss with their doctor."*
- **Self-buyer mode**: *"This report is general information from your Leiko watch. It is not a diagnosis. Please discuss with your doctor."*

---

## Parent-side trends (D8 §4.14 / large-text mode)

Different layout for parent users:
- Vertical list, each row 80pt min height
- `type.numeric-l` for the latest reading values
- `type.body-l` for relative time ("Tuesday morning")
- `Pill` chip for in-range status
- **No multi-vital chart, no correlation cards, no PDF export** — simplicity total
- Per CLAUDE.md "limited cognitive load: at most 3 actions on any screen"

---

## States

| State | Visual |
| --- | --- |
| `default` | Range + toggles + chart + correlations + summary + recent + export |
| `loading` | Skeleton chart (no shimmer under reduced motion) + skeleton stat headline above |
| `empty` | Empty-state card replaces the chart; correlation/summary/export hidden |
| `paywalled-range` | Range chip tap → paywall sheet; chart returns to 7d once dismissed |
| `paywalled-export` | Export CTA tap → paywall sheet; no PDF generated |
| `error` | Friendly cause + fix per `docs/05-voice-and-claims.md` error pattern; "Try again" CTA |

---

## Voice

Per `docs/05-voice-and-claims.md` + D11 §3.6 premium-precise examples:

- Range chip names are short, mono-uppercase: `7D` · `30D` · `90D` · `1Y`. No "weekly" / "monthly" framing — those are user-built mental models, not chip copy.
- Correlation card headlines are descriptive, never prescriptive (D13 §9.5). ✓ *"On nights you slept under 6 hours, your morning BP averaged 8 points higher."* ✗ *"Sleep more to lower your BP."*
- Weekly summary placeholder uses present-tense future — *"Your first weekly summary will appear next Sunday."* — not aspirational ("get personalised summaries!").
- "View as table" reads aloud as a sortable summary, never as a chart description.
- Empty state body uses "pattern", not "trend", to match the Daily Pulse vocabulary.

---

## Anti-patterns (CLAUDE.md)

- **Don't paywall the latest reading or the 7-day range.** Free tier always sees both.
- **Don't use red on the chart unless a confirmed-urgent point is plotted.** In-range bands stay vital-coloured-soft.
- **Don't auto-toggle vitals based on classification tier.** The user controls visibility.
- **Don't show a "no patterns yet" empty correlation card.** When the engine produces nothing meaningful, the slot is hidden.
- **Don't aggressively animate correlation cards.** Calm-before-clever.

---

## Accessibility

- Chart: `button.ghost` "View as table" above the chart switches to a sortable list per D8 §3.10.
- Each chart data point: `accessibilityLabel: "Tuesday March 4 · BP 132 over 86 mmHg · HR 68 bpm"` — concatenated for the visible series.
- Range chip: `accessibilityRole: "tab"`, `accessibilityState: { selected: boolean }`.
- Vital toggle chip: `accessibilityRole: "switch"`, `accessibilityState: { checked: boolean }`.
- Correlation card: `accessibilityRole: "summary"`; the eyebrow + headline are read together.
- VoiceOver order: header → range chips → vital toggles → chart (or table) → correlation cards → weekly summary → export CTA.

---

## Sprint 9 acceptance criteria

- All four ranges (7d / 30d / 90d / 1y) render with the multi-vital chart.
- Vital toggle chips hide/show series live without re-fetching data.
- Correlation cards appear only for `is_meaningful = true` rows; capped at 3, sorted by `|pearson_r|` desc.
- Synthetic test data with strong sleep × morning-BP correlation produces a card; weak data does not.
- Free-tier tap on a >7d chip OR the export CTA opens the paywall sheet.
- PDF generation produces all 7 sections (cover · BP · HR · SpO2 · Sleep · Activity · cross-vital observations · notes) per D13 §10.2.
- Cover line passes voice gate for both `account_type` variants.
- Weekly summary placeholder copy passes voice gate.
- Empty state hides correlation / summary / export slots cleanly (no skeletons, no placeholder rows).
- Component + integration tests covering all states.

---

## Voice gate (Sprint 9 strings)

These are the strings introduced or modified by this sprint. All must pass `docs/05-voice-and-claims.md`:

- Header: "Trends" · "Your trends"
- Range chips: "7D" · "30D" · "90D" · "1Y"
- Vital toggle chips: "BP" · "HR" · "SpO2" · "Sleep" · "Activity"
- "View as table"
- Empty state headline: "Trends will appear here next week"
- Empty state body: "We need a few days of readings before we can show a pattern."
- Weekly summary placeholder eyebrow: "This week"
- Weekly summary placeholder body: "Your first weekly summary will appear next Sunday."
- Export CTA: "Share with your doctor" · "Save as PDF for my doctor"
- Export sheet title: "Share with your doctor"
- Export sheet options: "Include notes" · "Include caregiver comments"
- PDF cover line (both `account_type` variants — see "Doctor PDF export" above)

Passes voice gate: no forbidden vocabulary, leads with the answer, plain language before clinical terms, calm and dignified.
