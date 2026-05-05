# Sprint 13 — Learn Surface A + B

## Goal
The dedicated Learn section (Surface A: cluster grid in Settings) and the inline explainer (Surface B: bottom sheet from Reading Detail anchors). All P0 articles ship with this sprint as MDX in the bundle.

## Duration
~1 work-week.

## Hard dependencies
Sprint 6 (anchors exist as no-ops).

## Docs to load
docs/08-learn-module.md, docs/03-components/bottom-sheet.md, docs/02-design-tokens.md.

## Deliverables
- apps/mobile/src/learn/articles/ — MDX files for the P0 articles (numbers-001 → numbers-008, plus the Tier-1 cards in changes / doctor)
- Surface A screens: LearnHome (cluster grid), LearnCluster (article list)
- Surface B: InlineExplainer.tsx using BottomSheet component
- Anchor wiring on Reading Detail (the no-ops from Sprint 6 now open the explainer)
- learn.card.compact, cluster.card, article.list.row components per D9

## Acceptance criteria
- All P0 articles render at all 3 reading levels (60s, 3min, deep where applicable)
- Anchors on Reading Detail open the correct article via inline explainer
- Cluster A articles are HIDDEN if clinical advisor flag is not set (per D9 Q-D9-6)
- "Read more" expansion grows the bottom sheet correctly
- Voice gate passes on every article

## Open prompt
Sprint 13 — Learn Surface A + B. Read CLAUDE.md, then docs/08-learn-module.md.

Propose:

1. MDX rendering strategy in React Native (which library, fallback)
2. Article frontmatter → routing logic
3. Cluster A gate (clinical advisor sign-off check)
4. Article authoring workflow: where do the P0 articles come from? (Founder writes, clinical advisor signs off, you stub them with placeholder text in this sprint; final copy lands later)

Wait for approval.

## External dependency
**Q5 (D7 §14)**: Clinical advisor sign-off blocks Cluster A publish. Cluster B and C articles can ship without — flag clinical-advisor-pending in frontmatter.
