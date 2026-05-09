# Sprint 14 — Learn Surface C (Multi-Vital Seeding)

## Goal
Home-seeded Learn card per D9 §2.3 + §7. Day 0–3 fixed sequence, Day 4+ contextual algorithm. Dismissed articles don't return for 30 days. Read articles don't re-surface for 90 days. **Algorithm extended to weight in current vital classifications across all 5 vitals** so that, e.g., a SpO2 calm-concerned state can surface a relevant SpO2 article on Home.

## Duration
~1 work-week.

## Hard dependencies
Sprint 7.7 (Caregiver Home with Daily Pulse), Sprint 8 (Self-Buyer Home with Daily Pulse), Sprint 13 (full multi-vital article library).

## Docs to load
docs/08-learn-module.md, docs/_reference/D13-multi-vitals-constellation-spec.md (vital states feed the algorithm), docs/04-screens/caregiver-home.md, docs/04-screens/self-buyer-home.md.

## Deliverables
- Home learn card slot wired into both home screens (positioned below Daily Pulse hero)
- Selection algorithm per D9 §7.2 expanded for multi-vital signals:
  - Day 0–3 fixed sequence preserved (BP-focused intro)
  - Day 4+ rule-based selection prioritises vital-state-relevant articles when a vital is calm-concerned
  - Correlation cards (corr-001, corr-002, corr-003) prioritised when the matching correlation is meaningful
- Dismiss + "read" tracking in MMKV
- Region-aware article selection (NG users see Cluster C subset)
- Per CLAUDE.md anti-pattern: NO count badges, NO "new" dots on Learn cards (preserved)

## Acceptance criteria
- Day 0: F-1 surfaces. Day 1: F-2. Day 2: T-1. Day 3: V-3. (Per D9 §5.2)
- Day 4+: rule-based selection per D9 §7.2 priority order, with new multi-vital state inputs:
  - User has SpO2 calm-concerned → spo2-002 ranks higher
  - User has sleep_score < 70 + meaningful sleep×BP correlation → corr-001 ranks higher
  - User has resting HR drift → hr-002 ranks higher
- Dismissed article does not return for 30 days
- Read article does not re-surface as seed for 90 days
- Algorithm runs offline (no network calls)
- Algorithm pure function, deterministic, fully unit-tested across the multi-vital state space

## Open prompt
Sprint 14 — Learn Surface C Multi-Vital Seeding. Read CLAUDE.md, then docs/08-learn-module.md and docs/_reference/D13-multi-vitals-constellation-spec.md (§6 classification).

Propose:

1. MMKV schema for read/dismissed tracking
2. Selection algorithm as a pure function (testable) — multi-vital state inputs
3. How "day index since pairing" is computed reliably (timezone hazards)
4. Priority weighting — vital state relevance vs day-index sequence vs correlation freshness

Wait for approval.
