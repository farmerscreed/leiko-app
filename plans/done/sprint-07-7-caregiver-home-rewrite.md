# Sprint 7.7 — Caregiver Home Rewrite (Family Constellation)

## Status

| Sub-sprint | Status |
| --- | --- |
| 7.7a — Bird's-eye + drill-in | ✅ Shipped 2026-05-08 |
| 7.7b — Editorial cards + view toggle + cinematic transition + cross-phone multi-vital wire-up | ✅ Shipped 2026-05-08 |

## Goal
Rewrite the Caregiver Home (`src/screens/Home/CaregiverHome.tsx`) to the **Family Constellation** design — a single screen with two view modes:

- **Bird's-eye** — each loved one is a glowing orb in a starfield around a center "You" mark. Status drives glow + pulse + dot. Below: a legend with status pills.
- **Detailed** — vertical stack of editorial cards per person; portrait + italic Instrument-Serif headline + AI prose + four-vital row + open-chevron footer.

Top-right segmented toggle persists view preference (MMKV). Tap any person → drill-in to the immersive `DailyPulseHero` for that parent.

This **replaces** the original Sprint 7.7 plan of stacked `DailyPulseHero` cards. Decision: design-driven approach landed 2026-05-08; the per-parent five-vital constellation is reserved for the drill-in (where it has room to breathe), and the home screen leads with the family-status metaphor instead.

## Source design

`leiko-caregiver-unified.html` from the Claude Design handoff bundle. Three-person fixture cast: Marian Okeke (clear), Emeka Okeke (watch — BP trending up), Joy Adeyemi (sleeping). All six status states modelled.

## Split

This card covers TWO sub-sprints because the scope is ~2 weeks total.

### Sprint 7.7a — Bird's-eye + drill-in (this sub-sprint, ~1 week)
The bird's-eye view ships as the v1 caregiver home. Editorial-card view defers to 7.7b. Persistence is wired (MMKV-backed view-preference key), but the toggle UI lands in 7.7b.

### Sprint 7.7b — Editorial cards + view toggle + cinematic transition (next, ~1 week)
Editorial card primitive, segmented toggle UI consuming the persisted preference, and the cinematic zoom-out / zoom-in transition between the two views.

## Duration
~1 work-week per sub-sprint, ~2 weeks total.

## Hard dependencies
Sprint 1.5 (tokens). Sprint 7.5 (multi-vital data flowing). Sprint 7.6 (`DailyPulseHero` for drill-in, `AnomalyBanner`). Sprint 11 (Tier-A narration templates). Sprint 12.5 (ambient AI for narration generation — **wire as placeholder string in this sprint, real generator lands in 12.5**).

## Docs to load
docs/_reference/D11-brand-repositioning.md, docs/_reference/D12-visual-system-v2.md, docs/_reference/D13-multi-vitals-constellation-spec.md (§7.4 Family Circle, §6 staleness), docs/04-screens/caregiver-home.md (rewritten as part of this sprint), CLAUDE.md.

## Deliverables — Sprint 7.7a

### Token additions
- `@expo-google-fonts/instrument-serif` installed; `fontFamilies.editorial` exposed via `theme.fontFamilies.editorial`
- `colors.surface.warm` (caregiver-mode warm-charcoal background — design `#0a0908`)
- `colors.brand.coral` (caregiver-mode accent — design `oklch(72% 0.18 35)` → hex). Resolves the D12 light-mode-amber 2:1 contrast issue (see `memory/d12_light_mode_amber_contrast.md`) for caregiver surfaces only
- `colors.person.{1,2,3}` — three rotating accents drawn from `vital.bp / vital.spo2 / vital.sleep` ranges (coral / amber / periwinkle)
- All design `oklch()` values converted to hex at token-definition time. Documented inline.

### New primitives
- `Portrait.tsx` — circular initial-letter portrait, accent colour, three sizes (sm 32 / md 44 / lg 56)
- `StatusPill.tsx` — six status states (clear / watch / attention / urgent / offline / sleeping) with semantic colours + dot. Extends, doesn't replace, the existing `Pill`
- `PersonOrb.tsx` — halo glow + status-driven pulse + sleeping-moon glyph + name + BP label below

### Bird's-eye composites
- `ConstellationField.tsx` — SVG starfield, center "You" mark, dashed orbital rings, connection lines, three positioned `PersonOrb` instances
- `ConstellationLegend.tsx` — list rows with `StatusPill` per person
- `CaregiverActionBar.tsx` — glass bottom bar with "{count} · all in your circle" + "+ Add someone"

### Screen rewrite
- `CaregiverHome.tsx` rewritten to render the bird's-eye view
- Legacy file preserved as `CaregiverHome.legacy.tsx` until 7.7b lands (per Sprint 7.7 risk note)
- AnomalyBanner integration above the constellation when any person is `attention` or `urgent` (most-severe-wins across all family members, all five vitals)
- Pull-to-refresh triggers sync orchestrator + invalidates realtime query
- Empty states preserved per existing voice rules:
  - No family members: "Your family circle is quiet for now"
  - Family members but no readings: "No readings yet" / pair watch CTA
- "+ Add someone" affordance visible only for `family_owner` with capacity remaining (Plus = up to 5 caregivers)

### Data layer
- `useFamilyReadings` hook migrated from `ReadingSummary` to `DailyPulseData` per parent, surfaced via per-parent multi-vital state
- Status mapping per `D13 §6 staleness`: `clear` (in_pattern) / `watch` (Sprint 15 deferral — same as clear v1) / `attention` (calm_concerned) / `urgent` (confirmed_urgent) / `offline` (`staleSeconds > offlineThreshold`) / `sleeping` (active sleep session within last 4h)
- `caregiver.viewMode` MMKV key plumbed (default `'birds'`); 7.7b wires the toggle UI

### Tests
- Unit tests for new primitives (Portrait, StatusPill, PersonOrb)
- Snapshot matrices per status × mode for each component
- Integration tests for `CaregiverHome.tsx` covering empty / 3-person populated / drill-in routing / AnomalyBanner anomaly states
- Voice-rule sweep on every new user-visible string
- Reduced-motion deterministic verification: orb pulses + halo animations disabled

### Documentation
- `docs/04-screens/caregiver-home.md` rewritten to reflect the bird's-eye / detailed pattern (matching the design)

## Deliverables — Sprint 7.7b (next)
- `PersonCard.tsx` editorial card primitive
- `ViewToggle.tsx` segmented control (consumes the MMKV preference plumbed in 7.7a)
- `DetailedView` composition rendering a vertical stack of editorial cards
- Cinematic transition between views (outgoing zoom-out + blur, incoming zoom-in + blur, ~750ms total, reduced-motion respected)
- Updated integration tests covering toggle + transition

## Acceptance criteria — Sprint 7.7a
- Bird's-eye view renders correctly in dark mode (caregiver mode is dark-canonical per design)
- Empty + populated states render correctly
- Realtime new-reading insertion updates the correct person's orb state + status
- Tap a person orb (or legend row) → expands to immersive `DailyPulseHero` for that parent (existing drill-in behaviour preserved)
- AnomalyBanner shows for at least one calm-concerned + one confirmed-urgent fixture across HR, SpO2, BP
- Voice gate passes on every string
- Component + integration tests cover empty, populated, anomaly, drill-in states
- Existing tests in `__tests__/CaregiverHome.test.tsx` updated and passing
- All vital-color contrast ratios verified per D12 §2.6 (3:1 against caregiver warm-charcoal surface)

## Open prompt (resolved 2026-05-08)
1. Tap-to-expand → existing immersive `DailyPulseHero` route (no new screen)
2. Realtime subscription stays family-wide per existing `useFamilyReadings`
3. AnomalyBanner most-severe-wins logic stays as in Sprint 7
4. `useFamilyReadings` migrates from `ReadingSummary` to per-parent `DailyPulseData` (multi-vital)
5. Token strategy: caregiver-scoped warm tokens added; D12 amber unaffected for self-buyer surfaces

## Risk notes
- The existing CaregiverHome.tsx works for BP-only cases; the rewrite is structural. Legacy file kept as `.legacy.tsx` until both 7.7a + 7.7b ship.
- Hybrid mode (self-buyer who invited a caregiver) — caregiver sees the self-buyer-now-watched as one orb in their family. Test fixture mandatory.
- The `watch` status (3-day BP trend) requires Sprint 15's anomaly engine. v1 treats it as `clear`; the type space is in place.
- Light mode for the caregiver home is **out of scope** for v1 — the design is dark-canonical. Light mode lands in a follow-up alongside Sprint 1.6 (D12 light-mode amber contrast fix).

## What this sprint explicitly does NOT ship
- Self-Buyer Home (Sprint 8 — different account type)
- Per-vital detail screens (Sprint 8.5)
- Real AI narration (Sprint 12.5 — wire placeholder string here)
- 3-day BP trend / `watch` status logic (Sprint 15 anomaly engine)
- Caregiver-mode light mode (follow-up alongside Sprint 1.6 token cleanup)
