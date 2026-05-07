# Sprint 8 — Self-Buyer Home (Daily Pulse)

## Goal
The self-buyer Home screen per D13 §7 + D8a §6: immersive `DailyPulseHero` (5-vital ring constellation with adaptive central value), AI narration line, vital tile strip, mini trend chart, history list, Take-a-Reading FAB. Hero adapts across central-value states based on D13 §7.2 priority. Consumes Sprint 7.6 component primitives and Sprint 11 Tier-A narration templates.

## Duration
~1 work-week.

## Hard dependencies
Sprint 1.5 (tokens). Sprint 7.5 (multi-vital data). Sprint 7.6 (component primitives). Sprint 11 (narration templates — placeholder string acceptable until Sprint 12.5).

## Docs to load
docs/_reference/D11-brand-repositioning.md, docs/_reference/D12-visual-system-v2.md, docs/_reference/D13-multi-vitals-constellation-spec.md (§7), docs/04-screens/self-buyer-home.md (will be rewritten as part of this sprint), docs/_reference/D8a-self-buyer-mode.md.

## Deliverables
- `SelfBuyerHome.tsx` with full immersive layout per D13 §7:
  - `DailyPulseHero mode='immersive'` at top
  - AI narration line under rings
  - Vital tile strip (5 tiles: BP · HR · SpO2 · Sleep · Activity)
  - Mini trend chart (last 7 days, multi-vital correlation chart preview)
  - History list (recent readings)
- Adaptive central value logic per D13 §7.2 (BP if fresh ≤8h → resting HR if today ≤12h → last night's sleep → "—")
- Take-a-Reading FAB (existing functionality preserved, button restyled per D12)
- Vital tile tap → opens that vital's detail screen (Sprint 8.5 deliverable; wire navigation route)
- Empty states for first-time user (per voice rules, never "No data")
- New screen spec: `docs/04-screens/self-buyer-home.md` rewritten

## Acceptance criteria
- All 4 central-value priority states render correctly (BP fresh / HR fallback / sleep fallback / no-data)
- All 5 ring states render correctly per vital classification
- Daily-pulse-reveal animation fires once per session, not on every nav
- Live-pulse animation runs when any vital is currently capturing
- AI narration line shows placeholder string in Sprint 8 ("Your daily pulse is here.") — replaced by real generator output in Sprint 12.5
- FAB tap → existing TakeReading flow (no regression)
- Vital tile tap → navigates to vital detail screen route (placeholder until Sprint 8.5)
- Voice gate passes on every string
- Snapshot tests cover all central-value states + dark/light modes

## Open prompt
Sprint 8 — Self-Buyer Home. Read CLAUDE.md, then docs/_reference/D11-brand-repositioning.md and docs/_reference/D13-multi-vitals-constellation-spec.md.

Propose:

1. Adaptive central-value selection — pure function or hook?
2. Layout strategy on small phones (iPhone 13 mini target) — does the constellation hero fit comfortably?
3. Mini trend chart: which two vitals show by default? (Recommend BP + Sleep — Sprint 9 expands)
4. Pull-to-refresh behaviour — refresh all vitals or only the one tapped?
5. Wire-up of Sprint 12.5 narration generator — placeholder string strategy

Wait for approval.

## Risk notes
- This is the screen that defines the brand. Spend the time on motion polish.
- The constellation layout on a 5.4" iPhone (mini) is the worst-case. If it doesn't fit beautifully there, raise it before shipping.
- Stale-vital handling per D13 §6.6 — every vital needs to surface staleness gracefully.

## What this sprint explicitly does NOT ship
- Per-vital detail screens (Sprint 8.5)
- Real AI narration (Sprint 12.5 — placeholder here)
- Trends screen (Sprint 9)
- Settings additions (Sprint 10)
