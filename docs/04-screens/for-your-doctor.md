# Screen — For Your Doctor

The single-job "cover letter" surface: generate a doctor-shareable PDF
of the last N days of the five vitals, then hand it to the OS share
sheet. The PDF-export flow that once lived on Trends now lives here;
Trends only carries an inline link in.

Sourced from the shipped code (this doc documents what the code does):
- Screen — `apps/mobile/src/screens/ForYourDoctor/ForYourDoctorScreen.tsx`
- Range chips — `apps/mobile/src/screens/ForYourDoctor/ForYourDoctorRangeChipsRow.tsx`
- Mobile PDF client — `apps/mobile/src/services/doctorPdf.ts`
- Draft persistence (MMKV) — `apps/mobile/src/services/doctorPdfState.ts`
- Edge function (PDF render) — `supabase/functions/generate-doctor-pdf/`
  (`index.ts`, `template.ts`, `data.ts`)
- Edge function (AI sections) — `supabase/functions/generate-doctor-prep-ai/index.ts`

Voice rules: `docs/05-voice-and-claims.md`. Related: the Trends export
sheet and PDF cover variants in `docs/04-screens/trends.md`.

---

## Purpose

Produce a clinical-but-premium PDF a doctor can scan in a minute, from
the wearer's recent five-vital history, and share it. Descriptive only —
never a diagnosis, never a recommendation.

## Audience

- Caregiver (sharing a parent's data — title and subtitle name the
  parent; adds "Include caregiver comments")
- Self-buyer (sharing their own data — second-person copy)

`account_type` comes from `useAuth().profile`, defaulting to
`self_buyer`. The screen forks copy, the caregiver-only comments toggle,
and which name prints on the PDF cover.

## When reached

- The dedicated `ForYourDoctor` route (caregiver and self-buyer stacks),
  reached from the inline "Share with your doctor" link on Trends v2 and
  from reading-detail "Share with doctor".
- May be entered with a `route.params.range` deep-link carried from
  Trends; `pdfRangeFromTrendsRange` maps `all_time` (no PDF analogue)
  down to the tier default (`7d` free / `30d` Plus).

---

## Layout (top → bottom)

| Element | Spec |
| --- | --- |
| Header | Back chevron (SVG) + **"Back"** label, and a right-aligned eyebrow **"Leiko · Share"** in `brand.primary` mono-uppercase. |
| Title block | `editorial` 32pt — **"For your "** + italic `brand.primary` **"doctor"** + **"."**. Caregiver variant reads **"For {parent}'s doctor."**. Below it, an italic-serif subtitle (see Voice). |
| Range eyebrow | Mono-uppercase **"Cover the last"** (`testID fyd-range-eyebrow`). |
| Range chips | `ForYourDoctorRangeChipsRow` — `7D · 30D · 90D · 1Y`. `7D` free; the rest are Plus-locked with a "Plus" pip; tapping a locked chip raises the paywall. |
| Preview card | `DoctorCoverPreview` — prepared-for name, range + date-range labels, a BP sparkline, and a free-user variant. Overlaid "**{n} pages · PDF**" tag + footnote **"Cover · Vitals · Cross-vital observations"**. |
| Baseline reference | `BaselineReference` — local 30-day BP p10–p90 band, when computable. Caption "over the last {n} readings". |
| Cover note field | `DoctorNoteField` — optional free-text cover-page line. Draft persisted to MMKV. |
| Clinical context fields | `ClinicalContextFields` — optional structured medications / symptoms / target-BP inputs (Sprint 19 PDF v2). Each persists to MMKV independently. |
| Options block | `ListRow` toggles: **"Include notes"** (sub: "The lines you wrote on individual readings"); caregiver-only **"Include caregiver comments"** (sub: "Anything you noted from your visits"). Both default on. |
| Generate CTA | Primary `Button`. Free → paywall. Plus → generates + opens share sheet. Label shifts by phase (see States). Sub-caption varies (see below). |
| Last-generated re-share | When a prior successful generation exists: a tappable line "{formatted last-generated} · Re-share most recent". |

The page count is **projected client-side** by `projectedPageCount`
(`doctorPdf.ts`): cover + one page per vital with ≥3 entries + a
cross-vital page (when ≥2 vital sections or any correlation) + disclaimer,
minimum 2.

---

## Range chips (paywall lever)

`ForYourDoctorRangeChipsRow` mirrors the Trends chips:

| Chip | Free | Plus |
| --- | --- | --- |
| 7D | Selectable, default | Selectable |
| 30D | Locked — tap raises paywall (`trigger="pdf_export"`) | Selectable, default |
| 90D | Locked → paywall | Selectable |
| 1Y | Locked → paywall | Selectable |

Locked chips render with a small "**Plus**" pip and
`accessibilityLabel="{label} (Plus only)"`, hint "Opens the Plus
paywall". The default range is `30d` for Plus, `7d` for free (overridden
by any deep-linked range). `onRangeTap` raises the paywall instead of
switching when a non-`7d` chip is tapped by a free user.

---

## Generate flow

`onGenerate` (`ForYourDoctorScreen.tsx`):

1. Not Plus → raise paywall, stop.
2. Offline → set `error` phase (no request fired). The CTA is also
   `disabled` while Plus + offline — defence-in-depth.
3. Missing `familyId`/`userId` → `error` phase.
4. Otherwise: track `doctor_pdf_requested`, enter `generating`, call
   `generateDoctorPdf(...)` (`doctorPdf.ts` → `generate-doctor-pdf`
   edge function) with range, the two include-toggles, the cover note,
   and the clinical-context fields.

Result handling:

| `DoctorPdfResult` | Behaviour |
| --- | --- |
| `ok` | Track `doctor_pdf_generated`; persist last-generated to MMKV; open `Share.share(...)` with a platform-aware payload (`buildSharePayload`: iOS uses `url`; Android appends the URL into `message` because RN ignores `url` on Android); return to `default`. |
| `mock` (dev rasterizer) | Track generated; show the **"Sandbox: HTML logged for the dev build."** toast; return to `default`. |
| `error` | Track `doctor_pdf_failed`; enter `error` phase. |

`generateDoctorPdf` never throws — it returns a discriminated union and
enforces a 30s client timeout. PHI never enters analytics; events carry
counts/outcomes only.

The cover note + medications/symptoms/target-BP are sent only when
non-empty; the edge function caps them server-side (300/300/300/60 chars)
and tolerates unknown fields, so older function versions ignore them.

---

## AI tier routing (server-side, inside the PDF)

The mobile client does **not** call any AI tier directly. The
`generate-doctor-pdf` edge function calls `generate-doctor-prep-ai`
(with the caller's JWT) to produce two optional narrative slots that
thread into the PDF template:

- **Cover paragraph** — Tier B (Haiku 4.5, `claude-haiku-4-5-20251001`),
  2–3 clinical-but-not-pathologising sentences.
- **Cross-vital observations** — prefers a cached `monthly_baseline`
  (≤7 days old); otherwise generates fresh, using Tier C
  (Sonnet 4.6, `claude-sonnet-4-6`) when `AI_TIER_C_PROD_DATA_ENABLED`,
  else Tier B.

Both pass the two-layer output guard (regex + cosine) with retry, are
cached to `ai_narration_cache`, and are audit-logged (`action='ai.doctor_prep'`)
per `docs/07-ai-assistant.md` §9. The AI is **Plus-gated**: free callers
get `paywall_required`. Any AI failure (no key, paywall, upstream error)
cascades to **no-AI rendering** — the deterministic PDF content always
ships (`fetchAiSections` returns `{ cover: null, observations: null }`
on any non-ok). PHI is scrubbed before any Anthropic egress
(`assertScrubbed`).

---

## The generated PDF (edge function)

`generate-doctor-pdf/template.ts` renders these sections in order:
**cover · bp · hr · spo2 · sleep · activity · cross-vital · notes**.
The cover carries an always-rendered executive-summary tile, the optional
AI cover paragraph, the optional clinical-context block, the optional
"From {name}" cover note, and the account-type cover line. The function
validates the caller's JWT, confirms both caller and target are family
members, fetches data with the service role, rasterizes the HTML, uploads
to Storage, and returns a 1-hour signed URL. A `__MOCK__` rasterizer
seam returns the raw HTML for tests (surfaced as `status: 'mock'`).

PDF cover line (`coverLine`, `template.ts`) — both variants pass the
voice gate:

- Caregiver: *"This report is general information from {parent}'s Leiko
  watch. It is not a diagnosis. Please discuss with their doctor."*
- Self-buyer: *"This report is general information from your Leiko watch.
  It is not a diagnosis. Please discuss with your doctor."*

> Note: "It is not a diagnosis" is a factual disclaimer (not a claim the
> app diagnoses), so it passes — the forbidden term is the *act* of
> diagnosing, which this sentence explicitly disclaims. Consistent with
> the cover-line variants already approved in `docs/04-screens/trends.md`.

---

## States

`Phase = 'default' | 'generating' | 'error'`, plus empty and offline
overlays:

| State | Visual |
| --- | --- |
| `default` | Full layout; CTA reads **"Generate PDF"**. |
| `generating` | CTA `loading`, reads **"Putting your report together…"**. |
| `error` | CTA reads **"Try again"**; an `ErrorState` shows **"We couldn't put it together just now."** + a fix line ("Tap the button above to try again." or, offline, the offline hint). |
| `empty` | See below — range/preview/options/CTA hidden. |
| `offline` (Plus) | CTA disabled; sub-caption **"Offline · we'll generate this once you're back online."**; hint "Disabled while offline." |
| `paywalled` (free) | Range-locked chips + CTA raise `PaywallSheet` (`trigger="pdf_export"`); sub-caption **"Plus unlocks 30 days and beyond"**. |

CTA sub-caption by tier/state: free → "Plus unlocks 30 days and beyond";
Plus offline → offline line; Plus online → **"Opens your share sheet —
mail, messages, files."**

### Empty state

Driven by `hasAnyVitalData` — true if **any** of the five vitals has ≥3
entries in the window (not BP-only). When data has loaded and nothing
qualifies, the screen renders `EmptyState` (`testID fyd-empty`) and
hides the range block, preview, options, and CTA:

| Element | Value |
| --- | --- |
| Title | "No readings to share yet" |
| Body | "Take a few readings this week and they'll appear here." |
| CTA | (none) |

---

## Voice (verified against `docs/05-voice-and-claims.md`)

Strings quoted verbatim from `FYD_STRINGS` and the title/subtitle
composers in `ForYourDoctorScreen.tsx`, and `coverLine` in `template.ts`.
**All pass** — no "patient", no "diagnose/treat/predict/prevent" as a
claim, no fear language, no outcome promises.

| String | Voice |
| --- | --- |
| Eyebrow "Leiko · Share" | PASS |
| Title "For your doctor." / "For {parent}'s doctor." | PASS |
| Subtitle (self) "A summary of your last {range} of readings, in a format your doctor can scan in a minute." | PASS (plain, calm, "your doctor") |
| Subtitle (caregiver) "A summary of {parent}'s last {range} of readings, in a format the doctor can scan in a minute." | PASS (names the parent, no pronoun pile-up) |
| Range eyebrow "Cover the last" | PASS |
| PDF footnote "Cover · Vitals · Cross-vital observations" | PASS |
| "Include notes" / "The lines you wrote on individual readings" | PASS |
| "Include caregiver comments" / "Anything you noted from your visits" | PASS |
| "Generate PDF" / "Putting your report together…" / "Try again" | PASS |
| "Re-share most recent" | PASS |
| Error "We couldn't put it together just now." | PASS (names the cause, no stack trace, no blame) |
| Empty "No readings to share yet" / "Take a few readings this week and they'll appear here." | PASS (Reassuring; explains what will happen) |
| Offline "We need a connection to put this together." / "Offline · we'll generate this once you're back online." | PASS |
| "Plus unlocks 30 days and beyond" | PASS |
| "Opens your share sheet — mail, messages, files." | PASS |
| "Sandbox: HTML logged for the dev build." | dev-only, not user-facing in prod |
| PDF cover lines (both variants) | PASS (see PDF note above) |

The two AI-narrative slots are governed server-side by the
non-overrideable system prompt + output guard before they ever reach the
PDF (`generate-doctor-prep-ai`), so AI prose is voice-bounded the same
way Tier B/C is elsewhere.

---

## Accessibility

- Back: `accessibilityRole="button"`, label "Back".
- Title + (in EmptyState) headline use `accessibilityRole="header"`.
- Range chips: selectable chips via `Pill`; locked chips are
  `accessibilityRole="button"` with "(Plus only)" label + paywall hint.
- Generate CTA: `accessibilityHint` adapts — generates/opens share, is
  disabled while offline, or opens the paywall, by tier/state.
- Re-share line: `accessibilityRole="button"`, label "{last-generated}.
  Tap to re-share."

---

## Anti-patterns (CLAUDE.md)

- **Don't paywall the 7-day range.** `7D` is always free; only longer
  ranges and the AI narrative are Plus.
- **Never surface a raw error or stack trace.** Failures land on the
  calm `ErrorState`; AI failures cascade silently to a no-AI PDF.
- **No PHI in analytics.** Telemetry carries range, bytes, and outcomes
  only.
- **Descriptive, never diagnostic.** The PDF (and its AI prose) describe
  data and defer to the doctor; the cover line states it is not a
  diagnosis.
