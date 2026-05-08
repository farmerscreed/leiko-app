# Sprint Sequence — Post-Pivot

**Updated 2026-05-07 for the Apple-of-Healthcare pivot.** The 17-sprint plan is restructured with seven new sprints inserted (1.5, 7.5, 7.6, 7.7, 8.5, 9.5, 12.5). Existing un-done sprint cards (8 → 17) updated in place to consume D11–D14 content. This document is the index — read it to understand sequence + gating; read the individual sprint cards for details.

---

## Phase 0 — Strategic docs (complete or in progress)

| State | Doc | Path |
|---|---|---|
| ✅ | D11 — Brand Repositioning | `WATCH PROJECT/D11_Brand_Repositioning.md` |
| ✅ | D12 — Visual System v2 | `WATCH PROJECT/D12_Visual_System_v2.md` |
| ✅ | D13 — Multi-Vitals Constellation Spec | `WATCH PROJECT/D13_Multi_Vitals_Constellation_Spec.md` |
| ✅ | D14 — Ambient AI Architecture | `WATCH PROJECT/D14_Ambient_AI_Architecture.md` |
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

## Phase 2 — Foundation rebuild (remaining)

| Order | Sprint | Title | Type | File |
|---|---|---|---|---|
| 2 | **7.5** | Multi-vitals ingest plumbing | NEW | `sprint-07-5-multi-vitals-plumbing.md` |
| 3 | **7.6** | Daily Pulse + Vital Tile component primitives | NEW | `sprint-07-6-daily-pulse-primitives.md` |
| 4 | **7.7** | Caregiver Home rewrite (Daily Pulse cards) | NEW | `sprint-07-7-caregiver-home-rewrite.md` |

Sprint 1.5 shipped 2026-05-07 (closeout in `plans/done/sprint-01-5-visual-system-v2.md`). Remaining three are the Phase 2 work that gates any new screen sprints.

---

## Phase 3 — Screens (rewritten + new)

| Order | Sprint | Title | Type | File |
|---|---|---|---|---|
| 5 | **8** | Self-Buyer Home (Daily Pulse) | REWRITTEN | `sprint-08-self-buyer-home.md` |
| 6 | **8.5** | Per-vital detail screens (HR · SpO2 · Sleep · Activity) | NEW | `sprint-08-5-vital-detail-screens.md` |
| ✅ | **9** | Trends + Multi-Vital PDF | REWRITTEN | `done/sprint-09-trends-pdf.md` |
| 8 | **9.5** | Apple Health + Health Connect | NEW | `sprint-09-5-health-platform-integration.md` |
| 9 | **10** | Settings + Family + Paywall | EDITED | `sprint-10-settings-family-paywall.md` |

---

## Phase 4 — AI surfaces

| Order | Sprint | Title | Type | File |
|---|---|---|---|---|
| 10 | **11** | AI Tier-A Multi-Vital Intent Router | REWRITTEN | `sprint-11-ai-tier-a.md` |
| 11 | **12** | AI Tier-B Multi-Vital (LiteLLM) | REWRITTEN | `sprint-12-ai-tier-b.md` |
| 12 | **12.5** | Ambient AI Surfaces | NEW | `sprint-12-5-ambient-ai-surfaces.md` |

Sprint 12.5 is the sprint that delivers on D11's *ambient pulse intelligence* claim — daily narration, weekly summary, monthly baseline, contextual paragraphs, doctor-prep generator, learned-time reminders.

---

## Phase 5 — Education + safety + polish

| Order | Sprint | Title | Type | File |
|---|---|---|---|---|
| 13 | **13** | Learn Surface A + B (Multi-Vital) | EDITED | `sprint-13-learn-a-b.md` |
| 14 | **14** | Learn Surface C (Multi-Vital Seeding) | EDITED | `sprint-14-learn-c.md` |
| 15 | **15** | Push + Multi-Vital Anomaly Engine | REWRITTEN | `sprint-15-push-anomaly.md` |
| 16 | **16** | Offline + Error States (Multi-Vital) | EDITED | `sprint-16-offline-error-states.md` |

---

## Phase 6 — Launch

| Order | Sprint | Title | Type | File |
|---|---|---|---|---|
| 17 | **17** | Launch | EDITED | `sprint-17-launch.md` |

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
                                                  Sprint 17 (launch)
```

Notes on the graph:
- **Sprint 1.5 is the gate** — no UI sprint can begin until tokens are migrated.
- **Sprint 7.5 + 7.6 can run in parallel** if you have two engineers — they don't depend on each other (7.5 is backend, 7.6 is frontend primitives consuming mock data).
- **Sprint 9.5 (Apple Health) and Sprint 10 (Settings + Paywall) are coupled** — Sprint 10 surfaces the Health Platform toggles that Sprint 9.5 wires.
- **Sprint 12.5 unblocks** the AI narration consumers in Sprints 7.7, 8, 8.5, 9 — until 12.5 ships, those sprints carry placeholder narration strings.
- **Sprint 13 is a hard gate for Sprint 11** — the Tier-A intent router cites Learn cards by ID, which means the cards must exist.

---

## Capacity / duration estimate

Aggregating durations from each card:

| Phase | Sprints | Estimated weeks |
|---|---|---|
| Phase 2 — Foundation | 1.5 + 7.5 + 7.6 + 7.7 | ~6 weeks (some parallel possible) |
| Phase 3 — Screens | 8 + 8.5 + 9 + 9.5 + 10 | ~6 weeks |
| Phase 4 — AI | 11 + 12 + 12.5 | ~4 weeks |
| Phase 5 — Education + safety + polish | 13 + 14 + 15 + 16 | ~4 weeks |
| Phase 6 — Launch | 17 | ~1 week |
| **Total elapsed** | | **~21 weeks (~5 months)** |

Assumes single full-time engineer + designer engaged through D12 + Phase 2. Two engineers shaves ~3–4 weeks off Phase 2 if 7.5 and 7.6 run in parallel.

---

## What's not on this list

- Strategic docs (D1–D14) — those are in `docs/_reference/` (D1–D10) and `WATCH PROJECT/` (D11–D14)
- Sprint 7-original — superseded by Sprint 7.7 rewrite; the original is in `plans/done/` for historical reference
- v1.1 features — voice mode AI, dark-mode launch, custom icon set, expanded correlation explorer, Apple Watch / Wear OS companion, additional health platform integrations (Garmin, Fitbit, Oura, Whoop)

---

*Source of truth for sprint sequencing. Update when sprint cards move between phases or when the dependency graph changes.*
