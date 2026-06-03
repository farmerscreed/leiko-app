# Start here — current state (2026-06-02)

This is the living "where are we" pointer. Update it at the end of each
session. The previous handoff (the ADR-0006/0007 consolidation session) is
archived at `plans/done/session-2026-06-02-adr0006-0007-handoff.md`.

## 60-second context

Leiko's whole family / home / invite model was reshaped under two ADRs,
and that work is **now on `main`**:

- **ADR-0006** — unified caregiver/self-buyer model: one "circles" concept,
  `account_type` made inert at the render layer, one constellation home
  where the viewer is a node, Settings collapsed to 2 role-aware sections.
  **Accepted + shipped.**
- **ADR-0007** — unified "Connect" invite: one code, backend infers
  who-follows-whom from who wears a watch. Replaced the old 3-button /
  4-edge-function invite system. **Accepted + shipped.**

Both landed on `main` as **PR #8** (`3c1dba7`, merged 2026-06-02),
squash-merged after CI passed. Sprints are complete through **Sprint 20**
(`plans/done/sprint-20-phase1-stabilise-routing.md`).

## What's working right now (on `main`)

- Unified constellation home for every persona; viewer is a node, urgency
  ordering, self-as-centre beating orb, bottom tab bar, Ask-Leiko in header.
- Unified onboarding (no fork; everyone onboards `self_buyer`); "I have the
  watch" opens pairing.
- Settings → 2 role-aware sections + per-vital visibility.
- Connect invites: `connect-create` / `connect-accept` edge functions;
  one Connect sheet + one Enter-a-code sheet; dual delivery (link + 6-digit
  code); deep-link `join` route.
- Multi-vitals (BP / HR / SpO2 / Sleep / Activity) capture, hydration,
  trends, per-vital detail screens, doctor PDF, ambient AI surfaces.

## In flight

- **Documentation reconciliation** (this workstream, branch
  `claude/pensive-mayer-IpwNO`): bringing every doc in line with the shipped
  app after the ADR-0006/0007 pivot. See the drift inventory captured in
  this session.

## Stack decisions (resolved)

1. **WatermelonDB — DROPPED** ([ADR-0009](../docs/_adr/0009-drop-watermelondb.md),
   founder decision 2026-06-02). It was locked but never installed; the app
   uses Supabase. There is no on-device relational DB — persistence is MMKV +
   Zustand, with Supabase as the queryable source of truth via TanStack Query.
   Stack docs updated.
2. **AI Tier A (Llama 3.1/3.2 on Ollama) — STILL PLANNED (v1.x).** Locked in
   `docs/00-tech-stack.md` but not yet built; the live "Tier A" is a
   client-side deterministic intent-router + templates (no local LLM). Tier B
   (Haiku) and Tier C (Sonnet) are real. Docs mark the Ollama tier "planned,
   not yet built."

## Next steps (priority order)

1. **Founder-ops launch blitz** — the OPS-1..12 external dependencies in
   `plans/PRODUCTION_READINESS.md` (keystores, certs, APNs/FCM, RevenueCat,
   domain hosting, prod env vars). These gate store submission and only the
   founder can do them.
2. **Finish the production test** (`plans/comprehensive-test.md`): the full
   3-phone Connect matrix, visibility toggles, the both-wear "follow back"
   path.
3. **Retire the old 4 invite edge functions** (send-family-invite,
   accept-family-invite, send-care-invite, resolve-care-invite) once the
   back-compat window for already-issued codes closes.
4. **Build / flash a fresh APK from `main`** after the ops blitz.

## Source-of-truth docs

- `plans/PRODUCTION_READINESS.md` — launch-gating checklist (what ships at v1.0).
- `plans/SPRINT_SEQUENCE.md` — sprint index + dependency graph.
- `plans/comprehensive-test.md` — staged device test plan.
- `docs/_adr/` — the seven accepted ADRs.
