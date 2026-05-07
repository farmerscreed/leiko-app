# Sprint 7.7 — Caregiver Home Rewrite (Daily Pulse Cards)

## Goal
Rewrite the existing Caregiver Home (`src/screens/Home/CaregiverHome.tsx`) to consume `DailyPulseHero` in `card` mode per parent. Family Circle metaphor preserved per D13 §7.4 — each parent gets a Daily Pulse card with the five-vital ring constellation, AI narration line, tap-to-expand to immersive view.

## Duration
~1 work-week.

## Hard dependencies
Sprint 1.5 (tokens). Sprint 7.5 (multi-vital data flowing). Sprint 7.6 (DailyPulseHero primitive). Sprint 11 (Tier-A narration templates) for narration line. Sprint 12.5 (ambient AI) for narration generation — **wire as placeholder string in this sprint, real generator lands in Sprint 12.5**.

## Docs to load
docs/_reference/D11-brand-repositioning.md, docs/_reference/D12-visual-system-v2.md, docs/_reference/D13-multi-vitals-constellation-spec.md (§7), docs/04-screens/caregiver-home.md (will be rewritten as part of this sprint), CLAUDE.md.

## Deliverables
- `CaregiverHome.tsx` rewritten to render a vertical stack of `DailyPulseHero mode='card'`, one per parent
- Tap-to-expand → immersive `DailyPulseHero mode='immersive'` for the tapped parent (new screen route or sheet — Sprint 7.7 chooses)
- AnomalyBanner integration (most-severe-wins across all family members, all five vitals)
- Pull-to-refresh triggers sync orchestrator + invalidates realtime query
- Empty states preserved per existing voice rules:
  - No family members: "Your family circle is quiet for now"
  - Family members but no readings: "No readings yet" / pair watch CTA
- FAB ("Invite family") visible only for family_owner with capacity remaining (Plus = up to 5 caregivers)
- New screen spec: `docs/04-screens/caregiver-home.md` rewritten

## Acceptance criteria
- Empty + populated states render correctly in both modes
- Realtime new-reading insertion updates the correct parent's Daily Pulse card
- Tap a parent card → expands to immersive Daily Pulse for that parent
- AnomalyBanner shows for at least one calm-concerned + one confirmed-urgent fixture across HR, SpO2, BP
- Voice gate passes on every string
- Component + integration tests cover empty, populated, anomaly states
- Existing tests in `__tests__/CaregiverHome.test.tsx` updated and passing

## Open prompt
Sprint 7.7 — Caregiver Home Rewrite. Read CLAUDE.md, then docs/_reference/D11-brand-repositioning.md, docs/_reference/D13-multi-vitals-constellation-spec.md.

Propose:

1. Tap-to-expand: new screen route or modal sheet?
2. Realtime subscription scope — keep family-wide or narrow per-parent for performance?
3. AnomalyBanner most-severe-wins logic across 5 vitals × N parents
4. Migration of the existing `useFamilyReadings` hook to surface multi-vital data (replaces `ReadingSummary` with `DailyPulseData`)

Wait for approval.

## Risk notes
- The existing CaregiverHome.tsx has been working; this rewrite is structural, not cosmetic. Plan to keep the old file as `.legacy.tsx` until sign-off.
- Hybrid mode (self-buyer who invited a caregiver) needs to render correctly — caregiver sees the self-buyer-now-watched as one card in their Family Circle. Test fixture mandatory.

## What this sprint explicitly does NOT ship
- Self-Buyer Home (Sprint 8 — different account type)
- Per-vital detail screens (Sprint 8.5)
- Real AI narration (Sprint 12.5 — wire placeholder string here)
