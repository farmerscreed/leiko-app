# Screen — Trends

Sourced from D8 §4.7 + D6 US-51 / US-52 / US-54 (PDF export), with **AMENDS** per D8a §8 for the self-buyer track.

> **Paywall lever**: > 7-day ranges are Plus-only. The 7-day range and the most recent reading are always free. Per `docs/09-paywall-and-iap.md`.

---

## Audience
- Caregiver primary (per family member)
- Self-buyer (their own data)
- Parent (read-only large-text variant — see "Parent-side trends" below)

## Purpose
Show BP and HR trends over time. Surface meaningful patterns. Generate a doctor-shareable PDF.

---

## Layout (top to bottom)

| Element | Spec |
| --- | --- |
| Header | Back chevron + `type.headline` **"Trends"** (caregiver) OR **"Your trends"** (self-buyer per D8a §8.1) |
| Family-member picker | **Caregiver mode**: horizontal-scroll `Pill` chips, one per parent. Selected pill uses `accent` variant. **Self-buyer mode (SUPERSEDES per D8a §8.1)**: REMOVED. Even in hybrid mode, the picker stays removed on the self-buyer's side. |
| Range chips | `Pill` chips: **7d** (free), **30d** (Plus), **90d** (Plus). **Self-buyer mode adds (D8a §8.2): 4th chip "All time"** (Plus). Default = 7d for free, 30d for Plus. Tapping a Plus-only chip while free → paywall sheet. |
| BP Trend Chart | `BPTrendChart` component (D8 §3.10). Two lines: systolic (`color.brand.primary` 2pt) + diastolic (`color.brand.primary-soft` 2pt dashed). In-range band (90–135 sys, 60–85 dia). Anomaly points highlighted. |
| Summary stats card | `Card` (default elevation): average sys/dia, **% in range** (primary stat in self-buyer per D8a §8.3), anomaly count for selected range. Tier C summary line below if Plus. **Self-buyer (D8a §8.3 ADDS)**: tap-through on each stat opens a brief explainer (per `docs/08-learn-module.md`) — e.g., what "average BP" means, what "in-range" means. |
| "View as table" toggle | `button.ghost` — flips chart for a sortable list (a11y essential). |
| "Share with doctor" CTA (caregiver, Plus) | `button.primary` — opens PDF export sheet. Free-tier sees "Share with doctor — Plus" → paywall. |
| **"Save as PDF for my doctor" CTA (self-buyer, Plus — D8a §8.4 ADDS)** | `button.secondary` at the bottom of the Trends screen. Generates a one-page PDF with header (name, age, date range), summary stats, BP trend chart, and a small "What I want to discuss" section (free-form notes from `docs/04-screens/reading-detail.md` "Note for my doctor"). Output filename: `Leiko_BP_Report_{YYYY-MM-DD}.pdf`. Locked behind Leiko Plus. |

---

## Empty state

Per `docs/05-voice-and-claims.md`:

| Element | Value |
| --- | --- |
| Headline | "Trends will appear here next week" |
| Body | "We need a few days of readings before we can show a trend." |
| CTA | (none) |

---

## States

| State | Visual |
| --- | --- |
| `default` | Chart + stats rendered |
| `loading` | Skeleton chart (no shimmer under reduced motion) + skeleton stats |
| `empty` | Empty-state copy above |
| `paywalled-range` | User selected 30d/90d while free → paywall sheet rises; chart returns to 7d once dismissed |
| `error` | Friendly cause + fix per `docs/05-voice-and-claims.md` error pattern; "Try again" CTA |

---

## PDF export (Plus only — D6 US-54)

- **CTA**: "Share with doctor"
- Bottom sheet with: time range selector (7d / 30d / 90d / custom), preview thumbnail, options (include notes? include comments?), "Generate PDF" `button.primary`.
- Edge Function `/generate-doctor-report` (Sprint 9 deliverable; `service_role`) renders the PDF and returns a signed URL.
- Native share sheet (iOS / Android) for Email / WhatsApp / AirDrop / etc.
- PDF voice: passes copy-lint. Never "diagnose", "treat", "predict". Cover line: *"This report is general information from {parent_name}'s Leiko watch. It is not a diagnosis. Please discuss with their doctor."*

---

## Parent-side trends (D8 §4.14 / large-text mode)

Different layout for parent users:
- Vertical list, each row 80pt min height
- `type.numeric-l` for the reading value
- `type.body-l` for "Tuesday morning"
- `Pill` chip for in-range status
- **No comments, no chart** — simplicity total
- Per CLAUDE.md "limited cognitive load: at most 3 actions on any screen"

---

## Voice

Per `docs/05-voice-and-claims.md`:
- Summary line (if Plus + Tier C): *"Mum's average this week is 132/84 — 5 lower than last week."* Never "improvement" / "worsening".
- "View as table" reads aloud as a sortable summary, never as a chart description.

---

## Anti-patterns (CLAUDE.md)
- **Don't paywall the latest reading.** The 7-day range is always free.
- **Don't use red on the chart unless a confirmed-urgent point is plotted.** In-range band stays cream/taupe.

---

## Accessibility

- Chart: above-the-chart `button.ghost` "View as table" — switches to `react-native-table` view per D8 §3.10.
- Each chart data point: `accessibilityLabel: "Tuesday March 4, 132 over 86 mmHg"`.
- Range chip: `accessibilityRole: "tab"`, `accessibilityState: { selected: boolean }`.
- VoiceOver order: header → family picker → range chips → chart (or table) → stats → action buttons.

---

## Sprint 9 acceptance criteria
- All states render with correct tokens.
- Range chip paywall trigger works for free users on 30d/90d (caregiver) and 30d/90d/All-time (self-buyer).
- Chart renders with at least 7 days of fixture data; anomaly points highlighted; in-range band visible.
- "View as table" mode reads correctly under VoiceOver.
- **Self-buyer**: "Save as PDF for my doctor" generates a one-page PDF with the spec'd sections (D8a §8.4). Sprint 9 acceptance can be a stub PDF; Sprint 17 wires the full doctor report.
- **Self-buyer**: stat tile tap-throughs open brief explainers per D8a §8.3.
- Voice gate passes (including PDF cover copy).
- Component + integration tests covering all states.

---

## Doctor-ready export (D8a §8.4 callout)

Per D6 §4.2 Mode 2 acceptance criteria, the self-buyer wants a one-page summary they can show their doctor. **This is the single most compelling paywall trigger for this persona.**

> **Don't show the export CTA as locked-and-greyed.** Show it normal, and reveal the paywall on tap with the framing *"Get the full PDF in Leiko Plus"* (per `docs/09-paywall-and-iap.md`).

PDF cover line passes voice gate: *"This report is general information from your Leiko watch. It is not a diagnosis. Please discuss with your doctor."*
