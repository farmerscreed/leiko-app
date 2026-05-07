# Sprint 12.5 — Ambient AI Surfaces

## Goal
The five ambient AI surfaces per D14 §3–§8 ship: daily readiness narration on Daily Pulse, contextual paragraphs on reading detail, learned-time reminders, Tier-C weekly summary scheduled job, Tier-C monthly baseline scheduled job, and doctor-prep generation. This is the sprint that delivers on D11's *ambient pulse intelligence* claim.

## Duration
~2 work-weeks.

## Hard dependencies
Sprint 11 (Tier-A templates). Sprint 12 (Tier-B + output guard). Sprint 9 (Trends to surface weekly summary cards). Sprint 7.7 + 8 (home screens to consume narration).

## Docs to load
docs/_reference/D14-ambient-ai-architecture.md (full doc), docs/_reference/D13-multi-vitals-constellation-spec.md (§7.3 narration data shape, §9 correlation engine).

## Deliverables
- **Daily readiness narration generator** per D14 §3:
  - Tier routing decision tree (free → Tier-A template; Plus + novel pattern → Tier-B)
  - Cached in `state/dailyPulse.ts` + `ai_messages` for re-use during the day
  - 4-hour cache TTL per Q-D14-4
  - Wires Sprint 8 + 7.7 placeholder strings to real generated content
- **Contextual paragraph generator on reading detail** per D14 §4:
  - Tier routing per reading novelty
  - Cached per reading_id in `ai_messages` with `context = 'reading_detail'`
  - Powers Sprint 8.5 pattern-callout slot
- **Learned-time reminders** per D14 §5:
  - Pattern-detection of habitual reading time (median over last 30 readings)
  - Push delivery at habitual_time + 30min if no reading by then
  - Hand-written copy templates (no LLM)
  - Suppression rules (max 2/day, quiet hours, recent-reading suppress, decay)
- **Tier-C weekly summary** per D14 §6:
  - `compute-weekly-summary` Edge Function
  - Sunday 18:00 caregiver-local-time cron
  - Sonnet 4.6 prompt + output guard
  - Surfaced in Trends as in-app card + push to all caregivers
  - Stored in `ai_messages` with `context = 'weekly_summary'`
- **Tier-C monthly baseline** per D14 §7:
  - `compute-monthly-baseline` Edge Function
  - First-of-month cron
  - Surfaces in Trends as collapsed card; NO push (per Q-D14-2)
  - Used as context input to subsequent Tier-B daily-narration prompts
- **Doctor-prep generation** per D14 §8:
  - Wired to Sprint 9 PDF export flow
  - Tier-B cover paragraph + Tier-C observations (if available within last 7 days)
  - Plus-only per D8a §15 default
- **Quota enforcement + paywall surfacing** per D14 §14
- New doc: `docs/14-ambient-ai-surfaces.md`

## Acceptance criteria
- Daily narration appears on Self-Buyer Home + Caregiver Home cards within 4s of first paint
- Cache hit on second open same day = no LLM call
- Plus user with novel pattern triggers Tier-B; Plus user with routine state triggers Tier-A template; free user always Tier-A
- Weekly summary cron fires Sunday 18:00 local for synthetic family in dev
- Monthly baseline cron fires first-of-month for synthetic family in dev
- Doctor-prep PDF generates with AI-generated cover + observations sections (Plus only)
- Free user attempting doctor-prep sees paywall
- Tier-B quota counter accurate; over-run UX shows the friendly message
- Learned-time reminder fires for synthetic user with consistent 7:42am readings; does not fire for user with inconsistent timing
- All AI egress passes voice gate (10% sample manually reviewed)

## Open prompt
Sprint 12.5 — Ambient AI Surfaces. Read CLAUDE.md, then docs/_reference/D14-ambient-ai-architecture.md.

Propose:

1. Cron infrastructure — Supabase scheduled functions vs external (n8n on Hetzner)?
2. Cross-timezone scheduling for caregiver-local cron — implementation pattern
3. Tier-B vs Tier-A novel-pattern detection — what counts as "novel"?
4. Cache invalidation strategy when a new reading comes in (does daily narration regenerate?)
5. Push notification copy for weekly summary — voice-lint pre-merge

Wait for approval.

## Risk notes
- Cron timezone correctness for global family members is non-trivial. Plan a focused subtask.
- Monthly baseline costs more (Sonnet) — cache aggressively.
- Tier-C output guard is the most consequential — Sonnet writes the longest paragraphs and has the highest claim-leakage risk.
- Cost monitoring per D14 §16 must run from day one — alert if monthly cost exceeds 2× projection.

## External dependency
**Q1**: Anthropic BAA — Tier-B/C cannot run on real reading data without it. In dev, all surfaces run on synthetic data.

## What this sprint explicitly does NOT ship
- Tier-A intent router or Tier-B LLM client (Sprint 11, 12)
- The conversational chat surface — already exists per Sprint 11/12
- Voice-mode AI (deferred to v1.2)