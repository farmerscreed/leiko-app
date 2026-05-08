# Sprint 8.5 — Per-Vital Detail Screens (HR · SpO2 · Sleep · Activity)

## Goal
Five detail screens, one per vital. Each follows the common structure in D13 §8.1 (header, hero card, trend chart, cross-vital correlation strip, pattern callout, history list, settings shortcut). BP detail already exists from Sprint 6 — gets visual upgrade only. HR, SpO2, Sleep, Activity are net-new.

## Duration
~1.5 work-weeks.

## Hard dependencies
Sprint 1.5 (tokens). Sprint 7.5 (multi-vital data). Sprint 7.6 (CorrelationStrip primitive). Sprint 8 (vital tiles navigate here). Sprint 11 (Tier-A pattern callouts — placeholder until Sprint 12.5 generator).

## Docs to load
docs/_reference/D13-multi-vitals-constellation-spec.md (§8), docs/_reference/D12-visual-system-v2.md, CLAUDE.md.

## Deliverables
- `BPDetail.tsx` visual upgrade per D12 (existing screen; replace bar gauge with VitalRing)
- `HRDetail.tsx` per D13 §8.3 (new — resting HR hero, max/min sub-line, trend chart, activity context)
- `SpO2Detail.tsx` per D13 §8.4 (new — latest + overnight low, sleep context — most defer-to-doctor copy of any vital)
- `SleepDetail.tsx` per D13 §8.5 (new — total + score hero, stage chart for last night, BP context)
- `ActivityDetail.tsx` per D13 §8.6 (new — steps progress vs target, calories sub-line, BP context, inline goal config)
- New screen specs in `docs/04-screens/`: `vital-detail-hr.md`, `vital-detail-spo2.md`, `vital-detail-sleep.md`, `vital-detail-activity.md` (BP already documented)
- Per-vital settings shortcut (Sprint 10 builds the actual settings; here: deep-link)
- "Pattern callout" Tier-B paragraph slot — placeholder until Sprint 12.5

## Acceptance criteria
- All 5 detail screens render in dark + light modes
- Each screen displays a fresh, relevant cross-vital correlation when meaningful (Sprint 9 correlation engine produces these; placeholder if not yet meaningful)
- Trend chart range toggle (7d / 30d / 90d) works on all 5 screens
- Voice gate passes on every string — especially SpO2's defer-to-doctor copy
- Live-pulse animation runs on the hero ring when that vital is currently capturing (e.g., HR notify streaming on HRDetail)
- Stage chart on SleepDetail correctly visualises light/deep/REM/awake from `value_jsonb`
- Activity goal-config inline tap opens a small bottom-sheet picker
- Snapshot tests per screen × mode

## Open prompt
Sprint 8.5 — Per-Vital Detail Screens. Read CLAUDE.md, then docs/_reference/D13-multi-vitals-constellation-spec.md (§8).

Propose:

1. Common structure — shared composable components or per-screen?
2. Trend chart library — Victory Native XL is locked per docs/00-tech-stack.md; confirm multi-axis support
3. Sleep stage chart — bespoke bar component or Victory composition?
4. Activity goal config UX — inline bottom sheet or push to a separate config screen?
5. Cross-vital correlation strip — does it gracefully hide when no meaningful correlation yet?

Wait for approval.

## Risk notes
- SpO2 detail copy is the closest to a clinical signal of any screen in the app. Voice review must be tight; "share with your doctor" framing is non-negotiable per D13 §6.3.
- Sleep stage data accuracy from the watch is decent but not clinical. Don't surface stage data with false precision — broad bands only.
- Activity goal default is **6,000 steps** per Q-D13-1 (lower than the typical 10,000 — appropriate for hypertensive adults including elders).

## What this sprint explicitly does NOT ship
- Multi-vital trends overview screen (Sprint 9)
- Real Tier-B pattern callout generation (Sprint 12.5)
- Anomaly engine for HR / SpO2 / Sleep (Sprint 15)
