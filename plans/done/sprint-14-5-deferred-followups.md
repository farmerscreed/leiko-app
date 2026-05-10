# Sprint 14.5 — Deferred Follow-ups

## Goal
Clear the orphan items piling up in close-out memos before opening Sprint 12.5 (Ambient AI Surfaces, ~2 weeks). This is a deliberate cleanup pass — small, low-risk tasks across 5+ prior sprints that never made it into a focused card. Closing them now reduces mental overhead and unblocks the Sprint 12 → 12.5 → 15 → 16 → 17 critical path with no half-finished work in the rear-view.

## Duration
~3–5 work-days.

## Hard dependencies
None. Every item is independent of the others; can ship one PR per item or bundle similar ones.

## Deliverables (all buildable; no external decisions in this sprint)

### Sprint 12 polish
1. **Mobile error-mapping in AskLeikoBody** — server returns `{ status: 'error', error: '...' }` with codes `no_family`, `no_session`, `unauthorized`, `quota_exceeded`, `invalid_question`, `question_too_long`, `anthropic_http_*`. Currently every non-2xx surfaces as the same generic "I couldn't reach Leiko" copy. Map the known codes to specific voice-clean copy:
   - `no_family` → "Finish setting up Leiko first to ask questions."
   - `no_session` → "Sign in again to ask Leiko."
   - `quota_exceeded` → already has dedicated state (verbatim D14 §14.2).
   - `unauthorized` / `network_error` / `client_timeout` → keep generic.
   - All other Edge Function errors → keep generic.
2. **Self-buyer family auto-provision** — pre-onboarding test users (legacy accounts created before Sprint 4 self-buyer flow) have no `family_members` row, breaking every Edge Function that calls `loadDemographics`. Two options:
   - (a) Call `create_family` from the mobile app at Home first-paint when account_type='self_buyer' and no membership exists (defensive, one-time backfill on app start).
   - (b) Add a server-side shim in the affected Edge Functions to provision-on-first-call.
   - **Lean**: (a) — keeps the Edge Functions stateless. Single call to the existing `create_family` RPC.

### Sprint 14 polish
3. **Caregiver Home Learn-card seed** — Sprint 14 shipped the seeded "Worth a read" card on Self-Buyer Home only. Caregiver Home should surface the same priority-cascade card. Reuse `useSeededLearnCard()` and `<HomeLearnCard/>`; place above the constellation legend. Voice-clean check on any new copy.

### Sprint 9 polish
4. **`pg_cron` schedule for `compute-correlations`** — Sprint 9 shipped the Edge Function and the table; the scheduled-job migration was deferred. Add a migration that schedules `compute-correlations` to run nightly (pick a low-traffic UTC time — say 03:00). Use Supabase pg_cron extension; the migration adds a single `cron.schedule(...)` call.

### Sprint 7.5 polish
5. **BLE `setUserParams` + `setGoals` writers** — Sprint 7.5 plumbed these as stubs in `services/watch/commands.ts` (or equivalent) per `docs/06-ble-protocol.md`. Wire the actual write paths so caregivers can push age/height/weight + step/sleep goals to the watch. Both are short writes per the Urion U16 protocol; tests verify the byte-shape.

### Sprint 12 visual polish
6. **D12 light-mode amber contrast token fix** — `brand.primary #E8A063` lands at 2.0–2.2:1 on linen surfaces, below the §2.6 minimum. Move to a darker shade (e.g., `#C97D3F` candidate; designer to confirm). This is a token-level edit + visual regression pass on the screens that use it.

## Acceptance criteria
- AskLeikoBody renders distinct voice-clean copy for each known server error code; existing generic copy stays as fallback.
- A self-buyer who logs in without a family_members row gets one created within 1s of Home first-paint; subsequent Edge Function calls succeed.
- Caregiver Home renders a `<HomeLearnCard/>` slot when the priority cascade matches; positioning matches the design.
- A Postgres migration registers `compute-correlations` as a nightly pg_cron job.
- The watch accepts `setUserParams` + `setGoals` BLE writes; tests cover the byte-shape.
- Light-mode amber token meets §2.6 contrast on the linen surfaces; designer reviews and signs off the new shade.

## Risk notes
- **Caregiver Learn-seed needs the same priority-cascade hook the self-buyer surface uses.** If the hook returns null on caregiver context, surface a no-op (same as self-buyer), don't show a stale card.
- **`pg_cron` schedule must not conflict with `/sync` traffic.** Pick 03:00 UTC (off-peak globally for Lagos + US east).
- **BLE writers can brick a watch.** Test on a sacrificial pairing first; the protocol doc has the exact byte sequences — don't improvise.
- **Amber token change ripples.** Run a snapshot diff across all screens that use `brand.primary` before merging.

## What this sprint explicitly does NOT ship
- Day-3/7/14 push copy + scheduling (deferred to Sprint 15 — push infrastructure ground).
- Live jailbreak red-team CI runner (Sprint 17 launch prep).
- Layer 3 clinical-advisor admin surface (when advisor is hired).
- PDF rasterizer vendor pick (founder decision, not engineering).
- On-device APK manual verification for Sprint 10 polish (manual QA, not engineering).
- Anthropic BAA + LiteLLM Hetzner gateway (founder ops).

## Open prompt
Sprint 14.5 — Deferred Follow-ups. Read CLAUDE.md, then the existing close-out memos referenced (Sprint 7.5, 9, 12, 14). Each item is independent; bundle by domain (mobile / SQL / BLE / tokens) for clean commits.

Propose:
1. Order — start with Sprint 12 polish (mobile error mapping + self-buyer family auto-provision) since they unblock real-user testing.
2. Follow with caregiver Learn-seed (mobile, fast, visible).
3. Then `pg_cron` migration (SQL, no UI).
4. Then BLE writers (watch protocol, harder; test on dev pairing).
5. Amber token last (designer-gated).

Wait for approval.
