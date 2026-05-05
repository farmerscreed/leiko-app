# 08 — Learn Module

CANONICAL for Sprints 13–14. Three surfaces (A/B/C), taxonomy, 30 launch cards. Sourced from D9 §1–6.

> **Strategic position**: Education is FREE (no paywall on Learn cards), FIRST-class (self-buyer tab bar slot), LOCALISED (English MVP, Yoruba/Igbo/Hausa v1.1), REVIEWED (clinical advisor sign-off blocks card publish), VERSIONED (per-card version + last-reviewed date).

---

## 1. Six editorial principles (D9 §2.1)

Non-negotiable. Every card must satisfy every principle.

1. **Plain language above clinical accuracy where they conflict.** Explain "diastolic" once; use "the lower number" elsewhere.
2. **Cite the source, every time.** AHA/ACC 2017, NICE NG136, ESC/ESH 2018, WHO 2023. Every numeric fact has a citation in metadata; sources appear in a footer at the bottom of each card.
3. **Observation, never prescription.** Replace *"you should reduce salt"* with *"people who reduce salt sometimes see lower readings"*.
4. **Calm, never alarming.** No fear hooks. Open with what the reader is here to learn.
5. **Cultural specificity over generic universalism.** Use jollof, ofada, egusi, plantain — not kale and quinoa — for the Nigerian reader.
6. **Honesty about uncertainty.** Where evidence is mixed, say so plainly.

### The prescription trap (D9 §2.3)
The slope is gradual: "research shows" → "many people…" → "you might want to…" → "we recommend…" → "you should…". Hard rules:

- **Third person + past tense for evidence**: "A 2022 study of 5,000 adults found that those who reduced their daily salt intake by 4g saw average systolic BP drop by 5 mmHg over 4 weeks."
- **Second-person observation for the user**: "Your readings will tell you what is true for you."
- **Never** second-person prescription: "You should reduce your salt intake." — this is the line.
- Always end actionable cards with: *"Talk to your doctor about what is right for you."*

---

## 2. Forbidden phrasing (D9 §2.2)

Extends `docs/05-voice-and-claims.md`. Copy-lint over `apps/mobile/src/learn/cards/` enforces these as hard fails.

| Phrase / pattern | Replace with |
| --- | --- |
| "You should…" / "you must…" | "People often…" / "Some people find…" / "Research suggests…" |
| "Diagnoses" / "predicts" / "treats" / "cures" | "Helps you understand" / "shows you patterns" |
| "Medical-grade" / "clinical-grade" SpO2 etc. | "Wellness" / "for general awareness" |
| "Continuous monitoring" of BP | "Take a reading whenever you want" |
| "Normal" without qualifier | "Within the normal range" / "in range" |
| Symptom lists (heart attack / stroke warning signs) | Link to local emergency services; do not list symptoms inline |
| Drug or supplement names | "Your prescribed medication" generically |
| Numerical health goals ("aim for under 130/80") | "Your doctor will help you choose a target that's right for you." |

---

## 3. Card format constraints (D9 §2.4)

| Constraint | Value | Reason |
| --- | --- | --- |
| Length | 300–500 words | Long enough to teach; short enough to read in one sitting |
| Reading level | Grade 7–8 Flesch-Kincaid. Hard cap Grade 10. | Older parent users; non-native English speakers |
| Headings | One H1 (card title), max 3 H2 sub-sections | Scannable. No nested sub-sections. |
| Lists | Bullets for enumerable items only; never dominant format | Bullets fragment context |
| Numerics | Always show units + verbal anchor ("about 30%, or 1 in 3 adults") | Older readers, varied numerical literacy |
| Images | Optional 240×180pt illustration at top; soft cream/amber palette | Honour, not requirement |
| Sources | Mandatory footer: 2–4 citations | Trust |
| Last reviewed | Mandatory footer date | Quarterly review surface |

---

## 4. Three surfaces

### Surface A — Learn tab destination (Sprint 13)
Index of cards organised by category. Featured card row at top, category sections below, search at the top. See D9 §4.1 for layout. Empty search state: *"No cards match '{query}'. Try a different word, or browse the categories below."*

### Surface B — Inline Explainer Sheet (Sprint 13)
Bottom sheet (NOT navigation push) so the user keeps the reading visible above. Triggered by *"What does this mean?"* on Reading Detail or Hero Reading Card.

| Field | Value |
| --- | --- |
| Component | D8 §3.7 Bottom Sheet variant |
| Initial height | 60% of screen; expandable to 90% by drag |
| Header | Range interpretation, e.g. "Your reading is in Stage 1." |
| Sub-header | Numeric anchor: "128/82 — systolic in the 130–139 range." |
| Body | 60–100 word interpretation drawn from the matched range card |
| Cards block | Up to 2 related Learn cards (horizontal scroll) |
| Footer CTA | "Read more in Learn" → Learn tab |
| Footer disclaimer | "This is general information, not medical advice. Talk to your doctor about what is right for you." |

### Surface C — Home-seeded card (Sprint 14)
A small "Worth a read" card surfaced on the home dashboard, selected by the day-by-day onboarding sequence (§5 Seeded Onboarding) or by a contextual selection algorithm post-onboarding.

---

## 5. Content taxonomy (D9 §3)

Six categories at MVP. Total **30 launch cards**.

| Code | Display name | Cards | Description |
| --- | --- | --- | --- |
| NUMBERS | Understanding your numbers | 8 | BP fundamentals: systolic/diastolic, ranges, what each tier means |
| CHANGES | Why blood pressure changes | 6 | Morning surge, post-meal, post-exercise, white-coat, stress, dehydration |
| OTHER | Other numbers on your watch | 4 | HR context, SpO2 (with wellness caveats), sleep proxy, steps |
| DAILY | Daily life and BP | 6 | Salt, sleep, alcohol, caffeine, exercise, stress — observation-only |
| CULTURAL | In your kitchen | 3 | Jollof + stew, palm oil, herbal remedies + medication interactions |
| DOCTOR | Conversations with your doctor | 3 | What to bring, questions to ask, sharing your trends |

### Card tagging schema (MDX frontmatter)
```yaml
---
id: numbers-001
title: "What is blood pressure?"
category: NUMBERS
audience: [self_buyer, caregiver]      # who this card is shown to
mode_relevance: [self, caregiver, hybrid]
reading_context:                        # auto-surfaced for these BP ranges
  systolic_min: 0
  systolic_max: 999
  diastolic_min: 0
  diastolic_max: 999
inline_explainer_priority: 1            # 1 = always candidate; 5 = only when no better card
related_cards: [numbers-002, numbers-003]
sources:
  - "AHA/ACC 2017 Hypertension Guideline (Whelton et al)"
  - "WHO Global Report on Hypertension 2023"
last_reviewed: 2026-05-15
reviewed_by: "[Clinical Advisor Name TBD]"
locale_status:
  en: complete
  yo: pending
  ig: pending
  ha: pending
---
```

---

## 6. Reading-context mapping (D9 §3.3)

When a user taps "What does this mean?" on Reading Detail, the system filters cards by `reading_context` overlap.

| Reading range (AHA/ACC 2017) | Tier 1 (always) | Tier 2 (range-specific) | Tier 3 (urgency) |
| --- | --- | --- | --- |
| Normal: <120 / <80 | numbers-001 | changes-001, daily-001 | none |
| Elevated: 120–129 / <80 | numbers-001 | numbers-002, changes-002 | none |
| Stage 1: 130–139 / 80–89 | numbers-001 | numbers-003, daily-002, doctor-001 | none |
| Stage 2: ≥140 / ≥90 | numbers-001 | numbers-004, doctor-001, doctor-002 | numbers-006 |
| Crisis: ≥180 / ≥120 | numbers-006 | doctor-001 | numbers-007 |

### Card-selection algorithm (deterministic, client-side)
```ts
function selectInlineExplainerCards(reading: Reading, allCards: Card[]): Card[] {
  const tier = readingTier(reading);  // 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis'
  const candidates = allCards.filter(c => rangeOverlaps(c.reading_context, reading));

  if (tier === 'crisis' || tier === 'stage2') {
    const tier3 = candidates.filter(c => isTier3Card(c, tier)).slice(0, 1);
    const tier2 = candidates.filter(c => isTier2Card(c, tier)).slice(0, 1);
    return [...tier3, ...tier2].slice(0, 2);
  }

  const tier1 = candidates.filter(c => c.inline_explainer_priority === 1).slice(0, 1);
  const tier2 = candidates.filter(c => isTier2Card(c, tier)).slice(0, 1);
  return [...tier1, ...tier2].slice(0, 2);
}
```

---

## 7. Seeded onboarding (D9 §5) — Sprint 14

### First-reading trigger
- On the FIRST reading (any source), Reading Detail opens with the Inline Explainer **pre-expanded**.
- Always includes `numbers-001` ("What is blood pressure?") regardless of tier.
- Sub-text: "First reading — here's what these numbers mean."
- User can dismiss; flag stored in MMKV so it never auto-expands again.

### Day-3, Day-7, Day-14 surfaces

| Day | Card surfaced (push) | Reasoning |
| --- | --- | --- |
| Day 3 | `changes-001` ("Why morning BP is higher") | User has 3–6 readings, often noticing morning surge |
| Day 7 | `numbers-002` ("What 'elevated' means") OR appropriate tier card based on recent readings | End of first week; trends visible |
| Day 14 | `doctor-001` ("Sharing your readings with your doctor") | Mid-month; sets expectation that data supports clinical conversations |

- All push triggers respect quiet hours (`docs/11-push-notifications.md`) and category preferences.
- Push body: *"Worth a quick read: '{cardTitle}' — 3 minutes."*
- Telemetry: open rate, time-on-card, scroll-completion → informs which cards rotate in v1.1.

### Anomaly-linked surfaces
When the anomaly engine flags Calm-Concerned or Confirmed-Urgent (`docs/10-anomaly-logic.md`), the home anomaly banner ALWAYS includes a *"Why does this happen?"* link.

| Anomaly | Linked card |
| --- | --- |
| Calm-Concerned: 3 of 5 readings elevated | `numbers-002` + `changes-002` |
| Calm-Concerned: missed readings 3+ days | `numbers-001` |
| Confirmed-Urgent: Stage 2 sustained | `numbers-004` + `doctor-002` |
| Confirmed-Urgent: Crisis (≥180/120) | `numbers-007` + `doctor-002` |

---

## 8. Default home order (D9 §3.4)
1. **Featured row at top**: `numbers-001` — the one card every user reads first.
2. Sections by category: NUMBERS → CHANGES → OTHER → DAILY → CULTURAL → DOCTOR.
3. Within a category, ordered by `id` (numerically) — the editorial team chooses the id sequence intentionally for progressive learning.
4. "More coming soon" footer card sets expectation that the library grows quarterly.

---

## 9. Article inventory (D9 §6)

30 launch cards across 6 categories. Each card is specified in D9 §6 as title + audience + reading-context + outline + sources + clinical-advisor notes. The full inventory lives in `docs/_reference/D9-editorial.md`. Article copy itself lives in `apps/mobile/src/learn/articles/{id}.mdx`.

> **Cards do NOT publish until clinical advisor signs off** (Q5 in D7 §14). The clinical advisor hire is a hard external dependency for any production-bound Cluster A content.

---

## 10. Localisation pipeline (D9 §8)

| Locale | Phase |
| --- | --- |
| English (en) | MVP |
| Yoruba (yo) | v1.1 (Q3 2026) |
| Igbo (ig) | v1.1 |
| Hausa (ha) | v1.1 |
| French (fr) | v1.2 |
| Swahili (sw) | v1.2 |

See `docs/12-localisation.md` for the full pipeline + quality gates.

**Never auto-translate at runtime via machine translation.** Editorial gates exist for a reason. Fallback to English with a banner: *"This card is not yet available in {locale_name}. Showing the English version."*

---

## 11. MDX component mapping (D9 §4.2.1)

Body content is authored in MDX. Renderer mappings:

| MDX element | Renders as |
| --- | --- |
| `# H1` | (reserved — used by card title only, never in body) |
| `## H2` | `type.title`, `color.text.primary`, `spacing.xl` above and `spacing.m` below |
| `### H3` | **NOT ALLOWED in card body** — lint fails commit |
| Paragraph | `type.body-l` (or parent large-text variant) |
| `**bold**` | `fontWeight: 600`, same color |
| `*italic*` | italic — reserved for definitions and source titles |
| Bullet list | D8 numbering bullets, each item `type.body-l` |
| Numbered list | Sequential 1., 2., 3. |
| `` `inline code` `` | JetBrainsMono, `type.body-m` size — only for technical units like `mmHg` |
| Block quote (`>`) | Left border 4pt `color.brand.accent`, padding `spacing.l`, italic body — used sparingly for source quotes |
| `<Definition term="word">explanation</Definition>` | Underlined dotted in body; tap shows tooltip |
| `<CardLink id="numbers-002" />` | Inline mini-card link to another Learn card |
| `<Reading sys={120} dia={80} />` | Sample BP reading visualisation inline at `type.numeric-l` |
| `<Source>...</Source>` | Adds an entry to the sources footer |

---

## 12. Out of scope (defer or escalate)
- External hyperlinks from card body — return in v1.2 with a warn-on-leave sheet.
- User-generated annotations on cards — out of scope.
- AI-generated card summaries — separate from cards; weekly summary handled in `docs/07-ai-assistant.md` Tier C.
