# Sprint 14 — Learn Surface C

## Goal
Home-seeded Learn card per D9 §2.3 + §7. Day 0–3 fixed sequence, Day 4+ contextual algorithm. Dismissed articles don't return for 30 days. Read articles don't re-surface for 90 days.

## Duration
~1 work-week.

## Hard dependencies
Sprint 7 OR 8, Sprint 13.

## Docs to load
docs/08-learn-module.md, docs/04-screens/caregiver-home.md, docs/04-screens/self-buyer-home.md.

## Deliverables
- Home learn card slot wired into both home screens
- Selection algorithm per D9 §7.2 (rule-based, deterministic, on-device)
- Dismiss + "read" tracking in MMKV
- Region-aware article selection (NG users see Cluster C subset)

## Acceptance criteria
- Day 0: F-1 surfaces. Day 1: F-2. Day 2: T-1. Day 3: V-3. (Per D9 §5.2 — Day 3 surfaces changes-001, Day 7 surfaces numbers-002, Day 14 surfaces doctor-001.)
- Day 4+: rule-based selection per D9 §7.2 priority order
- Dismissed article does not return for 30 days
- Read article does not re-surface as seed for 90 days
- Algorithm runs offline (no network calls)

## Open prompt
Sprint 14 — Learn Surface C. Read CLAUDE.md, then docs/08-learn-module.md.

Propose:

1. MMKV schema for read/dismissed tracking
2. Selection algorithm as a pure function (testable)
3. How "day index since pairing" is computed reliably (timezone hazards)

Wait for approval.
