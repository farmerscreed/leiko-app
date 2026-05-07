# Sprint 9 — Trends + Multi-Vital PDF Export

## Goal
Trends screen with multi-vital chart, range toggles (7d / 30d / 90d / 1y per D13 §10.1), correlation cards (up to 3 meaningful per D13 §9), Tier-C weekly summary card when available, and a multi-vital doctor-ready PDF export per D13 §10.2. PDF export is Plus-only paywall lever per D8a §9.

## Duration
~1.5 work-weeks.

## Hard dependencies
Sprint 7.5 (multi-vital data). Sprint 7.6 (CorrelationStrip). Sprint 8 (Self-Buyer Home wired). Sprint 8.5 (vital detail screens for tap-through).

## Docs to load
docs/_reference/D13-multi-vitals-constellation-spec.md (§10, §9), docs/04-screens/trends.md (will be rewritten), docs/_reference/D11-brand-repositioning.md (§3.6 voice for clinical PDF), docs/09-paywall-and-iap.md.

## Deliverables
- `Trends.tsx` rewritten per D13 §10.1:
  - Range selector (7d / 30d / 90d / 1y)
  - Multi-vital line chart with vital toggle row (default: BP + HR + Sleep visible; SpO2 + Activity off)
  - Up to 3 meaningful-correlation cards
  - Weekly summary card (when Tier-C generated — placeholder until Sprint 12.5)
  - Export button → "Share with your doctor" PDF preview
- Cross-vital correlation engine per D13 §9.2:
  - `correlations` table migration
  - Edge Function `compute-correlations` running nightly per family at 03:00 family-local-time
  - Statistical rules per D13 §9.3 (Pearson r ≥ 0.3, p < 0.05, n ≥ 14)
  - `is_meaningful` gating
- Multi-vital PDF generation per D13 §10.2:
  - Edge Function generating server-side PDF (clinical-but-premium typesetting)
  - All 7 sections per spec: cover, BP report, HR report, SpO2 report, Sleep report, Activity report, cross-vital observations, notes
- Export flow: trigger → paywall check → generate → share sheet
- New screen spec: `docs/04-screens/trends.md` rewritten
- New doc: `docs/15-correlation-engine.md`

## Acceptance criteria
- All 4 ranges display correctly with multi-vital chart
- Vital toggle hides/shows series live without re-fetch
- Correlation cards appear only when `is_meaningful = true` (Pearson r ≥ 0.3, p < 0.05, n ≥ 14)
- Synthetic test data with strong sleep × morning BP correlation produces a meaningful correlation card
- Synthetic test data with weak correlation does NOT produce a card
- PDF for free users prompts the paywall
- PDF includes all 7 sections, all in Leiko-premium typesetting (not generic CSV-dump)
- PDF cover line + observations passes voice gate (clinical-tone permitted; no diagnostic language)
- Correlation engine cron fires correctly across timezones (test against a Lagos parent and a US caregiver in same family)

## Open prompt
Sprint 9 — Trends + Multi-Vital PDF Export. Read CLAUDE.md, then docs/_reference/D13-multi-vitals-constellation-spec.md (§9, §10).

Propose:

1. Multi-vital chart library — Victory Native XL multi-series + multi-axis configuration
2. Correlation engine implementation — pure SQL window functions vs Postgres pl/pgsql vs Edge Function compute
3. PDF generation library — react-pdf via Edge Function vs Puppeteer headless
4. Caching strategy for the trends summary stats (recompute or store)
5. Migration timing for the `correlations` table (this sprint adds it)

Wait for approval.

## Risk notes
- Three correlations only at v1.0 per D13 §9.1 — do not generalise to a generic correlation explorer. Restraint matters.
- The PDF is a brand surface. Cheaping out on layout costs sales — premium typesetting is the standard.
- Correlation cron timezone correctness is non-trivial; family members can be in different timezones.

## External dependencies
- Sprint 12.5 generates the weekly summary; until then, weekly summary card on Trends is a static placeholder.
- Sprint 12.5 generates PDF cross-vital observations narrative; until then, that section uses a deterministic template.

## What this sprint explicitly does NOT ship
- Apple Health / Health Connect bridge (Sprint 9.5)
- Real-time correlation recompute on every reading (nightly is enough for v1.0)
- Generic correlation explorer (deferred to v1.1+)
