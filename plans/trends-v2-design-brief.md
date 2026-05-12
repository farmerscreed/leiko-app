# Design Brief — Trends v2

**Audience:** the design AI. This document is self-contained — you have not seen the conversation that produced it. Read everything below before producing layout.

**Status:** brief. Once your output is approved, `docs/04-screens/trends.md` will be rewritten to v2.

**Companion brief:** `plans/for-your-doctor-design-brief.md` covers the new "For your doctor" screen that absorbs the doctor-PDF flow being removed from Trends. The two screens ship as a pair; design them as a pair.

**Date:** 2026-05-12.

---

## 1. Context you must respect

Leiko is a caregiver-mode (and self-buyer-mode) blood-pressure monitoring app built on a Urion U16 family BP smartwatch. It tracks five vitals — BP, HR, SpO2, sleep, activity — and surfaces them as an "ambient pulse intelligence" product. The brand promise (D11) is **Apple-of-Healthcare**: calm, premium, AI-led but voice-rule clean.

Two markets: Nigeria and the United States. Three personas: caregiver (default), self-buyer, parent (large-text read-only). The `account_type` field is immutable after onboarding.

**What we've already shipped that informs this redesign:**
- Five-vital ingest + Daily Pulse hero + per-vital detail screens (Sprints 7.5 → 8.5)
- Trends v1 with the multi-vital chart + correlation cards + PDF CTA (Sprint 9 — the thing you're redesigning)
- Cross-vital correlation engine, three meaningful types: `sleep_x_morning_bp`, `activity_x_resting_hr`, `spo2_dip_x_sleep_score` (Sprint 9)
- Tier-A intent router with 50 intents + 20 narration templates (Sprint 11)
- Tier-B LLM gateway via `ai-tier-b` Edge Function → Haiku 4.5 + hash-locked system prompt + 3-layer output guard (Sprint 12)
- Ambient AI surfaces: daily narration, weekly summary placeholder, contextual paragraphs (Sprint 12.5)
- Push + anomaly engine (Sprint 15)
- Offline + error state primitives: `<EmptyState>`, `<ErrorState>`, `<LoadingState>`, `<OfflineBanner>`, AI fall-through cascade `Tier-B → Tier-A → deterministic` (Sprint 16)

**Do not invent components or tokens that aren't already in `apps/mobile/src/components/` or `apps/mobile/src/theme/tokens/`.** If you need a new one, flag it.

---

## 2. Voice & visual anchors

**Voice — non-negotiable.** Read `docs/05-voice-and-claims.md` + D11 §3 (in `docs/_reference/D11-brand-repositioning.md`) end-to-end. Highlights:

- Forbidden words include: `patient`, `diagnose`, `treat`, `cure`, `predict`, `prevent` (when applied to disease), `silent killer`, `ticking time bomb`, `dangerous level`, `critical level`, `medical advice`, `loved ones`, `you should/must/need to`, `optimise`, `biohack`, `streak`, `smart [feature]`, `simple/easy/just` (soft warning), `insights` (soft — prefer "patterns").
- Preferred patterns: lead with the answer, plain language before clinical terms, *"Talk to your doctor"* (never *"consult a healthcare provider"*), calm and dignified.
- Every user-visible string in your output must pass `services/voice/voiceLint.ts`. Component tests fail if hard-fail vocabulary appears.

**Visual — non-negotiable.** Read `docs/_reference/D12-visual-system-v2.md`. Highlights:

- Tokens live in `apps/mobile/src/theme/tokens/`. Consume via `useTheme()` — never raw palette.
- Vital colours: BP brand-accent (amber), HR coral, SpO2 teal, sleep violet, activity sage.
- Red is for confirmed-urgent only. No red on the chart unless an urgent point is plotted.
- Card elevation system: `default | low | medium | high | glass`. Mode-aware via `theme.elevation`.
- Spacing scale from `theme.spacing`; radii from `theme.radii`; type from `theme.type(token)`.
- D12 §6.6 and §11.2.1 govern stale state — 50% opacity + 70% saturation; we already render it via `<VitalRing state="stale" />` and `<VitalTile state="stale" />`.
- Light-mode amber known issue: `#E8A063` on linen fails 3:1 contrast; designer review open. Mention this in any light-mode rendering choice.

**Anti-patterns (CLAUDE.md):**
- No fear-based push or banners.
- No count badges, no "new" dots, no unread indicators on cards.
- Empty state on every screen.
- No localStorage / sessionStorage — MMKV.
- Calm-before-clever animation.

---

## 3. Strategic decisions already made (do not relitigate)

These came out of a founder ↔ engineer agreement before this brief was written. Treat them as fixed inputs.

1. **Trends is primarily retrospective + narrative-led with light conversational follow-up.** The AI tells the user what their data is doing; the chart becomes evidence below the narrative, not the lead. This is the opposite of Trends v1, where the chart was the hero.
2. **The doctor PDF moves out of Trends to its own screen called "For your doctor".** No PDF CTA on Trends. Only a soft inline link near the bottom of Trends that deep-links to the new screen.
3. **The AI narrative on Trends is universally rendered.** Free users get a Tier-A template; Plus users get Tier-B. Same paragraph slot; richer content for Plus. (Consistent with D14 §14.1.)
4. **Paywall posture unchanged.** 7d free; 30d / 90d / 1y Plus-gated. Latest reading + 7d window always free.
5. **The Tier-C weekly summary generator is still deferred** from Sprint 12.5. The slot exists today with placeholder copy. Design for the slot; engineering will wire the generator when ready.

---

## 4. Purpose

Tell the user what their five-vital pattern is doing across a time window. Make the AI narrative the hero. Make the chart the evidence. Surface cross-vital correlations as supporting evidence the narrative cites.

Removed from this screen's job list: *"Prepare a PDF for my doctor"* — that's now "For your doctor".

---

## 5. Audience

- Caregiver (looking at a parent's data; per-parent context set upstream by Family Circle)
- Self-buyer (their own data)
- Parent (read-only, large-text mode — separate variant; see §11)

---

## 6. Jobs-to-be-done

In priority order:

1. *"What does my week / month look like?"* → narrative paragraph.
2. *"Why did X happen?"* → conversational follow-up (Ask Leiko handoff).
3. *"Are any patterns connected?"* → correlation evidence.
4. *"How does this week compare?"* → comparison line (within the narrative; not a separate surface).

---

## 7. Layout direction (top → bottom)

You decide the precise composition; here is the hierarchy + required slots.

1. **Header** — back chevron + headline (`type.headline`). Copy: **"Trends"** (caregiver) / **"Your trends"** (self-buyer). No change.
2. **Range selector** — `Pill` chips: `7D` · `30D` · `90D` · `1Y`. Plus-gated chips trigger the paywall sheet on tap. Smaller / more recessive than the v1 placement — the chips are NOT the hero of the page.
3. **Narrative hero** — *the new lead.* One paragraph, generated by Tier-B (Plus) or Tier-A template (free), rendered through the Sprint 16 fall-through cascade. `type.display-m` or close — premium-precise. Brand accent for emphasis. Voice-rule clean by construction at the engine layer, but verify in your copy decisions. Below the paragraph, a single thin caption line: the AI's reasoning anchor (e.g., *"Based on your last 30 days · last computed 4h ago"*) — small, tertiary text, builds trust.
4. **Focal chart** — *the evidence.* AI picks ONE focal vital based on which is most relevant to the narrative. Other vitals reachable via the expansion below. Treat the chart as visual proof of the paragraph, not as a standalone surface.
5. **"Ask about this trend"** — affordance directly under the chart. Opens an Ask Leiko surface (existing component `<AskLeikoSheet>` or a deep link to the Ask Leiko screen) with the current range and focal vital pre-loaded as context. Tier-B-backed; Sprint 16 cascade keeps it silent-fail.
6. **Evidence rail — correlation cards** — up to 3 cards from `public.correlations` where `is_meaningful = true`. Reframed: these are evidence the paragraph above cites, not standalone surprises. The eyebrow / headline / body structure stays per current spec; the *framing* changes. If the engine produces zero meaningful rows, the rail is hidden entirely (today's "restraint matters" rule per D13 §9.1 still applies).
7. **"See everything" expansion** — disclosure-style affordance: tap to reveal today's full multi-vital chart (all five toggleable series) + the vital toggle row. Recessive by default. Power-user escape hatch.
8. **Weekly summary card** — keep today's slot with the placeholder copy until Sprint 12.5 ships the Tier-C generator. Position: below the expansion, before the inline link to "For your doctor".
9. **Inline link to "For your doctor"** — a soft single-line link, not a button. Copy: *"Want to put this together for your doctor?"* (caregiver mode: *"Want to put this together for their doctor?"*). Deep-links to the "For your doctor" screen with the current range pre-selected.
10. **(REMOVED)** the v1 "Share with your doctor" / "Save as PDF for my doctor" primary CTA. No PDF affordance lives on Trends in v2 — only the inline link in #9.
11. **(REMOVED)** the v1 standalone vital toggle row. Vital toggles live inside the "See everything" expansion now.

---

## 8. AI integration — explicit contract

Sprint 16 shipped the cascade infrastructure. Your design must accommodate:

- **Tier-B response (normal Plus path)** — full paragraph. Render as-is.
- **Tier-A template fall-through (free users always; Plus users when Tier-B fails)** — same slot, slightly shorter. The visual treatment is identical; the user must not be able to tell the difference at a glance.
- **Deterministic fall-through (last resort; never the user's fault)** — same slot, calm one-liner: *"Here's your week. Your readings are saved."* Already exists in `services/ai/fallThrough.ts` as `DETERMINISTIC_COPY.weekly_summary`.
- **No error state.** The fall-through cascade guarantees the paragraph always renders. There is no "AI failed" surface for Trends.

The thin caption line (#3 above) shows the freshness of the AI computation. Useful states:
- *"Based on your last 30 days · just now"*
- *"Based on your last 30 days · 4h ago"*
- *"Based on your last 30 days · yesterday"*

The "Ask about this trend" affordance (#5) opens a Tier-B conversation surface. Treat it as a calm secondary action, not a hero CTA.

---

## 9. Adaptive range — soft version

Don't drop the range chips. Do make the AI tell the user what window it chose: the caption line names the range (*"Based on your last 30 days"*). When the user changes the chip, the narrative regenerates against the new range; the caption updates. This gives users explicit control + AI agency without competing.

---

## 10. Empty / loading / error / offline / stale

Use the Sprint 16 components: `<EmptyState>`, `<ErrorState>`, `<LoadingState>`, `<OfflineBanner>` (mounted globally; no per-screen work needed). Per-vital staleness uses `checkStaleness()` + `formatStalenessCaption()` for any stale vital tile in the expansion.

- **Empty** (less than ~3 days of data) — replace the narrative + chart with `<EmptyState title="Trends will appear here next week" body="We need a few days of readings before we can show a pattern." />`. No CTA. Hide everything below.
- **Sub-week but ≥ 1 day** — Tier-A template can produce a "you've got 3 days of readings — here's what they say so far" line. Use the regular narrative slot; no separate empty state. Hide the expansion + correlations until ≥ 7 days.
- **Loading** — skeleton paragraph (3 lines, shimmer respects reduced motion) + skeleton chart. The Sprint 16 `<LoadingState>` is too generic for this hero; render a custom skeleton that matches the paragraph + chart shape.
- **Error** — fall-through cascade prevents AI errors. For data-fetch errors (Supabase 5xx, network failure mid-load), render `<ErrorState onRetry={...} />` in the chart slot. Narrative slot stays rendered with the deterministic fall-through copy.
- **Offline** — `<OfflineBanner>` is globally mounted; nothing screen-specific. The cached narrative from the last successful load remains visible.
- **Per-vital stale** — only visible in the "See everything" expansion. Use the existing tile/ring stale treatment.

---

## 11. Parent-side trends (large-text mode)

Unchanged from v1. Vertical list, 80pt min row height, `type.numeric-l` for values, `Pill` chip for in-range status. No multi-vital chart, no narrative paragraph, no correlation cards, no inline link to "For your doctor". Per CLAUDE.md cognitive-load limit.

---

## 12. Caregiver-mode narrative pronoun

The narrative addresses the **caregiver**, not the parent. Pattern: *"Mum is in pattern this week. Her mornings ran 4 points above her usual after the two nights under 6h sleep."* Per D14 §3 routing.

---

## 13. Paywall posture

- 7d narrative + chart + correlation cards: free.
- 30d / 90d / 1y narrative: free users see a Tier-A template (shorter, deterministic); the chips that fetch those ranges are Plus-only. A free user tapping `30D` opens the paywall sheet, with `hero=Understand your numbers` (self-buyer) or `Stay close, every day` (caregiver).
- The "Ask about this trend" affordance: free users get up to 5 Tier-B questions/month (D14 §14.1 quota); Plus users get 100. Hitting the quota surfaces D14's calm reset message in the Ask Leiko surface itself, not on Trends.

---

## 14. Voice gate (Trends v2 strings)

Every string YOU author for this screen must pass `lintVoiceText()` at test time. Strings to write:

- The thin caption pattern: *"Based on your last {range} · {freshness}"*
- The "Ask about this trend" affordance label
- The "See everything" expansion label + collapsed/expanded states
- The inline link to "For your doctor"
- Any state copy you introduce that isn't already in the deterministic-copy module

Inherited strings (do not change): range chip labels, vital toggle labels, empty-state copy, weekly summary placeholder copy.

---

## 15. Acceptance criteria

- Narrative paragraph renders on every load; deterministic fall-through means it never shows an error.
- Range chips trigger paywall for free users on 30d / 90d / 1y; AI caption updates to the new range on success.
- Focal chart is AI-picked; "See everything" expansion reveals the full multi-vital chart with five toggleable series.
- Up to 3 correlation cards from `public.correlations`, sorted by `|pearson_r|` desc, `is_meaningful = true` only.
- "Ask about this trend" deep-links to Ask Leiko with the current range + focal vital pre-loaded.
- Inline link to "For your doctor" deep-links with the current range pre-selected.
- Empty state hides the narrative + chart + everything below it.
- Voice-rule clean on every authored string.
- Snapshot tests for: default, empty, loading, paywalled-range, expansion-open.

---

## 16. Anti-patterns specific to Trends v2

- Don't auto-toggle vitals based on classification tier — user controls visibility in the expansion.
- Don't show a "no patterns yet" empty correlation card — hide the rail.
- Don't aggressively animate the narrative paragraph — calm before clever; a fade-in on first load is fine.
- Don't render the chart as the lead — the narrative is the hero.
- Don't use red on the chart unless a confirmed-urgent point is plotted.
- Don't promote the doctor PDF onto this screen — it lives at "For your doctor" only.
- Don't draft an "AI error" state — the cascade prevents one.

---

## 17. Component inventory — compose from these, do not invent

Reusable components you can compose:

- `<EmptyState>` `<ErrorState>` `<LoadingState>` (Sprint 16)
- `<OfflineBanner>` (Sprint 16, globally mounted)
- `<Card>` with elevation variants (`default | low | medium | high | glass`)
- `<Button>` variants (`primary | accent | secondary | ghost | destructive`)
- `<Pill>` (range chips, vital chips)
- `<VitalRing>` `<VitalTile>` (have built-in stale states)
- `<MultiVitalChart>` (existing on Trends v1; reuse inside the "See everything" expansion)
- `<BPTwinLineChart>` (existing; reuse as the focal chart for BP)
- `<VitalTrendChart>` (existing; reuse as the focal chart for HR / SpO2)
- `<ActivityWeeklyBars>` `<SleepHypnogram>` (existing; reuse as the focal chart for activity / sleep)
- `<CorrelationStrip>` (existing; relevant if you want a compact correlation row instead of full cards)
- `<PaywallSheet>` (existing; trigger via the existing `PaywallTrigger` types)
- `<AskLeikoSheet>` (existing; the "Ask about this trend" affordance can open this directly)

Do NOT reuse `<DailyPulseHero>` here — that belongs to Home and conflating purposes will weaken both screens.

If you need a new component, **flag it explicitly** in your output rather than spec-ing it inline.

---

## 18. Tokens you must consume — never raw

- Type: `theme.type('displayM')`, `theme.type('headline')`, `theme.type('bodyL')`, etc.
- Spacing: `theme.spacing.{xs,s,m,l,xl,xxl,xxxl,xxxxl}`.
- Colour: `theme.colors.text.{primary,secondary,tertiary}`, `theme.colors.surface.{base,subtle,elevated,high,warmBase,warmSubtle,warmElevated}`, `theme.colors.brand.{primary,coral}`, `theme.colors.vital.{bp,hr,spo2,sleep,activity}`, `theme.colors.state.{success,warning,urgent}`.
- Radii: `theme.radii.{s,m,l,xl,xxl}`.
- Elevation: `theme.elevation.{none,low,medium,high,glass}`.
- Min tap target: `theme.minTapTarget` (auto-scales for parent mode).

Light-mode amber issue: `brand.primary` is `#E8A063` and fails 3:1 contrast on linen surfaces. Designer review is open per `memory/d12_light_mode_amber_contrast.md`. If your Trends v2 narrative uses brand.primary as accent text on light mode, flag this in your output. Don't pick your own colour.

---

## 19. Acceptance for this brief

Your output should include, in this order:

1. Annotated layout (top → bottom), every slot named, every component identified.
2. Full state matrix (default · loading · empty · sub-week · paywalled-range · expansion-open · error-data-fetch). The cascade guarantees no "AI error" state — do not draft one.
3. Every authored string, in a single list, in author/copy form. Founder will run them through `lintVoiceText()`.
4. **Open questions** — anything you need from the founder to ship cleanly. Lead with what's blocking, not what's nice-to-have.
5. **Component requests** — any new component you'd need that isn't in §17. Flag explicitly with a one-line justification per item.

---

## 20. Anti-overreach checklist (read before you start)

- ☐ I have not redesigned the Daily Pulse hero.
- ☐ I have not redesigned the vital detail screens.
- ☐ I have not added a bookmark mechanic.
- ☐ I have not added new correlation types.
- ☐ I have not invented new colour tokens.
- ☐ I have not used a forbidden vocabulary word.
- ☐ I have not paywalled the 7d range, the latest reading, or the focal chart.
- ☐ I have not promoted the doctor PDF onto Trends.
- ☐ I have flagged any required new component in §19.5 instead of spec-ing it inline.
- ☐ I have flagged the light-mode amber contrast issue if my design uses `brand.primary` on light.
- ☐ I have not drafted an "AI error" state — the cascade prevents one.

---

*End of brief. Companion brief: `plans/for-your-doctor-design-brief.md`.*
