# Sprint 9 — Trends + PDF Export

## Goal
Trends screen with range chips (week / month / 3-month / all-time per D8a §8), summary stats (average, % in range, anomaly count), and a doctor-ready PDF export. PDF export is a paywall lever for self-buyers per D8a §9.

## Duration
~1 work-week.

## Hard dependencies
Sprint 6.

## Docs to load
docs/04-screens/trends.md, docs/03-components/pill.md, docs/01-data-model.md, docs/09-paywall-and-iap.md.

## Deliverables
- Trends.tsx with range chips, line chart, summary stat tiles
- PDF generation — Supabase Edge Function (server-side rendering preferred over on-device)
- Export flow: trigger → paywall check → generate → share sheet

## Acceptance criteria
- All 4 ranges display correctly
- Summary stats compute correctly against test data
- Stat tiles tap targets are 48pt+ (per inline-explainer integration in Sprint 13)
- PDF export for free users prompts the paywall (placeholder paywall UI OK; real paywall in Sprint 10)
- PDF includes: user info, date range, all readings, summary stats, doctor-ready disclaimer
- PDF cover line passes voice gate ("This report is general information from {parent_name}'s Leiko watch. It is not a diagnosis. Please discuss with their doctor.")

## Open prompt
Sprint 9 — Trends + PDF Export. Read CLAUDE.md, then docs/04-screens/trends.md, docs/09-paywall-and-iap.md.

Propose:

1. Chart library (must work offline-first — client-side rendering — per docs/00-tech-stack.md Victory Native XL is locked)
2. PDF generation: server-side via Edge Function vs on-device
3. Paywall placeholder strategy until Sprint 10
4. Caching strategy for the summary stats (recompute or store)

Wait for approval.
