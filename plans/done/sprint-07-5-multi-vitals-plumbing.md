# Sprint 7.5 — Multi-Vitals Ingest Plumbing

## Goal
All five additional vital streams (HR, SpO2, Sleep, Steps, Calories) flow from watch → BLE → Edge Function → database. **No UI surface in this sprint.** Pure backend plumbing. Closes the multi-vitals ingest gap flagged in `plans/backlog.md` line 57.

## Duration
~2 work-weeks.

## Hard dependencies
Sprint 6 (BP path). D13 founder sign-off.

## Docs to load
docs/_reference/D13-multi-vitals-constellation-spec.md, docs/06-ble-protocol.md, docs/01-data-model.md, CLAUDE.md.

## Deliverables
- 10 new BLE wrappers per D13 §3.1 in `src/services/ble/commands/`:
  - `setGoals`, `readActivity`, `readSleep`, `setUserParams`, `setTimeFormat`, `setAutoHR`, `readHRHistory`, `setAutoSpO2`, `readSpO2History`, `factoryReset`
- Notify routing fix in `src/services/ble/notify.ts` — handle all 0x73 sub-events per D13 §3.2 (currently only BP byte routes; HR/SpO2/sport/battery dropped)
- Sequenced sync on reconnect per D13 §3.3 (8 steps, isolated failures)
- Per-vital sync cursors in MMKV per D13 §3.4
- New Zustand state slices: `state/hr.ts`, `state/spo2.ts`, `state/sleep.ts`, `state/activity.ts`, `state/dailyPulse.ts` (composed selector)
- `MultiVitalsPayload` type + `/sync` Edge Function expansion per D13 §4.2
- Server-side validations per D13 §4.4
- Classification utilities for HR, SpO2, Sleep, Activity in `src/utils/classification.ts` per D13 §6.2–§6.5
- BLE mock layer extended (`tools/ble-mock/`) to emit synthetic HR / SpO2 / sleep / activity samples
- MMKV pending buffers for each vital + flush logic
- Audit logging additions per D13 §13.4

## Acceptance criteria
- Synthetic HR samples flow watch → /sync → vitals_other in dev
- Synthetic sleep session flows the same path
- Synthetic SpO2 samples flow with min/max/perfusion fields populated
- Synthetic steps + calories flow as daily aggregates
- All classifiers covered by unit tests (≥ 90% coverage)
- BP path remains green (no regression)
- 48h soak test on real watch — at least one HR-auto-sample, one sleep session, one SpO2 sample observed and synced
- Per-vital cursors advance independently after each successful sync
- Watch-firmware-timestamp quirk holds for HR samples (per-sample encoding) and is not applied to per-day vitals (sleep, SpO2, activity)
- All AI egress and `/sync` egress redacts PHI per `phi-scrub.ts`

## Open prompt
Sprint 7.5 — Multi-Vitals Ingest Plumbing. Read CLAUDE.md, then docs/_reference/D13-multi-vitals-constellation-spec.md.

Propose:

1. Order of wrapper implementation (BLE wrappers can be built in parallel, but which first for soak-test coverage?)
2. State-slice composition pattern for `state/dailyPulse.ts` (selector vs derived store)
3. Server-side validation strategy — Edge Function inline vs separate validator module
4. Mock layer fixture data structure (deterministic vs randomised within ranges)
5. Migration plan for existing BP-only `/sync` callers — does any caller break?

Wait for approval.

## Risk notes
- This is the largest plumbing sprint in the project. Plan generously.
- The watch-firmware-timestamp quirk is real and tested for BP. Verify empirically for HR before assuming it propagates.
- PHI scrub must be extended for new vital fields BEFORE any payload leaves the device — gate at unit-test level.
- Server-side rejection of invalid samples is silent to the user (per D13 §4.4) — verify the silence end-to-end.

## What this sprint explicitly does NOT ship
- No UI for the new vitals (Sprint 7.6 builds the components, Sprint 8 / 7.7 / 8.5 consume them)
- No anomaly engine for the new vitals (Sprint 15 expansion)
- No AI integration (Sprint 11 / 12 / 12.5)
- No Apple Health / Health Connect bridge (Sprint 9.5)
