# Sprint 13 — Learn Surface A + B (Multi-Vital)

## Goal
The dedicated Learn section (Surface A: cluster grid in Settings) and the inline explainer (Surface B: bottom sheet from Reading Detail anchors). All P0 articles ship with this sprint as MDX in the bundle. **Library expanded to ~30 articles** covering BP + HR + SpO2 + Sleep + Activity + Correlations per D14 §10.1.

## Duration
~1 work-week.

## Hard dependencies
Sprint 6 (anchors exist as no-ops). Sprint 8.5 (vital detail screens have anchor sites).

## Docs to load
docs/_reference/D14-ambient-ai-architecture.md (§10), docs/08-learn-module.md, docs/03-components/bottom-sheet.md, docs/_reference/D12-visual-system-v2.md.

## Deliverables
- `apps/mobile/src/learn/articles/` — MDX files for P0 articles per D14 §10.1:
  - **BP cluster**: numbers-001 → numbers-008, changes-* (existing scope)
  - **HR cluster**: hr-001 (resting HR) · hr-002 (what changes resting HR) · hr-003 (when to talk to your doctor about HR)
  - **SpO2 cluster**: spo2-001 (what SpO2 means) · spo2-002 (overnight dips) · spo2-003 (what to share with doctor)
  - **Sleep cluster**: sleep-001 (sleep stages) · sleep-002 (what affects score) · sleep-003 (sleep × BP)
  - **Activity cluster**: activity-001 (steps × BP) · activity-002 (sustainable goals)
  - **Correlations cluster**: corr-001 (sleep ↔ morning BP) · corr-002 (activity ↔ resting HR) · corr-003 (reading patterns over weeks)
  - **Doctor cluster**: doctor-001 + variants
- Surface A screens: `LearnHome` (cluster grid), `LearnCluster` (article list)
- Surface B: `InlineExplainer.tsx` using BottomSheet component
- Anchor wiring on Reading Detail + the new vital detail screens (Sprint 8.5)
- `learn.card.compact`, `cluster.card`, `article.list.row` components per D9 + D12 visual upgrade
- Embeddings for AI card-discovery — `cards_embeddings` table populated per D14 §10

## Acceptance criteria
- All P0 articles render at all 3 reading levels (60s, 3min, deep where applicable) in dark + light
- Anchors on Reading Detail + vital detail screens open the correct article via inline explainer
- Cluster A articles HIDDEN if clinical advisor flag is not set (per D9 Q-D9-6)
- "Read more" expansion grows the bottom sheet correctly
- Voice gate passes on every article — including the new HR/SpO2/Sleep/Activity/Correlation clusters
- SpO2 articles use the most defer-to-doctor framing (closest to clinical signal)
- Embeddings table populated; AI Tier-B can cite cards by ID

## Open prompt
Sprint 13 — Learn Surface A + B Multi-Vital. Read CLAUDE.md, then docs/_reference/D14-ambient-ai-architecture.md (§10), docs/08-learn-module.md.

Propose:

1. MDX rendering strategy in React Native (which library, fallback)
2. Article frontmatter → routing logic
3. Cluster A gate (clinical advisor sign-off check)
4. Article authoring workflow: founder + clinical advisor for clinical content; placeholders for stub articles
5. Embeddings generation for `cards_embeddings` — at-build-time vs nightly job

Wait for approval.

## External dependency
**Q5 (D7 §14)**: Clinical advisor sign-off blocks Cluster A publish, especially for SpO2 articles which are closest to a clinical signal. Other clusters can ship with `clinical-advisor-pending` flag in frontmatter.
