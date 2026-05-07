# Sprint 12 — AI Tier-B Multi-Vital (LiteLLM)

## Goal
Wire LiteLLM (running on the founder's Hetzner VPS) as the Tier-B handler with **multi-vital prompt scope** per D14 §11. Non-overrideable system prompt enforces D11 voice rules + extended forbidden vocabulary. Output guard rejects responses violating D14 §12. Three-layer guard (regex pre-check + embedding semantic check + clinical-advisor sample-review). PHI scrubber extended for all five vitals. Jailbreak red-team suite expanded to ~80 prompts per D14 §17.

## Duration
~1 work-week.

## Hard dependencies
Sprint 11.

## Docs to load
docs/_reference/D14-ambient-ai-architecture.md (§11, §12, §13, §17), docs/_reference/D11-brand-repositioning.md (§3 voice), docs/00-tech-stack.md (§ Compliance, § AI Layer).

## Deliverables
- `apps/mobile/src/services/ai/tierB.ts` — LiteLLM client (via Edge Function proxy)
- `supabase/functions/ai-tier-b/` — Edge Function proxy with non-overrideable system prompt prepend
- Full system prompt per D14 §11 embedded server-side (never client-side)
- User-prompt wrapping — `<user_query>` tags with anti-injection guard
- Output guard Layer 1 (regex pre-check) per D14 §12.1
- Output guard Layer 2 (embedding semantic check vs diagnostic cluster) per D14 §12.2
- Output guard Layer 3 (10% sample → clinical advisor queue) — queue table + admin surface
- PHI scrubber `functions/_shared/phi-scrub.ts` extended for all multi-vital fields per D14 §13
- Audit log entries for every AI egress per D14 §15 (all 9 action types)
- Jailbreak red-team test suite (~80 prompts) per D14 §17 wired into CI
- Tier-C refusal canned copy per D9 §7.3 / D14 §13
- Latency budget + timeout strategy
- DEFER template fall-through wired

## Acceptance criteria
- A multi-vital question routes to Tier-B and returns within 5 seconds (p50; p95 ≤ 10s)
- Response cites at least one Learn card when relevant
- Diagnostic question routes to Tier-C canned DEFER copy
- Output guard Layer 1 catches a forbidden phrase in synthetic test and retries
- Output guard Layer 2 catches a diagnostic-leaning response (cosine > 0.75) and retries
- Layer 3 sample queue receives 10% of responses
- Jailbreak red-team suite — 100% deflection rate (failure blocks merge)
- PHI scrub test: synthetic payload with email + sys/dia + HR + SpO2 + sleep details → arrives at LiteLLM with PHI redacted, vitals intact
- Cost per query measured against D14 §16 projection (~$0.000188/Tier-B call)
- All 9 audit-log action types fire correctly

## Open prompt
Sprint 12 — AI Tier-B Multi-Vital. Read CLAUDE.md, then docs/_reference/D14-ambient-ai-architecture.md (§11, §12, §17).

Propose:

1. Edge Function architecture and auth model (service-role JWT validation)
2. Output guard Layer 2 embedding model — small enough to run on Hetzner CPU, accurate enough for diagnostic detection
3. Layer 3 clinical-advisor admin surface — Supabase Studio query? Custom dashboard?
4. Latency budget and timeout strategy (p50 5s, p95 10s)
5. Cost budget per query — Haiku 4.5 (default) vs Sonnet 4.6 escalation criteria

Wait for approval.

## Risk notes
- LLM behaviour will surprise. Build the output guard expecting failures, not as a defensive afterthought.
- Cost per query at Sonnet is real money at scale. Default to Haiku per D14 §1; escalate only when Tier-C needed.
- The expanded jailbreak red-team suite tests multi-vital probes (sleep apnea framing, AFib framing from HR, multi-vital ER-panic prompts). All must DEFER.
- PHI scrub regression is silent and dangerous — gate at unit test level, NOT integration test only.

## External dependency
**Q1 (D7 §14)**: Anthropic BAA must be signed before any reading data is forwarded to Tier B/C in production. Until then, run on synthetic/scrubbed data only.

## What this sprint explicitly does NOT ship
- The ambient AI surfaces — daily narration generator, weekly summary cron, monthly baseline cron, doctor-prep, learned-time reminders (Sprint 12.5)
- Sonnet 4.6 routing — Sprint 12.5 invokes Tier-C; this sprint just defines the routing surface