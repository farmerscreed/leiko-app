# Screen — Reading Detail

Sourced from D8 §4.6 + D6 US-24 / US-25 / US-27 / US-50, with **AMENDS** per D8a §7 for the self-buyer track. The full context view of a single reading. Most-trafficked surface for the Inline Explainer (`docs/08-learn-module.md` Surface B).

---

## Audience
- Caregiver (primary — viewing parent's reading)
- Self-buyer (their own reading)
- Parent (limited view — see `parent-side-reading-history` mode)

## Purpose
Show the full context of one reading: value, time, source, quality flags, notes, comments, and the tier-appropriate Learn explainer.

---

## Layout (top to bottom)

| Element | Spec |
| --- | --- |
| Header | Back chevron (Phosphor `CaretLeft`, 24pt) + **parent name (caregiver) OR "Your reading" + date (self-buyer per D8a §7.1)** (`type.headline`); right-aligned avatar (caregiver only — removed in self-buyer mode per D8a §13.3) |
| Hero BP value | `type.numeric-xl` (56pt JetBrains Mono Medium tabular) — e.g. `128/82` centred, with `mmHg` suffix in `type.body-m` muted |
| Tier chip | `Pill` component — variant from anomaly classification (`docs/10-anomaly-logic.md`): success / accent / urgent |
| "What does this mean?" link | Inline below tier chip — `button.ghost`, `color.brand.primary-soft` — opens **Inline Explainer Sheet** (`docs/08-learn-module.md` §"Surface B") |
| Secondary stats row | HR (`type.numeric-m`) + SpO2 (`type.numeric-m`) — labelled `type.caption` muted; SpO2 displayed with "wellness oxygen estimate" caveat per `docs/05-voice-and-claims.md` |
| Timestamp + source | `type.body-m`, `color.text.secondary`. Format: "Today, 7:42am" or "Tuesday March 4, 7:42am" for >24h |
| Quality flags (if any) | Small chips: "Cuff slipped during reading", "Motion detected" — non-fear language only |
| Reading notes section (caregiver mode) | If notes exist: title `type.title` "Notes"; each note as a list-row with author avatar + body + timestamp |
| Comment thread / Notes (D6 US-50, D8a §7.3) | **Caregiver mode**: caregiver-to-caregiver comment thread (emoji + 280-char body; reply input at bottom). **Self-buyer mode (SUPERSEDES)**: replaced by a **private notes section** ("My notes") visible only to the user. In hybrid mode, "My notes" stays private; a separate "Family notes" section is added for messages visible to invited caregivers. |
| Action buttons | **Caregiver mode**: "Mark as not me" (parent only) → soft-hide with `hidden_reason='measured_someone_else'`; "Add a note" (any family member); "Share with doctor" (Plus only — paywall trigger). **Self-buyer mode (D8a §7.2)**: "Mark as not me" REMOVED (no semantic meaning); "Add to weekly note" renamed to **"Note for my doctor"**; ADDS **"Why this reading?"** (`button.ghost`) — opens the Inline Explainer Sheet pre-loaded with the matched range card |

---

## Tier chip → headline mapping

| Tier (`docs/10-anomaly-logic.md`) | Pill variant | Tier chip text | Inline Explainer headline |
| --- | --- | --- | --- |
| `in_range` | `success` | "In range" | "Your reading is in the normal range." |
| `calm_concerned` (elevated/Stage 1) | `accent` | "Worth a look" | "Your reading is in Stage 1." (or per range) |
| `confirmed_urgent` (Stage 2 / Crisis) | `urgent` | "Talk to your doctor" | "This reading is well above your usual range." |

The Inline Explainer headline pulls from `docs/08-learn-module.md` §6 reading-context mapping.

---

## States

| State | Visual |
| --- | --- |
| `default` | All sections rendered |
| `loading` | Skeleton on hero + secondary stats; notes/comments hidden until loaded |
| `offline` | Cloud-slash icon next to timestamp; "Pending sync" caption |
| `hidden` | If `hidden = true` (caregiver soft-deleted): banner at top "This reading is hidden from the family — reason: cuff slipped". Hidden readings are not visible to caregivers in lists; visible only when navigated directly via deep link. |

---

## Voice

Per `docs/05-voice-and-claims.md`:
- Tier chip text uses calm-concerned phrasing — *"Worth a look"*, *"Talk to your doctor"*. Never "Alert", "Warning", "Critical".
- The "What does this mean?" link is the canonical entry to the Learn module — language is identical across the app.
- Add-a-note prompt (when empty): *"Add context if you want — what was happening when this reading was taken?"*

---

## Behaviour

- Default route: tap on Reading Card from home, or anomaly notification deep link `kena://reading/{reading_id}`.
- **First-reading auto-expand**: when this is the user's FIRST reading, the Inline Explainer auto-opens pre-expanded with `numbers-001` ("What is blood pressure?"). Flag stored in MMKV. (`docs/08-learn-module.md` §7.)
- For confirmed-urgent readings opened via push: the screen shows the urgent banner at top until acknowledged.
- Comment thread sync uses Supabase Realtime — caregiver sees siblings' comments live.

---

## Accessibility

- Hero numeric: `accessibilityLabel: "128 over 82 mmHg, pulse 74"`. Reads as a sentence, not a fragment.
- Tier chip: `accessibilityLabel` describes both tier and call-to-action ("Worth a look — tap to learn more").
- Inline Explainer: `accessibilityRole: "button"`, hint "Opens explanation sheet".
- VoiceOver order: header → hero → tier → "What does this mean" → timestamp → secondary stats → notes → comments. Avoid jumping back and forth.

---

## Sprint 6 acceptance criteria
- All sections render for at least one reading from each tier.
- Inline Explainer Sheet opens with correct cards from `docs/08-learn-module.md` §6.3 mapping.
- First-reading auto-expand flag works (MMKV).
- "Mark as not me" soft-hides correctly (RLS test: caregiver-side update with hidden_reason fields).
- Voice gate passes.
- Component + integration tests covering all 3 tier rendering + first-reading auto-expand.

---

## Privacy boundary in hybrid mode (D8a §7.3 callout)

In hybrid mode, the self-buyer keeps a **private notes channel** ("My notes") even after inviting caregivers. This is a deliberate trust feature: the protagonist of the data should always have a private write surface that the watchers cannot see. Per D3 HIPAA-aligned consent flow.

Engineering implication: notes have a `visibility: 'private' | 'family'` field. RLS policy filters by visibility:
- "My notes" rows: SELECT only by `author_id = auth.uid()`.
- "Family notes" rows: SELECT by family member.

---

## Diff vs caregiver track (D8a §7)

| Region | Diff |
| --- | --- |
| Header parent-name | **AMENDS** — replaced by "Your reading" + date in self-buyer |
| Avatar in header | **AMENDS** — REMOVED in self-buyer (D8a §13.3) |
| "Mark as not me" | **AMENDS** — REMOVED in self-buyer |
| "Add to weekly note" | **AMENDS** — renamed "Note for my doctor" |
| "Why this reading?" | **ADDS** — new button.ghost in self-buyer (caregiver mode reaches the explainer via the same anchor on the tier chip) |
| Comments → Notes | **SUPERSEDES** — caregiver→caregiver thread becomes private My notes; hybrid mode adds a separate Family notes section |
