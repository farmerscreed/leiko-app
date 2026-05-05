# Sprint 12 — AI Tier-B (LiteLLM)

## Goal
Wire LiteLLM (running on the founder's Hetzner VPS) as the Tier-B handler. System prompt enforces account_type variant, forbidden claims list, citation requirement. Output guard rejects responses that violate D5 §6.4. Tier-C refusals route to canned copy.

## Duration
~1 work-week.

## Hard dependencies
Sprint 11.

## Docs to load
docs/07-ai-assistant.md, docs/05-voice-and-claims.md, docs/00-tech-stack.md (§ Compliance, § AI Layer).

## Deliverables
- apps/mobile/src/services/ai/tierB.ts — LiteLLM client (via Edge Function proxy)
- System prompt template with account_type, forbidden claims, allowed article IDs
- Output guard: rejects responses containing forbidden phrases, retries with stronger prompt
- Supabase Edge Function as the proxy (so the API key never touches the client)
- Tier-C refusal canned copy per D9 §7.3 / docs/07-ai-assistant.md §4
- PHI scrubber wrapper (`functions/_shared/phi-scrub.ts`) imported by every external-egress call
- Audit-log entry for every AI egress

## Acceptance criteria
- A personalised question routes to Tier-B and returns within 5 seconds (p50; p95 ≤ 10s)
- Response always cites at least one Learn article when relevant
- Diagnostic question ("Do I have hypertension?") returns the Tier-C canned copy
- Output guard catches a forbidden phrase in a synthetic test and retries
- Jailbreak red-team suite (~50 prompts) deflection rate = 100%
- PHI scrub test: synthetic payload with email + sys/dia → arrives at LiteLLM with PHI redacted

## Open prompt
Sprint 12 — AI Tier-B (LiteLLM). Read CLAUDE.md, then docs/07-ai-assistant.md, docs/05-voice-and-claims.md.

Propose:

1. Edge Function architecture and auth model
2. System prompt structure (sections, lengths)
3. Output guard implementation (regex? embedding? both?)
4. Latency budget and timeout strategy
5. Cost estimate per query for Haiku 4.5 vs Sonnet 4.6 routing

Wait for approval.

## Risk notes
- LLM behaviour will surprise you. Build the output guard expecting failures, not as a defensive afterthought.
- Cost per query at Sonnet 4.6 is real money at scale. Default to Haiku and only escalate when needed.

## External dependency
**Q1 (D7 §14)**: Anthropic BAA must be signed before any reading data is forwarded to Tier B/C in production. Until then, run on synthetic/scrubbed data only.
