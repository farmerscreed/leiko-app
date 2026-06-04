# 14 — Ambient AI Surfaces (implementation reference)

**Sprint 12.5 close-out doc.** Maps the abstract D14 architecture to the
concrete Edge Functions, mobile hooks, cache rows, and audit-log actions
that ship at v1.0. If you're implementing or debugging an ambient AI
surface, this is the file.

D14 (`docs/_reference/D14-ambient-ai-architecture.md`) remains the source
of truth for behaviour. This file documents the wiring.

> ⏳ **Tier A caveat (flagged 2026-06-02).** Any surface routed to "Tier A"
> below runs on the **client-side deterministic intent-router**, not a local
> LLM — the Llama-on-Ollama Tier A is planned but not yet built (see
> `docs/07-ai-assistant.md`). The cloud surfaces (Tier B Haiku / Tier C
> Sonnet) are live as documented.

---

## §1. Surface inventory

| # | Surface | Trigger | Tier | Edge Function | Mobile entry point |
|---|---|---|---|---|---|
| 1 | Daily readiness narration | Home first paint each local day | A or B | `ai-daily-narration` | `useDailyNarration()` |
| 2 | Reading-detail contextual paragraph | Reading detail screen mount | A (Tier-B is a follow-up) | none yet | `useReadingParagraph(reading)` |
| 3 | Learned-time reminders | Local push, no LLM | n/a | none | `services/reminders/learnedTime.ts` |
| 4 | Tier-C weekly summary | Hourly UTC cron | C | `compute-weekly-summary` | reads `ai_narration_cache` |
| 5 | Tier-C monthly baseline | Hourly UTC cron | C | `compute-monthly-baseline` | reads `ai_narration_cache` |
| 6 | Doctor-prep generation | "Share with doctor" tap | B + C | `generate-doctor-prep-ai` | wired into Sprint 9's PDF flow |

---

## §2. Cache (`public.ai_narration_cache`)

Single source of truth for generated narrations across every ambient
surface. Migration `0014_ai_ambient_surfaces.sql`.

```
unique (user_id, surface, scope_key)
```

| Surface enum | scope_key shape | TTL |
|---|---|---|
| `daily_narration` | `'YYYY-MM-DD'` local-date | 4 hours (D14 Q-D14-4) |
| `reading_detail` | reading UUID | forever |
| `weekly_summary` | `'YYYY-Www'` ISO week | forever |
| `monthly_baseline` | `'YYYY-MM'` UTC month | forever |
| `doctor_prep_cover` | PDF export id (UUID) | forever |
| `doctor_prep_observations` | PDF export id (UUID) | forever |

TTL is enforced at READ time (compare `generated_at` to `now()`). RLS
allows authenticated self-read; writes are service-role only.

---

## §3. Tier routing (D14 §3.2)

Decided server-side in the Edge Function (mobile may also pre-decide
for routing optimisation, but the EF gate is authoritative).

```
is user on Plus?
  ├── No  → Tier A
  └── Yes → does the user match any of these "novel" conditions?
              - 2+ vitals in calm-concerned
              - meaningful correlation in last 24h
              - returning after ≥7d absence
              - latest reading >10% off week-average
            ├── Yes → Tier B
            └── No  → Tier A
```

Implementation: `supabase/functions/_shared/novel-pattern.ts`
(`detectNovelPattern`). Mobile equivalent for synchronous client-side
routing isn't shipped yet — every Plus narration call hits the EF and
the EF returns `tier_a_recommended` if not novel.

---

## §4. Tier-C gating (`AI_TIER_C_PROD_DATA_ENABLED`)

Tier-C surfaces (`compute-weekly-summary`, `compute-monthly-baseline`,
`doctor-prep-ai` observations path) cost ~10× a Tier-B call. To
prevent dev environments from burning Sonnet credits unintentionally,
all three honour the env var:

- **`AI_TIER_C_PROD_DATA_ENABLED=false`** (default): Tier-C surfaces
  persist a deterministic placeholder body (`"Weekly summary not yet
  available — Tier-C is gated in this environment."`) and skip the
  Anthropic call entirely. The cache row is still written so the UI
  surface never crashes on a missing entry.
- **`AI_TIER_C_PROD_DATA_ENABLED=true`** (production / opt-in dev):
  real Sonnet 4.6 calls fire.

Doctor-prep observations fall back to Haiku when Tier-C is gated; the
cover always uses Haiku regardless.

---

## §5. Cron schedules

`pg_cron` jobs (migration `0015_pg_cron_tier_c.sql`):

| Job name | Schedule | Helper | Behaviour |
|---|---|---|---|
| `compute-correlations-hourly` | `0 * * * *` | `invoke_compute_correlations_cron()` | Sprint 14.5 |
| `compute-weekly-summary-hourly` | `0 * * * *` | `invoke_compute_weekly_summary_cron()` | Cache key dedupes |
| `compute-monthly-baseline-hourly` | `0 * * * *` | `invoke_compute_monthly_baseline_cron()` | Cache key dedupes |

All three helpers read URL + service-role key from Postgres GUCs:

```sql
alter database postgres set app.settings.functions_base_url = 'http://kong-internal:8000';
alter database postgres set app.settings.service_role_key = '<jwt>';
```

Without these, the helper raises and the failure surfaces in
`cron.job_run_details`.

The hourly cadence is fine because each surface caches its work; the
function cheaply no-ops when the row already exists for the current
ISO week / UTC month.

---

## §6. Audit-log actions (D14 §15)

| Action | Surface | Tier | Fires from |
|---|---|---|---|
| `ai.user_question` | conversational Q&A | B | `ai-tier-b` (Sprint 12) |
| `ai.daily_narration` | Surface 1 | A or B | `ai-daily-narration` |
| `ai.reading_paragraph` | Surface 2 | A | (mobile-side; not yet wired to audit_log — Sprint 16 polish) |
| `ai.weekly_summary` | Surface 4 | C | `compute-weekly-summary` |
| `ai.monthly_baseline` | Surface 5 | C | `compute-monthly-baseline` |
| `ai.doctor_prep` | Surface 6 | B + C | `generate-doctor-prep-ai` |
| `ai.output_guard_hit` | any tier-B/C | — | every EF on Layer 1/2 fire |
| `ai.refusal` | any | — | DEFER triggers + quota_exceeded + double-hit fall-through |
| `ai.tier_escalation` | not yet emitted | — | future v1.0 polish (Plus-would-have-gotten-Tier-B but Tier-A served — paywall datapoint) |

---

## §7. Quota counting (D14 §14.1)

Single counter swept from `audit_log` where:

```
actor_user_id = $userId
AND action IN ('ai.user_question', 'ai.daily_narration')
AND occurred_at >= start_of_month
```

Tier-C surfaces (weekly / monthly / doctor-prep) are auto-generated
and don't count against the user-asked quota; they fire from cron
or "Share with doctor" + are bounded by the cache rather than the
quota.

Mobile counter: `services/ai/quotaCounter.ts`. UI surface: Settings
→ AI Quota (Sprint 10b.2 wiring; data source extended in Sprint 12.5).

---

## §8. Output guard

All Tier-B/C surfaces share the Sprint 12 guard:

1. **Layer 1** — regex over D11 §3.2/§3.3 + D14 §11.1 forbidden
   vocabulary. (`_shared/output-guard/layer1-regex.ts`)
2. **Layer 2** — cosine similarity vs the diagnostic-leaning cluster
   (`_shared/output-guard/diagnostic-cluster.ts`) using
   `Supabase.ai.gte-small`. 3-second cold-start timeout; on timeout,
   skip Layer 2 with a console warning rather than blow past the
   request budget.
3. **Layer 3** — 10% sampling to `ai_clinical_review_queue` per D14
   §12.3. Wired for `ai-tier-b` (Sprint 12); ambient surfaces' samples
   are deferred pending a schema extension to allow either-table
   refs (Sprint 16 polish).

Two consecutive guard hits → fall through. For ambient surfaces,
fall-through returns `tier_a_recommended` so the mobile fallback
template paints; for `ai-tier-b` it returns DEFER:generic.

---

## §9. PHI scrubbing

`_shared/phi-scrub.ts` enforces the D14 §13 whitelist on the
assembled `ScrubbedAiContext`:

- First names / parent label
- Year of birth (gated by `AI_TIER_B_PROD_DATA_ENABLED`)
- Residence city (gated by same flag)
- Account type
- Reading values + aggregate metrics
- Quantised timestamps (day-level)
- Classification states
- Correlation coefficients (rounded to 2 decimals)

Banned keys (email / phone / full-names / MAC / IP / userAgent / etc)
are stripped at the assembler boundary. `assertScrubbed(ctx)` is
called before serialising into any prompt — a defensive guard against
later refactors silently widening the whitelist.

---

## §10. Things that EXPLICITLY do NOT ship in Sprint 12.5

Tracked elsewhere; not regressions:

- **Tier-B reading-detail paragraph** (only Tier-A in 12.5; future polish).
- **Caregiver Home per-parent narration via the EF** (deterministic
  placeholder copy from `caregiverPerson.ts` continues to ship — Tier-A
  per-parent is a polish item).
- **Push delivery for learned-time reminders** — engine + suppression
  rules ship in 12.5; expo-notifications schedule wraps around them
  in Sprint 15 (push infra ground).
- **Live jailbreak red-team CI runner** — Sprint 17 launch prep.
- **Layer 3 clinical-advisor admin dashboard** — when advisor hired
  (D14 §20 marks role TBD).
- **Hetzner LiteLLM gateway** — env-var swap when founder stands it up;
  the EF code is gateway-agnostic.

---

## §11. Verification matrix (founder, end-of-sprint)

To confirm Sprint 12.5 ships correctly:

| Surface | Steps | Expected |
|---|---|---|
| Daily narration (Tier-A free) | Self-buyer free user opens Home | NarrationCard renders an in-pattern Tier-A line within 4s |
| Daily narration (Tier-A cache) | Reload Home immediately after | Same body; no `ai_tier_b_started` analytics event |
| Daily narration (Tier-B Plus) | Plus user with novel pattern opens Home | Tier-A renders first; ~3-8s later upgrades to a Haiku line; `ai.daily_narration` audit row fires |
| Reading detail paragraph | Open any synced BP reading | One paragraph centered above "What does this mean?"; voice-clean |
| Reading detail cache | Re-open same reading | Same paragraph instantly (MMKV hit) |
| Weekly summary (Tier-C gated) | `select * from ai_narration_cache where surface='weekly_summary'` after the cron fires | Row with `body LIKE 'Weekly summary not yet available%'`, tier='C', model='placeholder' |
| Monthly baseline (Tier-C gated) | Same query, `surface='monthly_baseline'` | Same shape, `month_label` in audit_log |
| Doctor-prep paywall (free) | Free user taps "Share with doctor" | EF returns `{ status: 'paywall_required' }`; mobile surfaces existing Sprint 10a paywall |
| Quota count | Send 3 questions in Ask Leiko + open Home (Plus + novel) | `count = 4` in Settings → AI Quota |
| Learned-time engine | Run `detectReadingHabit(recentReadings)` in dev console | `hasHabit=true`, `habitualTimeMin=NNN` |
| Voice rules | Spot-check 5 generated narrations | No "patient" / "diagnose" / exclamation points; sentence-case only |

To enable real Tier-C in dev: `supabase secrets set AI_TIER_C_PROD_DATA_ENABLED=true`. To enable real reading-data forwarding to Anthropic in dev: `AI_TIER_B_PROD_DATA_ENABLED=true` (BAA gate per D7 §14).
