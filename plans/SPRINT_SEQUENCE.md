# Sprint Sequence — Post-Pivot

**Updated 2026-06-02 — Sprint 18 closed; Sprints 19 and 20 added; Phase 7 added for the ADR-0006/0007 unified-model pivot, which shipped to `main` as PR #8 (`3c1dba7`). Also corrected the D11–D14 paths (they live in `docs/_reference/`, not the retired `WATCH PROJECT/` working folder).** Previous update 2026-05-20 added the 16.5a–i hardening passes, Sprints 16.6 / 17a / 17b / 18, and reorganised Phase 6 to reflect Sprint 18 as the launch-readiness sprint that supersedes the original Sprint 17 card. Update 2026-05-07 inserted Sprints 1.5, 7.5, 7.6, 7.7, 8.5, 9.5, 12.5 for the Apple-of-Healthcare pivot. This document is the index — read it to understand sequence + gating; read the individual sprint cards for details.

---

## Phase 0 — Strategic docs (complete or in progress)

| State | Doc | Path |
|---|---|---|
| ✅ | D11 — Brand Repositioning | `docs/_reference/D11-brand-repositioning.md` |
| ✅ | D12 — Visual System v2 | `docs/_reference/D12-visual-system-v2.md` |
| ✅ | D13 — Multi-Vitals Constellation Spec | `docs/_reference/D13-multi-vitals-constellation-spec.md` |
| ✅ | D14 — Ambient AI Architecture | `docs/_reference/D14-ambient-ai-architecture.md` |
| ✅ | D15 — Affiliate & Editorial Commerce Strategy | `docs/_reference/D15-affiliate-strategy.md` |
| ⏳ | Surgical doc-tree updates (`docs/04-screens/`, `docs/03-components/`, `docs/05-voice-and-claims.md`, `docs/07-ai-assistant.md`, `docs/10-anomaly-logic.md`, `docs/11-push-notifications.md`) | One sweep PR after sign-off |

---

## Phase 1 — Done

| State | Sprint | Title |
|---|---|---|
| ✅ | 0 | Bootstrap |
| ✅ | 1 | Design system |
| ✅ | 2 | Auth + fork |
| ✅ | 3 | Caregiver onboarding |
| ✅ | 4 | Self-buyer onboarding |
| ✅ | 5 | Watch pairing |
| ✅ | 6 | Take reading (BP) |
| ✅ | 7 | Caregiver Home (BP-only original — superseded by Sprint 7.7 rewrite) |
| ✅ | 1.5 | Visual System v2 token rollout (D12) |

---

## Phase 2 — Foundation rebuild

| Order | Sprint | Title | Type | File |
|---|---|---|---|---|
| ✅ | **7.5** | Multi-vitals ingest plumbing | NEW | `done/sprint-07-5-multi-vitals-plumbing.md` |
| ✅ | **7.6** | Daily Pulse + Vital Tile component primitives | NEW | `done/sprint-07-6-daily-pulse-primitives.md` |
| ✅ | **7.7** | Caregiver Home rewrite (Daily Pulse cards) | NEW | `done/sprint-07-7-caregiver-home-rewrite.md` |

---

## Phase 3 — Screens (rewritten + new)

| Order | Sprint | Title | Type | File |
|---|---|---|---|---|
| ✅ | **8** | Self-Buyer Home (Daily Pulse) | REWRITTEN | `done/sprint-08-self-buyer-home.md` |
| ✅ | **8.5** | Per-vital detail screens (HR · SpO2 · Sleep · Activity) | NEW | `done/sprint-08-5-vital-detail-screens.md` |
| ✅ | **9** | Trends + Multi-Vital PDF | REWRITTEN | `done/sprint-09-trends-pdf.md` |
| ✅ | **9.5** | Apple Health + Health Connect | NEW | `done/sprint-09-5-health-platform-integration.md` |
| ✅ | **10** | Settings + Family + Paywall | EDITED | `done/sprint-10-settings-family-paywall.md` |

---

## Phase 4 — AI surfaces

| Order | Sprint | Title | Type | File |
|---|---|---|---|---|
| ✅ | **11** | AI Tier-A Multi-Vital Intent Router | REWRITTEN | `done/sprint-11-ai-tier-a.md` |
| ✅ | **12** | AI Tier-B Multi-Vital (LiteLLM) | REWRITTEN | `done/sprint-12-ai-tier-b.md` |
| ✅ | **12.5** | Ambient AI Surfaces | NEW | `done/sprint-12-5-ambient-ai-surfaces.md` |
| ✅ | **12.5.1** | BLE active-sync hotfix | INSERTED | `done/sprint-12-5-1-ble-active-sync.md` |
| ✅ | **12.5.2** | Watch BP persistence + Settings rebuild | INSERTED | `done/sprint-12-5-2-watch-bp-persistence.md` |

Sprint 12.5 delivered D11's *ambient pulse intelligence* claim — daily narration, weekly summary, monthly baseline, contextual paragraphs, doctor-prep generator, learned-time reminders. 12.5.1 + 12.5.2 closed the BLE / watch-config gaps that surfaced from bench work.

---

## Phase 5 — Education + safety + polish

| Order | Sprint | Title | Type | File |
|---|---|---|---|---|
| ✅ | **13** | Learn Surface A + B (Multi-Vital) | EDITED | `done/sprint-13-learn-a-b.md` |
| ✅ | **14** | Learn Surface C (Multi-Vital Seeding) | EDITED | `done/sprint-14-learn-c.md` |
| ✅ | **14.5** | Deferred Follow-ups (cleanup pass) | NEW | `done/sprint-14-5-deferred-followups.md` |
| ✅ | **15** | Push + Multi-Vital Anomaly Engine | REWRITTEN | `done/sprint-15-push-anomaly.md` |
| ✅ | **16** | Offline + Error States (Multi-Vital) | EDITED | `done/sprint-16-offline-error-states.md` |

Sprint 14.5 is a deliberate cleanup pass inserted before Sprint 12.5 to close the orphan items that accumulated across sprints 7.5 / 9 / 12 / 14 (BLE writer stubs, pg_cron schedule, caregiver Learn-seed, error-mapping polish, amber token fix).

---

## Phase 5.5 — Data-plane hardening (inserted 2026-05-12 → 2026-05-14)

Single-phone bench work surfaced ~30 BLE / sync / hydration issues across BP + HR + SpO2 + Sleep + Activity. The 16.5a–i sequence closed them, each as a self-contained one-day card. Memory files in `memory/sprint_16_5*_close_out.md` carry the load-bearing findings.

| Order | Sprint | Title | File |
|---|---|---|---|
| ✅ | **16.5a** | BP cursor root cause + fix (TS=0 always) | `done/sprint-16-5a-data-plane-capture.md` |
| ✅ | **16.5b** | (Superseded by 16.5c root-cause finding) | — |
| ✅ | **16.5c** | Multi-vitals drain ROOT CAUSE (vitals_dedupe partial index) | — |
| ✅ | **16.5d** | HR/SpO2 wall-clock-as-UTC + SpO2 single-byte parser + Sleep rebuild | — |
| ✅ | **16.5e** | Multi-vital hydration + 7d/30d/90d wiring | — |
| ✅ | **16.5f** | Stale-caption explainer + vitalBaselines utility | — |
| ✅ | **16.5g** | Trends Tier-C narrative engine + focal vital wiring | — |
| ✅ | **16.5h** | For-your-doctor cover note + dynamic page count + locked-chip | — |
| ✅ | **16.5i** | Code-side P0s from PRODUCTION_READINESS audit (CODE-1..6) | — |

---

## Phase 6 — Launch (Pre-Submission)

| Order | Sprint | Title | Status | File |
|---|---|---|---|---|
| ✅ | **16.6** | Pre-launch validation + P1 hardening + two-phone test rig | Closed 2026-05-19 | `done/sprint-16-6-pre-launch-validation.md` |
| ✅ | **17a** | Per-person dashboard (caregiver immersive surface) | Closed 2026-05-20 | `done/sprint-17a-per-person-dashboard.md` |
| ✅ | **17b** | Family member management + visibility enforcement | Closed 2026-05-20 | `done/sprint-17b-family-member-management.md` |
| ✅ | **18** | Launch readiness blitz (SEC-1 + ops + PDF wiring + CI) | Closed 2026-06-02 (engineering done; founder-ops OPS-1..12 tracked in `PRODUCTION_READINESS.md`) | `done/sprint-18-launch-readiness.md` |

The original Sprint 17 "Launch" card was superseded — its scope was redistributed across 16.6 / 17a / 17b / 18. The card now sits in `done/` with a SUPERSEDED header explaining the redistribution.

---

## Phase 7 — Unified-model pivot (ADR-0006 / ADR-0007)

Hands-on multi-phone testing after Sprint 18 surfaced that the
caregiver/self-buyer split and the multi-button invite system were
confusing in practice. Rather than patch them incrementally (the original
Sprint 19 scope), the founder and engineer wrote two ADRs that unified the
model wholesale. This work shipped to `main` as **PR #8** (`3c1dba7`,
2026-06-02).

| Order | Sprint | Title | Status | File |
|---|---|---|---|---|
| ⛔️ | **19** | Multi-account + caregiver-model fixes | SUPERSEDED by ADR-0006/0007 | `done/sprint-19-multi-account-caregiver-model.md` |
| ✅ | **20** | Phase 1 — stabilise sync routing (device-authoritative) | Closed | `done/sprint-20-phase1-stabilise-routing.md` |
| ✅ | **ADR-0006** | Unified caregiver/self-buyer model (one constellation home, `account_type` inert, Settings → 2 sections) | Accepted + shipped (PR #8) | `docs/_adr/0006-unified-caregiver-self-buyer-model.md` |
| ✅ | **ADR-0007** | Unified "Connect" invite (one code; direction inferred from watch ownership) | Accepted + shipped (PR #8) | `docs/_adr/0007-unified-connect-invite.md` |

Sprint 19's incremental fixes were folded into the ADR work — that card is
in `done/` with a SUPERSEDED header. The session handoff for the pivot is
archived at `done/session-2026-06-02-adr0006-0007-handoff.md`.

---

## Phase 8 — Store submission (post-pivot)

There is no dedicated sprint card for the final store-submission work. The remaining items are tracked in **`plans/PRODUCTION_READINESS.md`** — the launch-gating checklist — as OPS-1..12 (founder ops blitz, all small), QUA-3/4/6 (Android BLE foreground service, CI workflow, npm vulns), and the explicit v1.1 deferrals (GAP-1..15, POL-1..7). Treat that document as the source of truth for "what ships at v1.0."

The actual submission cycle (TestFlight + Play Internal builds, App Store + Play screenshots, beta tester recruitment, store-review iteration) is a workstream against PRODUCTION_READINESS.md, not a new sprint card. As of 2026-06-02 it is gated only on the founder-ops dependencies (OPS-1..12) and a fresh APK built from `main` after the ADR-0006/0007 merge.

---

## Critical-path dependency graph

```
D11 ──► D12 ──► (D13 ∥ D14) ──► docs/ sweep PR
                                    │
                                    ▼
                            ┌─── Sprint 1.5 (tokens)
                            │
                            ▼
                       Sprint 7.5 (plumbing) ─── Sprint 7.6 (primitives) ─── Sprint 7.7 (caregiver home)
                                                        │
                                                        ▼
                                                  Sprint 8 (self-buyer home)
                                                        │
                                                        ▼
                                                  Sprint 8.5 (vital details)
                                                        │
                                                        ▼
                                                  Sprint 9 (trends + PDF)
                                                        │
                                                        ▼
                                                  Sprint 9.5 (Apple Health)
                                                        │
                                                        ▼
                                                  Sprint 10 (settings + paywall)
                                                        │
                                                        ▼
                                                  Sprint 11 (AI Tier-A)
                                                        │
                                                        ▼
                                                  Sprint 12 (AI Tier-B)
                                                        │
                                                        ▼
                                                  Sprint 12.5 (ambient AI)
                                                        │
                                                        ▼
                                                  Sprint 13 + 14 (Learn)
                                                        │
                                                        ▼
                                                  Sprint 15 (push + anomaly)
                                                        │
                                                        ▼
                                                  Sprint 16 (offline polish)
                                                        │
                                                        ▼
                                                  Sprint 16.5a–i (data-plane hardening)
                                                        │
                                                        ▼
                                                  Sprint 16.6 (pre-launch validation)
                                                        │
                                                        ▼
                                                  Sprint 17a (per-person dashboard)
                                                        │
                                                        ▼
                                                  Sprint 17b (family management)
                                                        │
                                                        ▼
                                                  Sprint 18 (launch readiness blitz) ✅ closed
                                                        │
                                                        ▼
                                                  Sprint 19 (model fixes) ⛔️ superseded
                                                        │
                                                        ▼
                                                  Sprint 20 (stabilise sync routing) ✅
                                                        │
                                                        ▼
                                                  ADR-0006 / ADR-0007 (unified model) ✅ PR #8
                                                        │
                                                        ▼
                                                  PRODUCTION_READINESS.md (store submission)
```

Notes on the graph:
- **Sprint 1.5 was the gate** — no UI sprint could begin until tokens were migrated.
- **Sprint 12.5 unblocks** the AI narration consumers in Sprints 7.7, 8, 8.5, 9.
- **Sprint 13 was a hard gate for Sprint 11** — the Tier-A intent router cites Learn cards by ID.
- **Sprint 16.5a–i** ran sequentially against the bench, not in parallel — each card surfaced data that fed the next.
- **Sprint 17a + 17b** could have run in parallel; they didn't because both depended on the 16.6 caregiver-flow context.
- **Sprint 18 closed 2026-06-02**; its remaining founder-ops items live in `PRODUCTION_READINESS.md`.
- **ADR-0006 / ADR-0007** superseded the incremental Sprint 19 fixes and shipped the unified model to `main` as PR #8.

---

## What's left at a glance

| Status | Item | Source |
|---|---|---|
| ✅ Done | ADR-0006/0007 unified model + Connect invites (PR #8) | `done/session-2026-06-02-adr0006-0007-handoff.md` |
| ✅ Done | Sprint 18 engineering (SEC-1 MMKV encryption, doctor-PDF wiring, CI workflows, Help/Support row, bench verification) | `done/sprint-18-launch-readiness.md` |
| ⏳ Pending | Founder ops blitz (OPS-1..12 — keystores, certs, APNs/FCM, RevenueCat, domain hosting, prod env) | `PRODUCTION_READINESS.md` |
| ⏳ Pending | Fresh APK from `main` after the ADR-0006/0007 merge | `NEXT_SESSION_START_HERE.md` |
| ⏳ Pending | Store submission (TestFlight, Play Internal, screenshots, store metadata, beta testers) | `PRODUCTION_READINESS.md` "Week 3" + "Week 4" |
| ❓ Founder | WatermelonDB + AI Tier-A (Llama/Ollama): locked in `00-tech-stack.md` but unbuilt — confirm planned vs. abandoned | `NEXT_SESSION_START_HERE.md` |
| 📦 v1.1 | GAP-1..15 (Sleep REM, hourly activity, sports records, deep BP backfill, embeddings build, full Learn corpus, photos, theme toggle, parent persona, jailbreak CI, Maestro E2E, Trends harmonisation, single-string cascade, clinical-review queue) | `PRODUCTION_READINESS.md` § P2 |
| 📦 v1.1 | POL-1..7 (watch timeout, domain URL config, dep pinning, gitignore, SQL lint CI, type casts, IANA timezone) | `PRODUCTION_READINESS.md` § P2 polish |

---

## What's not on this list

- Strategic docs (D1–D15) — all now consolidated in `docs/_reference/` (the old `WATCH PROJECT/` working folder for D11–D14 is retired)
- Sprint 7-original — superseded by Sprint 7.7 rewrite; the original is in `plans/done/` for historical reference
- v1.1 features — voice mode AI, dark-mode launch, custom icon set, expanded correlation explorer, Apple Watch / Wear OS companion, additional health platform integrations (Garmin, Fitbit, Oura, Whoop)

---

*Source of truth for sprint sequencing. Update when sprint cards move between phases or when the dependency graph changes.*
