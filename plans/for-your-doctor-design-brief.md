# Design Brief — "For your doctor" screen

**Audience:** the design AI. This document is self-contained — you have not seen the conversation that produced it. Read everything below before producing layout.

**Status:** brief. Once your output is approved, `docs/04-screens/for-your-doctor.md` will be added.

**Companion brief:** `plans/trends-v2-design-brief.md` covers the Trends v2 redesign that *removes* the doctor-PDF flow and moves it to this new screen. The two screens ship as a pair; design them as a pair.

**Date:** 2026-05-12.

---

## 1. Context you must respect

Leiko is a caregiver-mode (and self-buyer-mode) blood-pressure monitoring app built on a Urion U16 family BP smartwatch. It tracks five vitals — BP, HR, SpO2, sleep, activity — and surfaces them as an "ambient pulse intelligence" product. The brand promise (D11) is **Apple-of-Healthcare**: calm, premium, AI-led but voice-rule clean.

Two markets: Nigeria and the United States. Three personas: caregiver (default), self-buyer, parent (large-text read-only). Parent mode does NOT see this screen at all in v1.0.

The doctor-PDF lives at the centre of the paywall lever per D8a §9 — it is the primary reason a self-buyer subscribes to Plus. Do not soften the paywall; do not give the free tier the actual PDF; do not preview real data behind the lever.

**What we've already shipped that informs this redesign:**
- Trends v1 with the doctor-PDF CTA + paywall sheet (Sprint 9 — the flow you're porting)
- `generate-doctor-pdf` Edge Function — emits the PDF data + 7 sections per D13 §10.2 (cover · BP · HR · SpO2 · Sleep · Activity · cross-vital observations · notes)
- `<PaywallSheet>` component + `PaywallTrigger` type with `pdf_export` value
- Offline + error state primitives: `<EmptyState>`, `<ErrorState>`, `<LoadingState>`, `<OfflineBanner>` (Sprint 16)

**Open ops dependency (NOT your concern):** the rasterizer vendor pick is still open per Sprint 9 close-out (`memory/sprint_9_followups.md`). Engineering will resolve it independently. Design as if the export works — the screen's UX must be ready when the rasterizer lands.

**Do not invent components or tokens that aren't already in `apps/mobile/src/components/` or `apps/mobile/src/theme/tokens/`.** If you need a new one, flag it.

---

## 2. Voice & visual anchors

**Voice — non-negotiable.** Read `docs/05-voice-and-claims.md` + D11 §3 (in `docs/_reference/D11-brand-repositioning.md`) end-to-end. Highlights:

- Forbidden words include: `patient`, `diagnose`, `treat`, `cure`, `predict`, `prevent` (when applied to disease), `silent killer`, `ticking time bomb`, `dangerous level`, `critical level`, `medical advice`, `loved ones`, `you should/must/need to`, `optimise`, `biohack`, `streak`, `smart [feature]`, `simple/easy/just` (soft warning), `insights` (soft — prefer "patterns").
- Preferred patterns: lead with the answer, plain language before clinical terms, *"Talk to your doctor"* (never *"consult a healthcare provider"*), calm and dignified.
- This screen has a clinical handoff vibe but still must avoid clinical-distancing language and outcome promises. *"It is not a diagnosis"* is mandatory cover-line copy per D11 §3 + the PDF disclaimer requirements.
- Every user-visible string in your output must pass `services/voice/voiceLint.ts`. Component tests fail if hard-fail vocabulary appears.

**Visual — non-negotiable.** Read `docs/_reference/D12-visual-system-v2.md`. Highlights:

- Tokens live in `apps/mobile/src/theme/tokens/`. Consume via `useTheme()` — never raw palette.
- Card elevation system: `default | low | medium | high | glass`. Mode-aware via `theme.elevation`. The preview thumbnail card should sit at `medium` — it's the visual centerpiece.
- Spacing scale from `theme.spacing`; radii from `theme.radii`; type from `theme.type(token)`.
- Light-mode amber known issue: `#E8A063` on linen fails 3:1 contrast; designer review open. Mention this in any light-mode rendering choice.

**Anti-patterns (CLAUDE.md):**
- No fear-based push or banners.
- No urgency framing on the screen — *"Take this to your doctor before…"* fails voice-lint.
- No count badges, no "new" dots.
- Empty state on every screen.
- Calm-before-clever animation.

---

## 3. Strategic decisions already made (do not relitigate)

These came out of a founder ↔ engineer agreement before this brief was written. Treat them as fixed inputs.

1. **The screen name is "For your doctor"** (self-buyer) / **"For their doctor"** (caregiver). Specifically NOT "Share with your doctor" (action label, not destination), NOT "Doctor prep" (pushy), NOT "Doctor report" (clinical, not premium). The Settings entry-point row uses the same label.
2. **v1.0 scope = today's PDF flow ported into this new location.** Nothing more. Specifically excluded from v1.0:
   - No bookmarked-readings ("Include in your next doctor visit" affordance on Reading Detail) — out of scope.
   - No history view (list of previously generated PDFs) — out of scope.
   - Personal-note free-text field is a **stretch** goal. If it lands cleanly in your visual hierarchy without adding scope or competing with the primary CTA, keep it. If it doesn't, cut it.
3. **Plus paywall is the lever.** Free users see the screen but cannot generate. The preview thumbnail is static for free users (no real data leaks through).
4. **Parent mode does not see this screen.** Large-text mode does not own a doctor-prep flow in v1.0.
5. **The doctor PDF rasterizer is an open ops dependency** (Sprint 9 close-out). Design as if it works. Engineering will resolve in parallel.

---

## 4. Purpose

Generate a doctor-shareable PDF that captures the user's recent five-vital pattern in clinical-but-premium typesetting. Single job per screen.

---

## 5. Audience

- Self-buyer (their own PDF) — *"For your doctor"*
- Caregiver (their parent's PDF — cover page and pronoun shift accordingly) — *"For their doctor"*
- Parent mode is excluded from v1.0 entirely

---

## 6. Scope (v1.0)

**Port today's PDF generation flow into this new location. No new features beyond relocation.**

What's IN:
- Range selector (matches the Trends range chips: `7D` / `30D` / `90D` / `1Y`)
- Two checkboxes: "Include notes" / "Include caregiver comments" (caregiver only)
- Cover thumbnail + page count preview
- Generate + share via OS share sheet
- All 7 PDF sections per D13 §10.2 (cover · BP · HR · SpO2 · Sleep · Activity · cross-vital observations · notes)
- Plus paywall: free users tapping "Generate PDF" → paywall sheet rises

What's OUT (deferred to v1.1):
- Bookmarked readings ("Include in your next doctor visit" affordance on Reading Detail). Not v1.0.
- History view (list of previously generated PDFs). Not v1.0.
- Personal-note field on the cover page. **Stretch only** — if you can land it cleanly in the visual hierarchy without adding scope or competing with the primary CTA, fine; if it competes, cut it.

---

## 7. Entry points (engineering scope, not your design)

Engineering will wire:
- **Settings → "For your doctor"** (primary). A row in a new "Share" section, sitting between "Family members" and "Caregiver visibility".
- **Inline link from Trends v2 narrative** (secondary). Soft single-line link: *"Want to put this together for your doctor?"* (caregiver: *"Want to put this together for their doctor?"*). Carries the current Trends range as a deep-link param.

That's the v1.0 list. Other potential entry points (anomaly aftermath, Reading Detail bookmark, Ask Leiko handoff) are deferred to v1.1.

When the user arrives via the Trends inline link, the range chip on this screen should pre-select to whatever was active on Trends. When the user arrives via Settings, the range defaults to 7d (free) or 30d (Plus).

---

## 8. Layout direction (top → bottom)

You decide the precise composition; here is the hierarchy + required slots.

1. **Header** — back chevron + `type.headline` **"For your doctor"** (self-buyer) / **"For their doctor"** (caregiver). Note the screen-name choice: "for", not "share with" — see §2 voice notes and §3 decision #1.
2. **Sub-header narrative line** — *one short sentence* that reads as a calm cover-letter intro. Pattern: *"A summary of your last {range} of readings, in a format your doctor can scan in a minute."* Tier-A template — no LLM needed for this single line. Voice-clean.
3. **Range selector** — same `Pill` chips as Trends (`7D` · `30D` · `90D` · `1Y`). Default to the range carried in the deep-link param when arriving from Trends; otherwise 7d (free) or 30d (Plus).
4. **Preview card** — cover-page thumbnail (rendered from a static template you design) + page count. Visual centerpiece of the screen. The preview *previews*; it does not need to be pixel-perfect to the final PDF — a low-fidelity placeholder representing the cover layout is fine. For free users, the thumbnail is static / generic (no real data preview — that would burn the paywall lever).
5. **Options block** — two checkboxes:
   - "Include notes" (default on)
   - "Include caregiver comments" — caregiver mode only (default on)
6. **Primary CTA — "Generate PDF"** — full-width `button.primary`. Free-tier tap → paywall sheet. Plus-tier tap → loading state → OS share sheet opens with the file.
7. **Secondary action** — `button.ghost` "Cancel" or a back-chevron tap — return to wherever the user came from.

**STRETCH — only if it lands cleanly:** a small free-text note field above the options block. Copy: *"Anything on your mind for this visit?"* Single-line input that expands. Included on the cover page of the PDF if filled. If you can't land it without adding scope or competing with the CTA, cut it from your output.

---

## 9. Empty / loading / error / offline states

- **Empty (no readings to export)** — `<EmptyState title="No readings to share yet" body="Take a few readings this week and they'll appear here." />`. Hide the preview + options + CTA. Range chips can remain or hide — your call, but I lean toward hiding them since there's nothing to scope.
- **Loading (PDF generating)** — `<LoadingState caption="Putting your report together." />` overlays the screen with a calm caption. Voice-clean. Could be a modal overlay or an in-place state — your call.
- **Error (PDF generation fails)** — `<ErrorState onRetry={...} />` in the preview slot. The retry attempts regeneration. The user is never told "the AI failed" — only "we couldn't put it together just now". The cascade philosophy applies even to non-AI generation failures.
- **Offline** — `<OfflineBanner>` is globally mounted. PDF generation requires network; on tap with no network, render the same error state with a one-line caption: *"We need a connection to put this together."*
- **Paywalled (free user tapping Generate)** — `<PaywallSheet>` rises with trigger `pdf_export`. Existing component; no design needed.

---

## 10. Voice — why "For your doctor"

The screen name is **"For your doctor"** (caregiver: **"For their doctor"**). Specifically NOT:

- "Share with your doctor" — that's an action label, not a destination. Reserve it for the export CTA *inside* the screen if you prefer — though "Generate PDF" is the v1.0 button copy.
- "Doctor prep" — accurate but pushy. Leiko's voice doesn't tell the user to "prep".
- "Doctor report" — clinical, not premium.

Settings row uses the same label: **"For your doctor"** / **"For their doctor"**.

---

## 11. Voice gate (For your doctor strings)

**Inherited from Trends v1 (do not change):**

- PDF cover line, caregiver: *"This report is general information from {parent_name}'s Leiko watch. It is not a diagnosis. Please discuss with their doctor."*
- PDF cover line, self-buyer: *"This report is general information from your Leiko watch. It is not a diagnosis. Please discuss with your doctor."*
- Options copy: "Include notes" / "Include caregiver comments"

**Strings YOU author:**

- Sub-header narrative line (§8 #2)
- Empty state title + body
- Loading caption
- Error state title + body
- Any preview-card chrome (page count display, "PDF" label, etc.)
- Primary CTA label (keep "Generate PDF" unless you have a strong reason)
- Stretch note-field placeholder copy (if you keep the stretch field)

All must pass `lintVoiceText()`.

---

## 12. Paywall posture

- Free users see the full screen — header, sub-header, range chips, preview thumbnail, options. The "Generate PDF" CTA opens the paywall sheet on tap.
- The preview thumbnail is **static / generic** for free users — no real data preview. Real data preview is a Plus-only render.
- D8a §9 confirms: the PDF is THE lead paywall trigger for self-buyer mode. Don't soften it.

---

## 13. Acceptance criteria

- Settings → "For your doctor" navigates to the screen.
- Trends v2 → "Want to put this together for your doctor?" inline link navigates with the current range pre-selected.
- Range chip changes update the preview's range label (no re-render of the thumbnail required for v1.0).
- "Generate PDF" on Plus → generation flow → OS share sheet opens.
- "Generate PDF" on free → `<PaywallSheet>` rises with trigger `pdf_export`.
- All 7 PDF sections present per D13 §10.2.
- Cover line passes voice gate in both `account_type` variants.
- Empty / loading / error / offline states use Sprint 16 components.
- Voice-rule clean on every authored string.
- Snapshot tests for: default-self-buyer, default-caregiver, empty, generating, paywalled, offline.

---

## 14. Anti-patterns specific to "For your doctor"

- No history view. No previously-generated list. Out of scope.
- No bookmark mechanic. Out of scope.
- No personal-note free-text field unless it lands cleanly. Stretch only.
- No "Share to email" / "Share to message" sub-flows. The OS share sheet handles routing; we don't pre-select.
- No urgency framing on the screen — *"Take this to your doctor before…"* fails voice-lint.
- No real data preview behind the paywall — burns the lever.
- No AI narrative paragraph on this screen — that's Trends's job. This screen is calm, deliberate, doctor-handoff.
- No tab for "For your doctor" — it's a screen, not a tab. Tabs are for daily-use surfaces.

---

## 15. Component inventory — compose from these, do not invent

Reusable components you can compose:

- `<EmptyState>` `<ErrorState>` `<LoadingState>` (Sprint 16)
- `<OfflineBanner>` (Sprint 16, globally mounted)
- `<Card>` with elevation variants (`default | low | medium | high | glass`)
- `<Button>` variants (`primary | accent | secondary | ghost | destructive`)
- `<Pill>` (range chips)
- `<PaywallSheet>` (existing; trigger via `pdf_export`)
- `<ListRow>` (for the options block checkboxes — already supports `accessory` + check state)
- `<SettingsSection>` (only for the Settings entry-point row, not for this screen itself)

If you need a new component (e.g. a dedicated PDF preview thumbnail), **flag it explicitly** in your output rather than spec-ing it inline.

---

## 16. Tokens you must consume — never raw

- Type: `theme.type('displayM')`, `theme.type('headline')`, `theme.type('bodyL')`, etc.
- Spacing: `theme.spacing.{xs,s,m,l,xl,xxl,xxxl,xxxxl}`.
- Colour: `theme.colors.text.{primary,secondary,tertiary}`, `theme.colors.surface.{base,subtle,elevated,high,warmBase,warmSubtle,warmElevated}`, `theme.colors.brand.{primary,coral}`, `theme.colors.state.{success,warning,urgent}`.
- Radii: `theme.radii.{s,m,l,xl,xxl}`.
- Elevation: `theme.elevation.{none,low,medium,high,glass}`.
- Min tap target: `theme.minTapTarget`.

Light-mode amber issue: `brand.primary` is `#E8A063` and fails 3:1 contrast on linen surfaces. Designer review is open per `memory/d12_light_mode_amber_contrast.md`. If your design uses brand.primary as accent text on light mode, flag this in your output. Don't pick your own colour.

---

## 17. Acceptance for this brief

Your output should include, in this order:

1. Annotated layout (top → bottom), every slot named, every component identified.
2. Full state matrix (default-self-buyer · default-caregiver · empty · generating · error · paywalled · offline).
3. Every authored string, in a single list, in author/copy form. Founder will run them through `lintVoiceText()`.
4. **Explicit verdict on the stretch note field** — kept or cut? If kept, where it lands; if cut, why.
5. **Open questions** — anything you need from the founder to ship cleanly. Lead with what's blocking, not what's nice-to-have.
6. **Component requests** — any new component you'd need that isn't in §15. Flag explicitly with a one-line justification per item.

---

## 18. Anti-overreach checklist (read before you start)

- ☐ I have not added a bookmark mechanic.
- ☐ I have not added a history view.
- ☐ I have not added a personal-note free-text field unless it lands cleanly (and I've explicitly stated my verdict in §17.4).
- ☐ I have not invented new colour tokens.
- ☐ I have not used a forbidden vocabulary word.
- ☐ I have not added a tab for this screen — it's a screen, not a tab.
- ☐ I have not given free users real-data preview behind the paywall.
- ☐ I have not added an AI narrative paragraph (that's Trends's job).
- ☐ I have not framed the screen with urgency or fear.
- ☐ I have flagged any required new component in §17.6 instead of spec-ing it inline.
- ☐ I have flagged the light-mode amber contrast issue if my design uses `brand.primary` on light.

---

*End of brief. Companion brief: `plans/trends-v2-design-brief.md`.*
