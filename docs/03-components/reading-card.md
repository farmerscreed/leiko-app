# Component — Reading Card

The unit element of the home screen. One card per parent (caregiver mode) or one self-card (self-buyer mode), displaying the most recent BP reading + status.

Sourced from D8 §3.3, with **AMENDS** per D8a §13.1 for the self-buyer track. Implementation at `apps/mobile/src/components/ReadingCard.tsx`.

> **Crimson appears here ONLY** (and on the confirmed-urgent banner — `docs/10-anomaly-logic.md`). On every other screen, the crimson token is unused.

---

## ownerVariant prop (D8a §13.1)

The component takes an `ownerVariant: 'self' | 'parent'` prop. Selected by the consumer based on `account_type`:
- `'parent'` → caregiver track. Renders parent-name + relationship label + avatar in the header. **Default.**
- `'self'` → self-buyer track. Header REMOVES parent-name, relationship label, AND avatar (no need to identify whose data it is — it's the user's own).

All other regions (BP value, trend indicator, timestamp, anomaly badge, all states) are **UNCHANGED** between variants.

> Self-buyer mode usage is also a **larger** card on home (the hero card, with `type.numeric-xl` 56pt — see `docs/04-screens/self-buyer-home.md`). The hero card uses this component but at a larger size + different surface padding.

---

## Anatomy

- **Container**: `color.surface.subtle` (taupe) background, `radius.m` (12pt), padding `spacing.l` (16pt) all sides, **no shadow on cream**.
- **Header row** (`ownerVariant='parent'` only):
  - Parent name (`type.title`)
  - Relationship label (`type.caption`, `color.text.secondary`)
  - Avatar (40pt, top-right corner)
- *(Header row is REMOVED entirely for `ownerVariant='self'`.)*
- **BP value row**:
  - `type.numeric-l` (36pt JetBrains Mono Medium, tabular) — e.g. `128/82`
  - Unit suffix `mmHg` (`type.body-m`, muted)
- **Trend indicator**:
  - Small chevron (▲ ▼ —) + delta vs 7-day average (`type.body-s`)
  - e.g. "▲ 6 from her average"
- **Timestamp + sync state** (`type.caption`, `color.text.secondary`):
  - Format: "Today 7:42am" or relative "4 days ago" for >24h
  - Optional cloud-slash icon if pending sync
- **Optional anomaly badge**:
  - Pill component (see `pill.md`), `accent` or `urgent` variant per state below.

---

## States

| State | Trigger | Visual |
| --- | --- | --- |
| `fresh` | Reading <24h old, in normal range | Default; no badge |
| `stale` | Reading 24–72h old | Timestamp uses `color.text.secondary`; subtle "needs sync" hint |
| `silent` | No reading in >72h | Card shows muted parent block + "Last reading 4 days ago" — calm-concerned tone |
| `anomaly-noted` | Reading triggers calm-concerned anomaly logic (`docs/10-anomaly-logic.md`) | Amber pill badge "Worth a chat", calm-concerned tone |
| `confirmed-urgent` | Reading ≥180/120 OR three consecutive ≥160/100 in 60 min | **Crimson** left-edge stripe (4pt wide), badge "Talk to Dad now" |
| `offline` | Sync pending | Small cloud-slash icon, `type.caption`: "Pending sync" |

---

## Tap behaviour

- The whole card is tappable.
- Tap → opens Reading Detail (`docs/04-screens/reading-detail.md`).
- For `confirmed-urgent` state, the card is the primary tap target after the banner above.

---

## Accessibility

- `accessibilityRole: "button"`.
- `accessibilityLabel`: composed sentence:
  - "Mum's most recent reading: 128 over 82 mmHg, 6 above her average. Tuesday 7:42am."
  - For anomaly states: append " — anomaly noted, worth a chat" or " — talk to Dad now".
- Color is **never** the sole signal — anomaly states always combine color + icon + text.
- `accessibilityLiveRegion="polite"` on the BP value when it updates with a fresh reading: announces "New reading received: 128 over 82".

---

## Voice rules

Per `docs/05-voice-and-claims.md`:
- Trend phrasing: "above her average" / "below her average" — never "high" or "low" without context.
- Anomaly phrasing uses the calm-concerned templates from `docs/10-anomaly-logic.md` §4 — "Worth a look", never "Alert".
- Confirmed-urgent phrasing: "Talk to Dad now" — direct but calm.

---

## Anti-patterns

- **Don't add a shadow on cream**.
- **Don't show count badges** ("3 new readings").
- **Don't pulse or animate** the anomaly badge to draw attention. Calm-before-clever (CLAUDE.md anti-pattern list).
- **Don't use crimson outside the `confirmed-urgent` state**.

---

## Sprint 6 (and Sprint 7/8) deliverables

This card is built in Sprint 6 (Take Reading + Reading Detail). Sprint 7 (caregiver home) and Sprint 8 (self-buyer home) consume it. By Sprint 6:

- `ReadingCard.tsx` with all 6 states
- Connects to `useReading(parentId)` hook
- Tap → navigates to Reading Detail with the right reading_id
- Component tests: each state renders + a11y label + tap behaviour
- Storybook entry showing each state with a fixture reading
