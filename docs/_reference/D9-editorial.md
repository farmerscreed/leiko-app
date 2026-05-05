D9  —  Learn / Education Module Specification

**D9**

**Learn / Education Module**

Specification — Kena Caregiver BP Monitoring App

**Version 1.0**

Status: Draft for Implementation — Pending Clinical Advisor Review

Prepared for: LawOne Cloud LLC

Date: May 2026

*Confidential*

*This document specifies the Learn module: editorial principles, content taxonomy, component specifications, the launch card inventory, AI fallback logic, localisation pipeline, and editorial review process. All content herein must pass clinical advisor review before public release.*


# **Document Metadata**

|**Field**|**Value**|
| :- | :- |
|Document|D9 — Learn / Education Module Specification|
|Version|1\.0|
|Status|Draft for Implementation — Pending Clinical Advisor Review|
|Owner|Founder / Editorial Lead|
|Audience|Designers, mobile engineers, content writers, clinical advisor, QA, localisation team|
|Source documents|D5 §3, D6 JTBD-8 + US-59–66, D7 §4 (AI), D8 v1.0, D8a v1.0|
|Implementation target|React Native (Expo bare); content stored as MDX in /apps/mobile/src/learn/cards/|
|Theme support|Light only at MVP (inherits D8 §8)|
|Locale support|English at MVP; Yoruba / Igbo / Hausa scheduled for v1.1; French / Swahili v1.2|
|Last updated|May 2026|


## **Reading Order**
Sections §1–§2 establish editorial principles. Section §3 specifies the technical components. Section §4 lists the launch content inventory. Sections §5–§7 cover AI fallback, localisation and editorial workflow. §8–§9 cover open questions and changelog. Implementation can start with §3 in parallel with §4 content drafting; nothing ships to users until clinical advisor review (Q5 in D7 §14) closes.


# **1. Why Learn Matters**
"What does this number mean?" is the most-asked question by every person who has held the watch in their hands. Founder direct observation, multiple subjects, repeated. It is the single most predictive question for whether a user keeps using the product past month two: people who do not understand their data stop opening the app.

D6 JTBD-8 makes this explicit: "I just got told I have hypertension. I want to actually understand what is happening to my body." This job is shared across personas. Caregivers face a parallel version: "Mum just had a higher reading than usual — should I be worried?" Both jobs are answered by the same content surface, framed slightly differently.

D5 §3.5 names "Informative" as one of three voice tones. The Learn module is where that tone lives full-time. Other tones (Reassuring, Calm-Concerned) appear contextually on Home and Reading Detail; Informative is the default for everything in Learn.
## **1.1 What This Module Is Not**
- A medical reference. We are not WebMD. We do not list symptoms, differential diagnoses, or treatment options. Anything that strays into that territory is rewritten or cut.
- A behaviour-change program. We do not coach the user to lose weight, stop drinking, or take their medication on schedule. We provide context. The user makes choices.
- A blog. Cards are evergreen, fact-anchored, and short — not opinion pieces, not news, not marketing.
- A path to a sale. Learn is fully unlocked at the free tier (per D5 §3.4 — "no paywall on basic readings" — we extend that principle to education). Subscription unlocks AI summaries, longer trends, and shareable reports; education itself is free.


## **1.2 Strategic Position**

|**Decision**|**Implication**|
| :- | :- |
|Education is FREE|No paywall on any Learn card. Builds trust, reduces uninstalls, raises subscription conversion downstream.|
|Education is FIRST-class|Self-buyer tab bar slot (D8a §4.3); inline explainer prominent on every Reading Detail screen; v1.1 promotion to caregiver tab bar.|
|Education is LOCALISED|English at MVP. Yoruba / Igbo / Hausa for v1.1 (parent-side critical). Cultural cards (jollof, palm oil, herbal remedies) ship at MVP in English with Nigeria-relevant framing.|
|Education is REVIEWED|Every card requires clinical advisor sign-off before publishing (Q5 in D7 §14 — hire blocks card 1 release).|
|Education is VERSIONED|Each card has a version, last-reviewed date, and source list. Outdated cards trigger a quarterly review.|


# **2. Editorial Principles**
These are non-negotiable. Every card in §6 must satisfy every principle. A card that violates one is rejected by review, regardless of how engaging it reads.
## **2.1 The Six Principles**

|**#**|**Principle**|**Practical implication**|
| :- | :- | :- |
|1|Plain language above clinical accuracy where they conflict.|If "diastolic" needs explaining in every card, explain it once and use "the lower number" elsewhere. Do not show off vocabulary.|
|2|Cite the source, every time.|AHA/ACC 2017, NICE NG136, ESC/ESH 2018, WHO global hypertension report. Every numeric fact has a citation in the card metadata; the citation appears in a "Sources" footer at the bottom of each card.|
|3|Observation, never prescription.|NEVER recommend a specific food / drink / exercise / medication. Replace "you should reduce salt" with "people who reduce salt sometimes see lower readings". This is the hardest principle to enforce — see §2.3 below.|
|4|Calm, never alarming.|Never start a card with a fear hook ("Did you know hypertension kills 10 million people a year?"). Open with what the reader is here to learn.|
|5|Cultural specificity over generic universalism.|A card on diet that uses "kale and quinoa" as examples does not connect with a Nigerian reader. Use jollof, ofada, egusi, plantain. List Western foods only where they are commonly available locally.|
|6|Honesty about uncertainty.|Where evidence is mixed (e.g., coffee), say so plainly: "Research is mixed. Some studies show coffee raises BP for an hour or two; others show no effect over time. Watch your own readings to see what is true for you."|


## **2.2 Forbidden Phrasing in Learn Cards**
Extends D5 §6.4 and D8 §6.1 with Learn-specific additions. Copy-lint on /apps/mobile/src/learn/cards/ enforces these as hard fails.

|**Phrase / pattern**|**Reason**|**Replace with**|
| :- | :- | :- |
|"You should…" / "you must…"|Prescriptive|"People often…" / "Some people find…" / "Research suggests…"|
|"Diagnoses" / "predicts" / "treats" / "cures"|Outside cleared IFU; medical claim|"Helps you understand" / "shows you patterns"|
|"Medical-grade" / "clinical-grade" SpO2 etc.|Outside K141683 IFU|"Wellness" / "for general awareness"|
|"Continuous monitoring" of BP|Misleading — it is on-demand|"Take a reading whenever you want"|
|"Normal" without qualifier|Stigmatises elevated readings|"Within the normal range" / "in range"|
|Symptom lists (heart attack, stroke warning signs)|Triage territory; 911/999 territory|Link to local emergency services info; do not list symptoms inline|
|Drug or supplement names|Recommendation territory|Refer to "your prescribed medication" generically|
|Numerical health goals ("aim for under 130/80")|Goal-setting; can mask comorbidities|Defer to clinician: "Your doctor will help you choose a target that’s right for you."|


## **2.3 The Prescription Trap (the hardest editorial line)**
The single most common failure mode in health education content is sliding from observation into prescription. The slope is gradual: "research shows" → "many people…" → "you might want to…" → "we recommend…" → "you should…". By card 30, the writer has drifted across the line without noticing.

Hard rules to keep cards on the safe side of the line:

- Use the third person and the past tense for evidence: "A 2022 study of 5,000 adults found that those who reduced their daily salt intake by 4g saw average systolic BP drop by 5 mmHg over 4 weeks."
- Use second-person observation for the user: "Your readings will tell you what is true for you. If you make a change, watch the trend."
- NEVER use second-person prescription: "You should reduce your salt intake." This is the line.
- Always end actionable cards with: "Talk to your doctor about what is right for you." — the universal escape valve that places agency back with the clinician.


## **2.4 Card Format Constraints**

|**Constraint**|**Value**|**Reason**|
| :- | :- | :- |
|Length|300–500 words per card|Long enough to teach; short enough to read in one sitting on a phone screen|
|Reading level|Aim for Grade 7–8 (Flesch-Kincaid). Hard cap Grade 10.|Older parent users; non-native English speakers; medically anxious states reduce comprehension|
|Headings|One H1 (card title), maximum 3 H2 sub-sections per card|Scannable. No nested sub-sections.|
|Lists|Bullets allowed for enumerable items; never as the dominant format. Prose first.|Bullets fragment context|
|Numerics|Always show units (mmHg, beats/minute, mg/day). Always paired with a verbal anchor ("about 30%, or 1 in 3 adults")|Older readers; numerical literacy varies|
|Images|Optional 240x180pt illustration at top of card; soft cream/amber palette per D8 §5.3|Illustration is honour, not requirement — don’t pad cards with stock imagery|
|Sources|Mandatory footer: 2–4 citations, in the form "AHA/ACC 2017 (Whelton et al), NICE NG136"|Trust building|
|Last reviewed|Mandatory footer date|Quarterly review surface|


# **3. Content Taxonomy**
Cards are tagged with category, audience, mode-relevance, reading-context (which BP ranges trigger this card as a recommended explainer), and source set. The taxonomy enables the inline explainer (D8a §5.3) to surface the right cards at the right moments.
## **3.1 Categories (six at MVP)**

|**Category code**|**Display name**|**Card count at MVP**|**Description**|
| :- | :- | :- | :- |
|NUMBERS|Understanding your numbers|8|BP fundamentals: what systolic/diastolic mean, ranges, what each tier means|
|CHANGES|Why blood pressure changes|6|Morning surge, post-meal, post-exercise, white-coat, stress, dehydration|
|OTHER|Other numbers on your watch|4|Heart rate context, SpO2 with caveats, sleep proxy, steps|
|DAILY|Daily life and BP|6|Salt, sleep, alcohol, caffeine, exercise, stress — observation-only|
|CULTURAL|In your kitchen|3|Nigerian and West African food specifics: jollof and stew, palm oil, herbal remedies + medication interactions|
|DOCTOR|Conversations with your doctor|3|What to bring, questions to ask, sharing your trends|



Total launch cards: 30. New cards added in v1.1 and quarterly thereafter, governed by clinical advisor review.
## **3.2 Card Tagging Schema**
\# learn-card-frontmatter (MDX)

\---

id: numbers-001

title: "What is blood pressure?"

category: NUMBERS

audience: [self\_buyer, caregiver]   # who this card is shown to

mode\_relevance: [self, caregiver, hybrid]

reading\_context:                     # auto-surfaced for these BP ranges

`  `systolic\_min: 0

`  `systolic\_max: 999

`  `diastolic\_min: 0

`  `diastolic\_max: 999

inline\_explainer\_priority: 1         # 1 = always candidate; 5 = only when no better card

related\_cards: [numbers-002, numbers-003]

sources:

`  `- "AHA/ACC 2017 Hypertension Guideline (Whelton et al)"

`  `- "WHO Global Report on Hypertension 2023"

last\_reviewed: 2026-05-15

reviewed\_by: "[Clinical Advisor Name TBD]"

locale\_status:

`  `en: complete

`  `yo: pending

`  `ig: pending

`  `ha: pending

\---


## **3.3 Reading-Context Mapping (for Inline Explainer)**
When a user taps "What does this mean?" on a Reading Detail (D8a §5.3), the system filters Learn cards by reading\_context overlap with the tapped reading. Tier 1 (always shown), Tier 2 (shown if relevant range), Tier 3 (escalation — anomaly contexts only).

|**Reading range (AHA/ACC 2017)**|**Tier 1 cards (always)**|**Tier 2 cards (range-specific)**|**Tier 3 cards (urgency)**|
| :- | :- | :- | :- |
|Normal: <120 / <80|numbers-001 (What is BP?)|changes-001 (Morning surge), daily-001 (Salt)|none|
|Elevated: 120–129 / <80|numbers-001|numbers-002 (What "elevated" means), changes-002 (Stress and BP)|none|
|Stage 1: 130–139 / 80–89|numbers-001|numbers-003 (Stage 1), daily-002 (Sleep), doctor-001 (When to talk to doctor)|none|
|Stage 2: ≥140 / ≥90|numbers-001|numbers-004 (Stage 2), doctor-001, doctor-002 (Questions to ask)|numbers-006 (When BP is concerning)|
|Crisis: ≥180 / ≥120|numbers-006 (When BP is concerning)|doctor-001|numbers-007 (Hypertensive urgency vs emergency — when to seek care)|


## **3.4 Default Card Order on Learn Module Home**
When the user opens the Learn tab, cards are ordered to surface progressively useful content for someone who has just started using Kena.

- Featured row at top: numbers-001 ("What is blood pressure?") — the one card every user reads first
- Section by category, in the order: NUMBERS → CHANGES → OTHER → DAILY → CULTURAL → DOCTOR
- Within a category, cards are ordered by id (numerically) — the editorial team chooses the id sequence intentionally for progressive learning
- A small "More coming soon" card at the bottom of the home view sets expectation that the library grows quarterly


# **4. Component Specifications**
Three new screens and one new component are introduced for the Learn module. All consume D8 design tokens unchanged — no new colors, no new typography sizes.
## **4.1 Learn Module Home (the tab destination)**

|**Field**|**Value**|
| :- | :- |
|Audience|Both — self-buyer (tab bar position 3 at MVP); caregiver (Settings entry at MVP, tab bar position 3 from v1.1)|
|Purpose|Index of Learn cards, organised by category, with a featured top card|
|Components|Header (type.headline "Learn"); featured card row (1 card, full-width, larger); category sections (each with H2 title + horizontal scroll of card thumbnails); search input at the top (input.search variant); "More coming soon" footer|
|Search behaviour|Filters across card titles AND body content; case-insensitive; results show as a vertical list grouped by category|
|Empty search state|"No cards match “{{query}}”. Try a different word, or browse the categories below."|


### **4.1.1 Featured Card Row**
- Container: full-width, color.surface.subtle (taupe), radius.l, padding spacing.2xl, NO image at MVP (illustrations come in v1.1)
- Pill above title: type.caption Bold, color.brand.primary-soft, copy: "Start here"
- Title: type.title (max 2 lines)
- Body teaser: type.body-m, max 3 lines, ellipsis truncation
- Tap target: entire container; opens Card Detail (§4.2)


### **4.1.2 Category Section**
- Section header row: H2 title (type.title) + count chip ("8 cards", chip.outline)
- Horizontal scroll, paged at card width, card width = 280pt at standard density (auto-recalculates per Dynamic Type)
- Each thumbnail: container 280x140pt, color.surface.subtle, radius.m, padding spacing.l. Title (type.title, max 2 lines), tag ("3 min read", type.caption, muted)
- Trailing chevron-card-style "See all" affordance at end of horizontal scroll — takes user to a vertical category list


## **4.2 Card Detail Screen (the actual Learn content)**

|**Field**|**Value**|
| :- | :- |
|Audience|Both|
|Purpose|Render a single Learn card from MDX, in a clean reading layout|
|Layout|Standard scrollable screen, max content width 600pt for readability on tablets, screen edge padding spacing.2xl on mobile|
|Components (top to bottom)|Back chevron + category breadcrumb (e.g., "Numbers"); reading-time chip ("3 min read", chip.outline); card title (type.display-m, color.text.primary); optional 240x180pt illustration; body content (renders MDX with custom components below); related cards row at bottom; sources footer; last-reviewed date|
|Persistent footer|"This is general information, not medical advice. Talk to your doctor about what is right for you." — caption, sticky, color.text.secondary|


### **4.2.1 MDX Component Mapping**
Body content is authored in MDX so editorial team can write naturally. The MDX renderer maps Markdown elements to Kena typography tokens:

|**MDX element**|**Renders as**|
| :- | :- |
|# H1|(reserved — used by card title only, never inside body)|
|## H2|type.title, color.text.primary, spacing.xl above and spacing.m below|
|### H3|NOT ALLOWED in card body — lint fails commit|
|Paragraph|type.body-l (caregiver) or type.body-l in parent large-text profile|
|Bold (\*\*) |fontWeight 600, same color (no color change)|
|Italic (\*)|fontStyle italic, same color (NEVER as emphasis — reserved for definitions and source titles)|
|Bullet list|D8 numbering bullets, each item type.body-l|
|Numbered list|Sequential numbering 1., 2., 3.|
|Inline code (`)|JetBrainsMono, type.body-m size, no background — used only for technical units like `mmHg`|
|Block quote (>)|Left border 4pt color.brand.accent, padding spacing.l, italic body, color.text.primary — used sparingly for source quotes|
|Custom: <Definition term="word">explanation</Definition>|Underlined dotted in body; tap shows tooltip with explanation|
|Custom: <CardLink id="numbers-002" />|Inline mini-card link to another Learn card|
|Custom: <Reading sys={120} dia={80} />|Renders a sample BP reading visualization inline at type.numeric-l|
|Custom: <Source>...</Source>|Adds an entry to the sources footer|


### **4.2.2 Related Cards Row**
- Appears after body content and before sources
- Section header: type.title "More on this"
- Up to 3 related cards (per related\_cards in frontmatter) shown as small horizontal cards
- Tap target: opens that card detail


### **4.2.3 Sources Footer**
- Section header: type.label "Sources", muted color
- Each source on its own line: type.caption, color.text.secondary
- Last-reviewed date below: "Last reviewed: 15 May 2026 by [Clinical Advisor Name]" — type.caption, muted
- NEVER hyperlinks to external pages at MVP — we cite, but we do not send users out of the app. Hyperlinks return in v1.2 with a warn-on-leave sheet.


## **4.3 Inline Explainer Sheet (D8a §5.3 component contract)**
Triggered by "What does this mean?" tap on Reading Detail. Bottom sheet (NOT navigation push) so the user keeps the reading visible above. Specified here in full because this is the highest-traffic surface for Learn content.

|**Field**|**Value**|
| :- | :- |
|Component class|D8 §3.7 Bottom Sheet variant|
|Trigger|Tap on "What does this mean?" link on D8 §4.6 Reading Detail OR on D8a §4.2 Hero Reading Card|
|Sheet height|Initial: 60% of screen; expandable to 90% by drag|
|Header|Title: range interpretation, e.g., "Your reading is in Stage 1." (type.title)|
|Sub-header|Numeric anchor: "128/82 — systolic in the 130–139 range." (type.caption, muted)|
|Primary section|60–100 word interpretation drawn from the matched range card body (rendered as type.body-l)|
|Cards block|Up to 2 related Learn cards as small horizontal cards (D8 §3.13 pill style or thumbnail style — single horizontal scroll)|
|Footer CTA|"Read more in Learn" (button.ghost, navigates to Learn tab)|
|Footer disclaimer|"This is general information, not medical advice. Talk to your doctor about what is right for you." (sticky, type.caption, muted)|


### **4.3.1 Card-Selection Algorithm**
When the inline explainer opens, it must select 1–2 cards to feature. Algorithm (deterministic, runs client-side):

function selectInlineExplainerCards(reading: Reading, allCards: Card[]): Card[] {

`  `const tier = readingTier(reading);  // 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis'

`  `const candidates = allCards.filter(c =>

`    `rangeOverlaps(c.reading\_context, reading)

`  `);

`  `// Tier 3 (urgency) cards take priority for crisis/stage2 readings

`  `if (tier === 'crisis' || tier === 'stage2') {

`    `const tier3 = candidates.filter(c => isTier3Card(c, tier)).slice(0, 1);

`    `const tier2 = candidates.filter(c => isTier2Card(c, tier)).slice(0, 1);

`    `return [...tier3, ...tier2].slice(0, 2);

`  `}

`  `// Tier 1 (always-shown) + best tier 2

`  `const tier1 = candidates.filter(c => c.inline\_explainer\_priority === 1).slice(0, 1);

`  `const tier2 = candidates.filter(c => isTier2Card(c, tier)).slice(0, 1);

`  `return [...tier1, ...tier2].slice(0, 2);

}


### **4.3.2 Range Interpretation Strings**
Inline explainer needs short range-interpretation strings keyed by tier. These are SEPARATE from card body content because they need to be self-contained. Stored in i18n locale file under explainer.range.\*

|**Tier**|**Self-buyer string**|**Caregiver string**|
| :- | :- | :- |
|normal|Your reading is in the normal range.|This reading is in the normal range.|
|elevated|Your reading is at the top of the normal range — sometimes called "elevated".|This reading is at the top of the normal range — sometimes called "elevated".|
|stage1|Your reading is in Stage 1 of the high-blood-pressure scale. It is worth a chat with your doctor at your next visit.|This reading is in Stage 1 of the high-blood-pressure scale. Worth raising at the next doctor visit.|
|stage2|Your reading is in Stage 2 of the high-blood-pressure scale. It is worth talking to a doctor about it.|This reading is in Stage 2 of the high-blood-pressure scale. Worth talking to a doctor.|
|crisis|This reading is in the very-high range. If you also feel chest pain, severe headache, vision changes, or trouble breathing, please seek urgent care now. Otherwise, sit, breathe, and re-take the reading in 5 minutes.|This is in the very-high range. If they feel chest pain, severe headache, vision changes, or trouble breathing, urgent care is needed.|



|<p>**Tier-string review priority**</p><p>These five tier strings (10 with caregiver variants) are the highest-priority strings in the entire app for clinical advisor review. They are read by the user in moments of acute health-data anxiety. A wrong word here erodes trust permanently. The advisor reviews these BEFORE individual card bodies.</p>|
| :- |


# **5. Seeded Onboarding & Card Surfacing**
Cards must be discovered to be useful. The product seeds key cards into the user’s first 30 days so they do not have to find Learn on their own.
## **5.1 First-Reading Trigger**
- When the user takes their FIRST reading (any source), the Reading Detail screen automatically opens with the Inline Explainer pre-expanded
- First-reading explainer ALWAYS includes numbers-001 ("What is blood pressure?") regardless of tier
- Sub-text under the title: "First reading — here’s what these numbers mean."
- User can dismiss; flag stored in MMKV so it never auto-expands again


## **5.2 Day-3, Day-7 and Day-14 Surfaces**

|**Day**|**Card surfaced (push notification)**|**Reasoning**|
| :- | :- | :- |
|Day 3|changes-001 ("Why morning BP is higher")|By day 3, user has 3–6 readings, often noticing morning surge — explanation lands at the right moment|
|Day 7|numbers-002 ("What ‘elevated’ means") OR appropriate tier card based on user’s recent readings|End of first week, trends visible, user wants context|
|Day 14|doctor-001 ("Sharing your readings with your doctor")|Mid-month, sets expectation that this data is meant to support clinical conversations|



- Day-3, Day-7, Day-14 push triggers respect quiet hours (D7 §8) and category preferences
- Push body: "Worth a quick read: “{{cardTitle}}” — 3 minutes."
- Tap opens that specific card in the app
- Telemetry: track open rate, time-on-card, scroll-completion rate; informs which cards rotate in v1.1


## **5.3 Anomaly-Linked Surfaces**
When the system flags a Calm-Concerned or Confirmed-Urgent state (per D6 anomaly logic), the home anomaly banner (D8 §3.4) ALWAYS includes a "Why does this happen?" link to a relevant Learn card.

|**Anomaly**|**Linked card**|
| :- | :- |
|Calm-Concerned: 3 of 5 readings elevated|numbers-002 (What "elevated" means) + changes-002 (Stress and BP)|
|Calm-Concerned: missed readings 3+ days|numbers-001 (What is BP?) + (no extra)|
|Confirmed-Urgent: Stage 2 sustained|numbers-004 (What Stage 2 means) + doctor-002 (Questions to ask)|
|Confirmed-Urgent: Crisis (≥180/120)|numbers-007 (When BP is a real concern) + doctor-002|


# **6. Launch Card Inventory**
30 cards across 6 categories. Each card is specified as title + audience + reading-context + outline + sources + notes for clinical advisor. Editorial team writes 300–500 word body copy from the outline; clinical advisor reviews body copy before publishing. Cards do NOT publish until clinical advisor signs off (Q5 in D7 §14).

|<p>**Read this section like a brief, not a draft**</p><p>These are commission specs, not finished copy. The bodies are written from these outlines by the editorial writer (founder + content lead at MVP, dedicated writer in v1.1). The clinical advisor reviews the written body, signs off, and the card is then locked at v1.0.</p>|
| :- |
## **6.1 NUMBERS — Understanding your numbers (8 cards)**
### **numbers-001 — What is blood pressure?**

|**Field**|**Value**|
| :- | :- |
|Audience|self\_buyer, caregiver|
|Reading context|all (priority 1 — always candidate for inline explainer)|
|Outline|(a) Two numbers: systolic (top, pressure when heart pumps) and diastolic (bottom, pressure between pumps). (b) Both measured in mmHg. (c) Normal range: less than 120/80 (AHA/ACC). (d) BP changes through the day, with food, stress, sleep — one reading does not define you. (e) "Talk to your doctor about what is right for you."|
|Sources|AHA/ACC 2017; WHO Hypertension 2023|
|Note for advisor|This is the single most-read card in the system. Verify the systolic/diastolic explanation lands plainly without simplifying away medical accuracy.|


### **numbers-002 — What "elevated" means**

|**Field**|**Value**|
| :- | :- |
|Audience|self\_buyer, caregiver|
|Reading context|systolic 120–129 / diastolic <80|
|Outline|(a) "Elevated" sits between normal and Stage 1. (b) It is not high blood pressure, but it is a signal that BP is starting to creep up. (c) Many people with elevated BP can return to normal with lifestyle adjustments — sleep, salt, stress. (d) Elevated readings do not always mean elevated BP — they can be reactive to stress, caffeine, recent activity. Watch the trend, not the reading. (e) Universal escape valve.|
|Sources|AHA/ACC 2017; ESC/ESH 2018|
|Note for advisor|AHA introduced the "elevated" tier in 2017; older guidelines (still in clinical use in some settings) used "pre-hypertension". Acknowledge both terms once.|


### **numbers-003 — What "Stage 1" means**

|**Field**|**Value**|
| :- | :- |
|Audience|self\_buyer, caregiver|
|Reading context|systolic 130–139 / diastolic 80–89|
|Outline|(a) Stage 1 is the first tier of high blood pressure under AHA/ACC 2017. NICE NG136 in the UK uses 140/90 as the start of Stage 1 — we follow AHA/ACC. (b) Many people in Stage 1 are managed with lifestyle adjustments alone for 3–6 months before medication is considered. (c) White-coat readings can falsely elevate clinical BP — home readings are often more representative. (d) Universal escape valve, plus: "If two of your readings on different days fall in this range, mention it at your next doctor visit."|
|Sources|AHA/ACC 2017; NICE NG136 (briefly cite divergence)|
|Note for advisor|Critical to acknowledge guideline divergence (130 vs 140 threshold) without confusing the user. Suggest a 2-line treatment.|


### **numbers-004 — What "Stage 2" means**

|**Field**|**Value**|
| :- | :- |
|Audience|self\_buyer, caregiver|
|Reading context|systolic ≥140 / diastolic ≥90|
|Outline|(a) Stage 2 is the higher tier of high blood pressure. (b) Most clinicians will recommend medication alongside lifestyle adjustments at this stage — but the decision is the doctor’s. (c) Sustained Stage 2 is associated with higher risk of stroke and heart disease over time. We say this once, factually, without alarm. (d) Home readings are valuable evidence for the conversation — bring your trend. (e) Universal escape valve, plus: "Worth talking to your doctor about it."|
|Sources|AHA/ACC 2017; WHO 2023|
|Note for advisor|Risk language must be present once but not repeated. Do not bury the lede; do not lead with fear.|


### **numbers-005 — Why systolic and diastolic each matter**

|**Field**|**Value**|
| :- | :- |
|Audience|self\_buyer, caregiver|
|Reading context|all (priority 3 — supplementary)|
|Outline|(a) Systolic (the top number) is when the heart contracts — the higher pressure. (b) Diastolic (the bottom number) is when the heart rests — the lower pressure. (c) Both matter; some people have isolated systolic hypertension (top high, bottom normal), particularly older adults. (d) A reading is "high" if EITHER number is in the high range. (e) Universal escape valve.|
|Sources|AHA/ACC 2017; ESC/ESH 2018|
|Note for advisor|Isolated systolic hypertension is common in older adults — specifically relevant for parent users.|


### **numbers-006 — When BP is a real concern**

|**Field**|**Value**|
| :- | :- |
|Audience|self\_buyer, caregiver|
|Reading context|systolic ≥160 / diastolic ≥100 (priority 1 for these tiers)|
|Outline|(a) Most BP readings, even high ones, are not emergencies. (b) Sustained Stage 2 readings (≥160/100 over multiple days) are worth a doctor visit, not a hospital visit. (c) Hypertensive urgency vs emergency is defined by whether the high BP is causing damage — chest pain, severe headache, vision changes, trouble breathing. (d) If those symptoms are present, it is a hypertensive emergency — seek urgent care now. (e) If they are not, breathe, sit, re-take the reading in 5–10 minutes, then call your doctor for advice.|
|Sources|AHA/ACC 2017 Crisis section; Joint National Committee 8|
|Note for advisor|This is the highest-stakes card for liability. Symptom list MUST be reviewed by clinical advisor word-by-word before publish.|


### **numbers-007 — Hypertensive urgency vs emergency**

|**Field**|**Value**|
| :- | :- |
|Audience|self\_buyer, caregiver|
|Reading context|systolic ≥180 / diastolic ≥120 (priority 1 — ALWAYS shown for crisis tier)|
|Outline|(a) Two terms used clinically. Urgency: high BP without organ damage symptoms. Emergency: high BP WITH symptoms (chest pain, severe headache, vision changes, trouble breathing, weakness on one side, slurred speech). (b) Emergency = call emergency services or get to an ER now. (c) Urgency = call your doctor today; usually managed without admission. (d) White-coat or measurement error can produce false-high readings; if you feel completely fine, sit, re-take in 5–10 minutes. (e) Final line on the card: "When in doubt, call your doctor or local emergency line."|
|Sources|AHA/ACC 2017; Joint National Committee 8|
|Note for advisor|Emergency numbers vary by locale (911 US, 112 UK/EU, 199 Nigeria). Card displays the right number based on user locale.|


### **numbers-008 — Why one high reading is rarely a problem**

|**Field**|**Value**|
| :- | :- |
|Audience|self\_buyer, caregiver|
|Reading context|all (priority 2)|
|Outline|(a) BP changes through the day — normal swings of 20 mmHg systolic are common. (b) Stress, caffeine, full bladder, recent meal, talking, posture, cold cuff — all change a single reading. (c) Trends across days and weeks are more meaningful than any single reading. (d) Two readings 1–2 minutes apart, averaged, are more reliable than one. The watch makes this easy. (e) Universal escape valve.|
|Sources|AHA/ACC 2017 home-monitoring section; ESC/ESH 2018|


## **6.2 CHANGES — Why blood pressure changes (6 cards)**
### **changes-001 — Why morning BP is higher**

|**Outline**|**(a) BP follows a daily rhythm — lowest during sleep, rising sharply in the hour after waking, peaking mid-morning. (b) The "morning surge" is a normal physiological pattern; very large surges may matter clinically. (c) Comparing readings is most useful when taken at similar times of day. (d) If you take medication, talk to your doctor about timing — some medications are taken at night specifically to flatten morning surge. (e) Universal escape valve.**|
| :- | :- |
|Sources|Kario et al, hypertension circadian research; AHA/ACC 2017|


### **changes-002 — Stress and blood pressure**

|**Outline**|**(a) Acute stress raises BP within minutes — well documented. (b) Whether chronic stress causes sustained hypertension is less clear; evidence is mixed. (c) Some people see their readings drop after a few minutes of slow breathing or being in a quiet space. Try this and watch your readings. (d) Stress-management techniques help many; they do not "cure" hypertension. (e) Universal escape valve.**|
| :- | :- |
|Sources|AHA on stress and BP; meta-analyses on chronic stress (acknowledge mixed evidence)|


### **changes-003 — Why BP rises after meals**

|**Outline**|**(a) Most people see a small BP rise after a meal, especially salty or large meals. (b) For some older adults, the opposite happens — postprandial hypotension (BP drops after eating). (c) Time meals consistently when comparing readings. (d) A higher post-meal reading does not mean the meal "caused" hypertension; it means the body is processing food. (e) Universal escape valve.**|
| :- | :- |
|Sources|AHA on postprandial BP|


### **changes-004 — BP after exercise**

|**Outline**|**(a) During exercise, systolic rises sharply — normal and healthy. (b) After exercise, BP usually falls below baseline for 30–60 minutes — a phenomenon called "post-exercise hypotension". (c) For accurate trend readings, take BP either before exercise or 60+ minutes after. (d) Regular exercise is associated with lower resting BP over weeks and months. (e) Universal escape valve.**|
| :- | :- |
|Sources|ACSM; AHA exercise + BP statements|


### **changes-005 — White-coat and masked hypertension**

|**Outline**|**(a) White-coat: BP is normal at home but high in clinic — anxiety raises BP at the doctor visit. About 15–30% of clinic-diagnosed cases. (b) Masked: opposite — normal in clinic but high at home. About 10–20%. (c) Home readings (like the ones from your watch) help reveal both patterns. (d) Bring your home trend to your doctor visit — it changes the conversation. (e) Universal escape valve.**|
| :- | :- |
|Sources|AHA/ACC 2017 home-monitoring section; ESH 2023 ambulatory BP monitoring guideline|


### **changes-006 — Dehydration and BP**

|**Outline**|**(a) Mild dehydration can lower BP. (b) Severe dehydration also lowers BP and is dangerous — not a desired effect. (c) Drinking water before a reading does not "fake" your trend; consistent hydration is part of accurate measurement. (d) Hot weather, exercise, illness all increase fluid loss — readings on those days may differ. (e) Universal escape valve.**|
| :- | :- |
|Sources|AHA on hydration; clinical reviews on volume status and BP|


## **6.3 OTHER — Other numbers on your watch (4 cards)**
### **other-001 — What your heart rate tells you**

|**Outline**|**(a) Heart rate (HR) is beats per minute. Resting HR for healthy adults is usually 60–100. (b) Athletes and very fit adults often have lower resting HR. (c) HR rises with exercise, stress, caffeine, fever, dehydration. (d) HR and BP are not the same thing — a high HR does not mean high BP. (e) Universal escape valve.**|
| :- | :- |
|Sources|AHA on resting HR; ACC|


### **other-002 — SpO2: what your watch can and cannot tell you**

|**Outline**|**(a) SpO2 is an estimate of oxygen in your blood, expressed as a percentage. Healthy adults usually read 95–100%. (b) Wrist-worn SpO2 sensors are LESS accurate than clinical pulse oximeters — acknowledge this directly. (c) The watch SpO2 reading is a wellness reference, not a clinical measurement. (d) If you have a chronic respiratory condition (COPD, asthma, sleep apnea), do not rely on the watch SpO2 for clinical decisions — use a clinical-grade oximeter your doctor recommends. (e) Universal escape valve.**|
| :- | :- |
|Sources|FDA wearable SpO2 guidance; published comparison studies|
|Note for advisor|CRITICAL card. Honest about device limitations. Required to comply with K141683 IFU — SpO2 is a wellness feature. Liability sensitive.|


### **other-003 — Sleep tracking on your watch**

|**Outline**|**(a) The watch estimates sleep duration and stages from movement and HR. It is an estimate, not a polysomnography (clinical sleep study). (b) Trends are useful: did you sleep more or less than usual this week? (c) Specific stage breakdowns (REM, deep) are approximate and should not be over-interpreted. (d) Sleep affects BP — short or fragmented sleep is associated with higher BP. (e) Universal escape valve.**|
| :- | :- |
|Sources|AHA sleep and BP; sleep study comparisons of consumer wearables|


### **other-004 — Steps and activity**

|**Outline**|**(a) Step count is a useful daily-activity proxy, not a perfect one. (b) The "10,000 steps" figure is a marketing legacy, not a clinical recommendation — evidence supports benefit at 7,000–9,000 steps per day for older adults. (c) Consistent moderate activity is associated with lower BP over weeks and months. (d) Watch how your readings respond to weeks with more or less movement. (e) Universal escape valve.**|
| :- | :- |
|Sources|JAMA Internal Med study on step counts and mortality; ACSM activity guidelines|


## **6.4 DAILY — Daily life and BP (6 cards)**
### **daily-001 — Salt and BP**

|**Outline**|**(a) Sodium increases the volume of fluid in the bloodstream, which increases BP. (b) Most adults get more sodium than the WHO target of 2g/day; processed foods and restaurant meals are usually the biggest contributors. (c) Reducing sodium has a modest BP-lowering effect for most people; people with salt sensitivity see larger effects. (d) Some people see no effect at all — this is normal variation. (e) Watch your readings on lower-sodium days vs typical days. Universal escape valve.**|
| :- | :- |
|Sources|WHO sodium 2023; DASH-Sodium trial; AHA|


### **daily-002 — Sleep and BP**

|**Outline**|**(a) Most adults need 7–9 hours of sleep. Less is associated with higher BP. (b) Sleep apnea (interrupted breathing during sleep) is a strong driver of resistant hypertension; if you snore loudly, gasp, or wake un-rested, mention it to your doctor. (c) Consistent sleep schedules matter as much as duration. (d) Your watch tracks sleep duration approximately — see other-003 for caveats. (e) Universal escape valve.**|
| :- | :- |
|Sources|AASM; AHA sleep statements; OSA guidelines|


### **daily-003 — Alcohol and BP**

|**Outline**|**(a) Alcohol acutely lowers BP for a few hours, then raises it as the body processes it. (b) Regular heavy drinking is associated with sustained higher BP. (c) Light drinking effects are more debated; recent evidence is shifting toward "less is better, including zero". (d) If you choose to drink, watch your readings on the morning after. (e) Universal escape valve. Do NOT recommend a specific limit.**|
| :- | :- |
|Sources|WHO 2023 statement on alcohol; recent meta-analyses|


### **daily-004 — Caffeine and BP**

|**Outline**|**(a) Caffeine raises BP for 1–3 hours after consumption — well documented. (b) Whether regular coffee drinkers develop tolerance is debated; some do, some do not. (c) Avoid taking BP within 30 minutes of coffee or tea for accurate trend readings. (d) Long-term effect of moderate coffee on hypertension risk is small or null in most studies. (e) Universal escape valve. Watch your own readings.**|
| :- | :- |
|Sources|meta-analyses on caffeine and BP; AHA|


### **daily-005 — Exercise and BP over time**

|**Outline**|**(a) Regular exercise lowers resting BP — typically 5–8 mmHg systolic over weeks of consistent activity. (b) Aerobic exercise has the strongest evidence; resistance training adds a smaller benefit. (c) Moderate intensity for 30 minutes most days is the typical recommendation in most guidelines — mention guidelines without prescribing specifics. (d) If you have not exercised regularly, talk to your doctor before starting a new program, especially if you are on medication. (e) Universal escape valve.**|
| :- | :- |
|Sources|ACSM; AHA exercise; ESC/ESH 2018|


### **daily-006 — Stress, anxiety and BP**

|**Outline**|**(a) Acute stress raises BP within minutes. (b) Chronic stress’s direct effect on hypertension is debated; indirect effects (poor sleep, alcohol, weight gain, missing medication) are well documented. (c) Slow breathing, social connection, and physical activity are commonly studied; results vary by person. (d) Anxiety can also fake-elevate BP at the moment of measurement — sit and breathe before retaking. (e) Universal escape valve. If anxiety is a daily struggle, talk to your doctor.**|
| :- | :- |
|Sources|AHA stress; meta-analyses on stress-reduction interventions|


## **6.5 CULTURAL — In your kitchen (3 cards)**
### **cultural-001 — Jollof, stew, and salt**

|**Outline**|**(a) Jollof rice and tomato-pepper stews are deeply salt-flavored — stock cubes (Maggi, Knorr) are concentrated sodium. (b) One stock cube can contain 1.5–2g sodium — close to the full WHO daily target. (c) Cooking with reduced cubes and more fresh aromatics (onion, ginger, scotch bonnet, garlic) preserves the flavor profile while lowering sodium. (d) This is observation, not prescription. Some families have been cooking this way for generations and reading completely differently — watch your own readings. (e) Universal escape valve.**|
| :- | :- |
|Sources|WHO sodium 2023; published nutritional analyses of West African cuisine|
|Note for advisor|Cultural specificity is the point. Resist the temptation to "translate" this into Western dietary advice. The Nigerian reader knows what jollof is; the card lands because of that.|


### **cultural-002 — Palm oil, fats, and the heart**

|**Outline**|**(a) Palm oil is high in saturated fat. Saturated-fat-and-heart-disease evidence has shifted over decades; current consensus: large amounts increase risk, moderate amounts in mixed diets less clearly so. (b) The traditional Nigerian diet uses palm oil sparingly compared with industrial Western fats; modern processed-food consumption may be a bigger factor than home palm oil. (c) Acknowledge cultural ambivalence: palm oil is also part of cultural identity — we don’t take that lightly. (d) Watch your trends if you change cooking fats. (e) Universal escape valve.**|
| :- | :- |
|Sources|AHA dietary fats 2017; published reviews on tropical oils and CVD risk; African-region nutritional epidemiology|
|Note for advisor|This card walks a cultural-respect tightrope. Tone matters more than fact density.|


### **cultural-003 — Herbal remedies and your BP medication**

|**Outline**|**(a) Many traditional remedies (bitter leaf, scent leaf, agbo, garlic preparations, ginger) are used for "high BP" in West African contexts. (b) Some have small BP-lowering effects in studies; some have no evidence; some interact with prescribed medications in dangerous ways. (c) Hibiscus tea (zobo) has modest BP-lowering effects in some studies — generally considered safe in normal amounts. (d) Liquorice root and certain herbal mixtures can RAISE BP and interact with diuretics. (e) ALWAYS tell your doctor and pharmacist what herbs you are taking. They are not "natural and safe" — they are medicines too. (f) Universal escape valve.**|
| :- | :- |
|Sources|NCCIH on herbal remedies; published African ethnopharmacology reviews; Lancet on traditional medicine|
|Note for advisor|High-stakes safety card. Specific drug-herb interactions need clinical advisor verification before publish.|


## **6.6 DOCTOR — Conversations with your doctor (3 cards)**
### **doctor-001 — When to talk to your doctor about BP**

|**Outline**|**(a) For Stage 1 readings: bring it up at your next routine visit. (b) For Stage 2 readings sustained over a week: schedule a visit. Don’t wait for the next routine. (c) For Crisis readings (≥180/120) with symptoms: emergency. (d) For Crisis readings without symptoms: call your doctor today; usually managed without admission. (e) Bring your home trend (Kena makes this easy) — doctors get more from a 30-day chart than from one in-clinic reading. (f) Universal escape valve.**|
| :- | :- |
|Sources|AHA/ACC 2017|


### **doctor-002 — Five questions worth asking**

|**Outline**|**(a) "What is the BP target you and I should aim for, given my age and other conditions?" — acknowledges target individualization. (b) "If I am on medication, when should I expect to see changes in my home readings?" (c) "What lifestyle adjustments would have the biggest effect for me, given my situation?" (d) "When should I call you vs wait for my next visit?" (e) "If I am taking herbal remedies or supplements, are any of them a concern with my medication?" (f) These are starting points; bring your own questions too.**|
| :- | :- |
|Sources|patient-education frameworks; AHA patient-resource pages|


### **doctor-003 — Sharing your trends**

|**Outline**|**(a) The Kena weekly summary (subscription) gives you a one-page PDF you can show your doctor. (b) Even without subscription, you can show the Trends screen on your phone — most doctors will look. (c) A 14–30 day home trend is more useful than a single in-clinic reading, especially for ruling out white-coat or masked hypertension. (d) If your doctor is not used to looking at home BP data, frame it as "I have been tracking at home; here is what I am seeing." (e) Universal escape valve.**|
| :- | :- |
|Sources|AHA/ACC 2017 home monitoring; ESH 2023|


# **7. AI Fallback for Unscoped Questions**
A user will ask the AI assistant questions that no Learn card answers ("Is it safe for me to fly?", "Can I dye my hair?", "What’s the difference between an ACE inhibitor and a beta-blocker?"). The Learn library will never cover the long tail. The AI assistant must handle these gracefully without straying into medical-advice territory.
## **7.1 The Three Response Modes for AI Assistant**

|**Mode**|**Triggered when**|**Response shape**|
| :- | :- | :- |
|ANSWER|Question is in scope (about user’s readings, BP general knowledge covered by Learn cards)|Direct answer in 2–4 sentences, citing the user’s data and/or linking to a Learn card|
|EDUCATE|Question is in scope but the answer is in a Learn card the user has not read|Brief contextual answer + "There’s a card on this in Learn: [card title]" with a deep link|
|DEFER|Question is OUT of scope (specific medication advice, drug interactions, symptom interpretation, treatment decisions)|"That’s a question for your doctor. They know your full picture." — no attempt to answer.|


## **7.2 DEFER Triggers (server-side guard)**
The AI response must be filtered server-side BEFORE delivery. Output guard (D7 §4.6) blocks responses containing any of these patterns and returns the DEFER template instead:

- Specific drug names (ACE inhibitor, beta-blocker, lisinopril, amlodipine, hydrochlorothiazide, etc.) — keyword list maintained by clinical advisor
- Treatment recommendations (dose changes, "switching to", "increasing/decreasing dose")
- Symptom interpretation ("does this sound like…", "is it possible I have…")
- Specific dietary plans by name (DASH, Mediterranean) when answer would be a recommendation
- Pregnancy, breastfeeding, pediatric questions — hard reject (out of IFU scope)
- Mental health crisis indicators — special template offering local crisis line, not "guidance"


## **7.3 The DEFER Template Strings**

|**Trigger category**|**Response template**|
| :- | :- |
|Specific medication|"Decisions about medication are best made with your doctor or pharmacist — they know what else you’re taking and what’s right for you."|
|Symptom interpretation|"Symptoms can mean different things in different people. Worth a chat with your doctor about what you’re feeling."|
|Pregnancy / pediatric|"Kena isn’t designed for pregnancy or for younger users — those situations need a clinician who can use the right monitor and the right thresholds."|
|Mental health crisis|"This sounds heavy. If you’re struggling, please reach out to a friend, family member, or local crisis line. In Nigeria you can call the Mental Health Foundation. You’re not alone in this."|
|Generic out-of-scope|"That’s outside what I can help with. Your doctor is the right person for this one."|


## **7.4 Card-Discovery Helper**
When the AI returns an EDUCATE response, it must include a deep link to a Learn card. The match logic runs server-side against the card index:

function matchCard(userQuestion: string, cards: Card[]): Card | null {

`  `// Stage 1: keyword match against title and tags

`  `const direct = cards.find(c =>

`    `c.searchableKeywords.some(k =>

`      `userQuestion.toLowerCase().includes(k.toLowerCase())

`    `)

`  `);

`  `if (direct) return direct;

`  `// Stage 2: semantic match via embeddings (cached at card-publish time)

`  `const embedded = cosineSimilarityTop1(

`    `embedQuestion(userQuestion),

`    `cards.map(c => c.embedding)

`  `);

`  `return embedded.score > 0.78 ? embedded.card : null;

}



- Embeddings: text-embedding-3-small (OpenAI), 256-dim, cached in cards\_embeddings table
- Re-embed runs nightly if any card publishes/updates
- No-match → EDUCATE downgrades to ANSWER without card link


# **8. Localisation Pipeline**
English is the only locale at MVP. Yoruba, Igbo and Hausa launch in v1.1 (Q3 2026 target). French and Swahili launch in v1.2. The pipeline is designed so adding a locale is structurally simple but quality-gated heavily.
## **8.1 Locale Phases**

|**Locale**|**Target phase**|**Rationale**|
| :- | :- | :- |
|English (en)|MVP|Primary at launch; covers caregivers in diaspora, all self-buyers initially|
|Yoruba (yo)|v1.1 (Q3 2026)|Largest Nigerian language by parent-side reach in launch market|
|Igbo (ig)|v1.1|Second priority for parent-side coverage|
|Hausa (ha)|v1.1|Northern Nigeria coverage; reaches markets the other two do not|
|French (fr)|v1.2|West Africa francophone expansion (Senegal, Côte d’Ivoire, Cameroon)|
|Swahili (sw)|v1.2|East Africa expansion (Kenya, Tanzania)|


## **8.2 Translation Quality Gates**
Health content translation is high-stakes. A mistranslation in the Crisis card could cost a life. The pipeline gates against this.

- STAGE 1 — Native-speaker translator (NOT machine translation) translates English source to target locale. MUST be a translator with health-content experience.
- STAGE 2 — Bilingual back-translation: a SECOND translator, blind to the original, translates the target back to English. Compare to source; flag divergences.
- STAGE 3 — Clinical advisor (or designate fluent in target locale) reviews critical-tier strings: tier-interpretation strings (§4.3.2 of this doc), the numbers-006 and numbers-007 cards, and the cultural-003 card.
- STAGE 4 — Locale freeze: card content is locked at the version-and-locale level. Updates require re-running stages 1–3 for affected strings.


## **8.3 RTL Readiness**
Arabic is not in scope at v1.0 or v1.1, but D8 §8.4 already commits to RTL readiness in component implementation. D9 components inherit that:

- Card layout uses logical properties (start/end) not physical (left/right)
- Numerics in body content are LTR even in RTL locales (per Unicode bidi)
- Reading-tier chips reverse direction in RTL locales
- Verified at compile time via a layout-mirror test in Storybook (D8 §8.4)


## **8.4 Locale-Aware Inline Explainer**
When the user’s device locale resolves to a target the card has not been translated to, fall back to English. Show a small banner at the top of the card: "This card is not yet available in {{locale\_name}}. Showing the English version."

- NEVER auto-translate at runtime via machine translation; the editorial gates exist for a reason
- Banner has a "Notify me when available" tap target that subscribes the user to a per-locale push
- Non-translated cards do NOT appear in the Learn module home for users on that locale (avoids confusion); they CAN appear via inline-explainer fallback in critical-reading contexts where any-language content is better than nothing


# **9. Editorial Workflow**
The pipeline from "card spec in this document" to "card live in production" passes through four gates. No card skips a gate.
## **9.1 The Four Gates**

|**Gate**|**Owner**|**Output**|**Sign-off mechanism**|
| :- | :- | :- | :- |
|1\. Spec|Founder + content lead|This document (§6 outlines)|Document version control (already done at D9 v1.0)|
|2\. Body draft|Content writer|300–500 word MDX file in /apps/mobile/src/learn/cards/[id].mdx|Pull request to main; copy-lint passes|
|3\. Clinical review|Clinical advisor|Reviewed body, with edits|Sign-off recorded in card frontmatter (reviewed\_by + last\_reviewed); merge gated on this|
|4\. Final QA|QA + accessibility reviewer|Card renders correctly in all device classes; reading level checked; accessibility pass; copy-lint final|Marked publishable in card index|


## **9.2 Copy-Lint Rules (extends D8 §6.1)**
A pre-commit hook on /apps/mobile/src/learn/cards/ runs the linter. Fails block commit. New rules added for Learn:

- FORBIDDEN\_VERBS: should | must | have to | need to | recommend | aim for | try to (when used in second person, present/imperative)
- FORBIDDEN\_CLAIMS: diagnoses | predicts | treats | cures | medical-grade | clinical-grade
- FORBIDDEN\_DRUG\_NAMES: maintained list of common antihypertensive drug names; flag for clinical advisor review (does not block)
- REQUIRED\_FIELDS\_IN\_FRONTMATTER: id, title, category, audience, reading\_context, sources, last\_reviewed, reviewed\_by
- REQUIRED\_TRAILING\_LINE: every actionable card ends with the universal escape valve ("Talk to your doctor…" or equivalent template)
- LENGTH\_BOUND: 300–500 words in body; warn outside, hard fail outside 250–600
- READING\_LEVEL: Flesch-Kincaid Grade computed; warn above 8, hard fail above 10


## **9.3 Versioning and Quarterly Review**

|**Aspect**|**Rule**|
| :- | :- |
|Card versions|Major version bumps when body content changes substantively. Minor for typo / formatting fixes. Tracked in card frontmatter.|
|Last-reviewed date|Set on first publish. Updated on each clinical review.|
|Quarterly review schedule|All cards with last\_reviewed > 90 days old surface in a "review queue" for clinical advisor. Reviewed in batch.|
|Content sunsetting|If a card’s evidence base shifts (e.g., AHA updates a guideline), card is marked deprecated, replaced, and old card removed from the library after a 30-day grace.|
|User notification|When a card is updated substantively, users who have read it before (telemetry) get a soft push: "We updated a card you’ve read: [title]." Optional, throttled to 1 per week max.|


# **10. Open Questions & Out-of-Scope**
## **10.1 Open Questions**

|**#**|**Question**|**Owner**|**Target**|**Default if unresolved**|
| :- | :- | :- | :- | :- |
|Q-D9-1|Clinical advisor hire — Q5 in D7 §14 — blocks all card publishing.|Founder|Sprint 4|BLOCKER for go-live. No card ships without clinical advisor sign-off.|
|Q-D9-2|Hyperlinks to external sources (PubMed, AHA pages) at MVP — yes/no?|Founder + Editorial|Sprint 5|NO at MVP. Cite source by name in footer; don’t link out. Revisit v1.2 with warn-on-leave sheet.|
|Q-D9-3|PDF export of cards (for print, for sharing with parents who don’t use the app)?|Founder|V1.1|NO at MVP. Revisit if user research surfaces this need.|
|Q-D9-4|Audio narration for cards (Yoruba/Igbo/Hausa parent users with low literacy)?|Founder|V1.2|NO at MVP. Cost-benefit analysis pending v1.1 telemetry.|
|Q-D9-5|Yoruba / Igbo / Hausa launch — all three at once or phased?|Founder|Sprint 8|All three at once. Translator hire across all three is the budget question, not the linguistic one.|
|Q-D9-6|Gamification temptation — "you’ve read 5 cards this week!" — yes or no?|Founder|Pre-launch|NO. Anti-pattern (D8 §1.3). Streaks/badges erode trust in a health context. Hold the line.|
|Q-D9-7|A/B testing card variants for engagement — yes or no?|Founder + Editorial|V1.1|NO. Health content is not a marketing surface. Improvements ship after editorial review, not after engagement A/B.|
|Q-D9-8|Feedback mechanism on cards ("Was this helpful?")|Founder|V1.1|YES, but as a NON-rating capture: a single tap on "This raised more questions" or "This helped" — binary, no stars, no comments. Feeds editorial, does not feed ranking.|


## **10.2 Out of Scope for D9 v1.0**
- Symptom interpretation cards (chest pain types, headache differentiation, etc.) — triage territory
- Medication-specific cards (ACE inhibitors, beta-blockers, diuretics) — prescribing-adjacent
- Diagnostic content (causes of secondary hypertension, when to suspect Cushing’s, etc.) — way outside our scope
- Pediatric content — not in IFU
- Pregnancy content — deferred to v2.0 Specialised Populations track (per D3 amendment)
- Cards in audio or video form — v1.2+
- Personalised "your-curriculum" or learning-path features — product-led-growth surface; later
- Machine translation of any content — always human translation, gated
- User-generated content — too much liability


## **10.3 Document Changelog**

|**Version**|**Date**|**Changes**|
| :- | :- | :- |
|1\.0|May 2026|Initial issue. Establishes editorial principles, six-category taxonomy, MDX frontmatter schema, Learn module home + card detail + inline explainer + seeded onboarding components, AI fallback (DEFER guard), localisation pipeline, four-gate editorial workflow, copy-lint extensions and 30-card launch inventory.|



|<p>**Critical path to launch**</p><p>Card publishing requires clinical advisor sign-off (Q-D9-1, also Q5 in D7 §14). Without that hire, the Learn module ships as scaffolding only — no card content — which forces inline explainer to use range-interpretation strings only, with no card-level depth. This is acceptable for soft-launch but not for general availability. Hire is on the critical path.</p>|
| :- |



*— End of D9 —*
LawOne Cloud LLC  •  Confidential  •  Page 
