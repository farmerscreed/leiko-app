# Caregiver Two-Phone Test Results

Sprint 16.6 — Pre-Launch Validation & Hardening, deliverable A.4.

Fill in one row per scenario in `CAREGIVER_TEST_FLOW.md`. Run twice:
once mid-week, once at sprint end. Use a new section for each pass.

**Status values:** `PASS` / `FAIL` / `BLOCKED` / `SKIP`

- **PASS** — all expectations met.
- **FAIL** — at least one expectation missed. Capture a screen
  recording and reference it in the Notes column.
- **BLOCKED** — couldn't run because a prerequisite is missing
  (e.g. SMTP not yet wired for S3, multi-day data not yet seeded
  for S7).
- **SKIP** — intentionally not running this pass.

---

## Run 1 — mid-week

**Date:** _____
**Build:** APK SHA / commit hash _____
**P1 fixes shipped at this point:** _____
**Phone 1 (caregiver) Android version:** _____
**Phone 2 (self-buyer) Android version:** _____

| ID | Scenario | Status | Notes |
|----|----------|--------|-------|
| S1  | Caregiver onboarding (Phone 1)            |   |   |
| S2  | Self-buyer onboarding (Phone 2)           |   |   |
| S3  | Family invite + accept                    |   |   |
| S4  | Watch pairing on Phone 2                  |   |   |
| S5  | Take reading → caregiver visibility       |   |   |
| S6  | Anomaly trigger + push                    |   |   |
| S7  | Trends letter (caregiver of parent)       |   |   |
| S8  | For-your-doctor PDF                       |   |   |
| S9  | Settings flows (both)                     |   |   |
| S10 | Sign-out / sign-back-in resilience        |   |   |
| S11 | Offline buffering + reconnect             |   |   |
| S12 | Background-fetch (long-clock)             |   |   |

**Voice-lint findings (any pass that surfaced a string violation):**

| Scenario | File / location | Phrase | Suggested replacement |
|----------|-----------------|--------|------------------------|
|          |                 |        |                        |

**Bugs filed:** (PR / issue links)

---

## Run 2 — end-of-sprint

**Date:** _____
**Build:** APK SHA / commit hash _____
**P1 fixes shipped at this point:** _____

| ID | Scenario | Status | Notes |
|----|----------|--------|-------|
| S1  | Caregiver onboarding (Phone 1)            |   |   |
| S2  | Self-buyer onboarding (Phone 2)           |   |   |
| S3  | Family invite + accept                    |   |   |
| S4  | Watch pairing on Phone 2                  |   |   |
| S5  | Take reading → caregiver visibility       |   |   |
| S6  | Anomaly trigger + push                    |   |   |
| S7  | Trends letter (caregiver of parent)       |   |   |
| S8  | For-your-doctor PDF                       |   |   |
| S9  | Settings flows (both)                     |   |   |
| S10 | Sign-out / sign-back-in resilience        |   |   |
| S11 | Offline buffering + reconnect             |   |   |
| S12 | Background-fetch (long-clock)             |   |   |

**Regression check vs. Run 1:** which scenarios degraded after
hardening? Investigate before sprint close.

**Voice-lint findings (Run 2):**

| Scenario | File / location | Phrase | Suggested replacement |
|----------|-----------------|--------|------------------------|
|          |                 |        |                        |

**Bugs filed:** (PR / issue links)

---

## Sprint-end summary

- Total PASS / FAIL / BLOCKED / SKIP across Run 2: __ / __ / __ / __
- Acceptance criterion is ≥ 90% PASS — met? Y/N
- Items moved from BLOCKED to PASS between Run 1 and Run 2: _____
- Outstanding FAILs at sprint end (must be commits-in-flight or
  explicit Sprint 17 deferrals): _____
