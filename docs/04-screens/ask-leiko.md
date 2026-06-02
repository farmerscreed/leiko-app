# Screen — Ask Leiko

The conversational AI assistant surface. A single-shot question box: the user
types one plain-language question, taps Send, and reads one answer. Multi-turn
chat is intentionally not built (see "Out of scope").

Sourced from the shipped code (this doc documents what the code does, not the
roadmap):
- Route screen — `apps/mobile/src/screens/AskLeiko/AskLeikoScreen.tsx`
- Reusable body (input + classification + render) —
  `apps/mobile/src/components/AskLeikoBody.tsx`
- Response renderer — `apps/mobile/src/components/AIResponseRenderer.tsx`
- Tier-A router — `apps/mobile/src/services/ai/intentRouter.ts`,
  `apps/mobile/src/services/ai/intents.ts`
- DEFER templates — `apps/mobile/src/services/ai/deferTemplates.ts`
- Tier-B client — `apps/mobile/src/services/ai/tierB.ts`
- Fall-through cascade — `apps/mobile/src/services/ai/fallThrough.ts`
- Placeholder text — `apps/mobile/src/services/ai/tierBPlaceholder.ts`

Tier architecture reference: `docs/07-ai-assistant.md`. Voice rules:
`docs/05-voice-and-claims.md`.

> **Tier A is a client-side deterministic intent-router, not a local LLM.**
> Per `docs/07-ai-assistant.md` (flagged 2026-06-02), the Ollama/Llama local
> tier is planned but not shipped. In this screen, "Tier A" = the regex intent
> router in `services/ai/`. Tier B = Haiku (edge function `ai-tier-b`), Tier C
> is not invoked from this surface.

---

## Audience

- Self-buyer (asking about their own readings)
- Caregiver (asking about a parent's readings)

The screen copy itself is account-type-agnostic — there is no caregiver vs
self-buyer fork in `AskLeikoBody`. The Tier-B edge function applies the
account-type-aware voice server-side; the shipped local templates use neutral
second-person ("you", "your").

---

## Purpose

Answer one plain-language question about blood pressure, the other vitals, the
readings, or the app — and, for anything that is medication / symptom /
diagnosis / out-of-scope territory, calmly hand the question back to the user's
doctor rather than attempt an answer.

---

## When reached

- The full-screen route `AskLeiko` — reached from Settings / Learn deep links
  (`AskLeikoScreen.tsx` header comment).
- The same `AskLeikoBody` is reused inside the home-screen bottom-sheet popup
  (`AskLeikoSheet`), so this layout also renders there.

---

## Layout (top → bottom)

Route chrome (`AskLeikoScreen.tsx`):

| Element | Spec |
| --- | --- |
| Back link | `Pressable` text "Back" in `brand.primary`, top-left (`testID ask-leiko-back`). Calls `navigation.goBack()`. |
| Header | `type displayM` headline **"Ask Leiko"** (`accessibilityRole="header"`). |
| Body | `<AskLeikoBody onArticleOpen={…}/>` — EDUCATE card taps navigate to `Article` with `articleId`. |

Body (`AskLeikoBody.tsx`, strings in `ASK_LEIKO_COPY`):

| Element | Spec |
| --- | --- |
| Helper line | "A short, plain-language question works best." (`text.secondary`). |
| Question input | Multiline `TextInput`, placeholder **"What is blood pressure?"**, `accessibilityLabel="Type your question"` (`testID ask-leiko-input`). |
| Send button | `Pressable` labelled **"Send"** (`accessibilityLabel="Send question"`, `testID ask-leiko-send`). Disabled — `brand.primary` → `warmSubtle` — while the trimmed input is empty. |
| Result block | Rendered only after a submit. Eyebrow **"You asked"** (`caption`, `allowFontScaling={false}`) + the submitted question in italic, then the tier-appropriate response (see States). |

---

## Behaviour / AI tier routing

On Send (`onSubmit`), the trimmed question is classified by
`classifyIntent` (`intentRouter.ts`). The router walks `INTENTS`
(`intents.ts`) in declared order — OOS and DEFER intents are placed first so a
medication/symptom question shortcuts before broader FAQ patterns. The first
matching regex wins; no match returns `responseMode: 'TIER_B_PLACEHOLDER'`.

| Router result | What renders | Tier |
| --- | --- | --- |
| `ANSWER` | `intent.answerTemplate` verbatim (troubleshoot + how-to intents) | Tier A, no network |
| `EDUCATE` | Lead-in line + tappable Learn card link (card title from `ARTICLES_BY_ID[cardId]`) | Tier A, no network |
| `DEFER` | `DEFER_TEMPLATES[intent.deferTrigger]` | Tier A, no network |
| `TIER_B_PLACEHOLDER` (no local match) | Calls `askTierB({ question })` → Haiku via the `ai-tier-b` edge function | Tier B |

The full intent registry (`intents.ts`) is the source of truth for what Tier A
can answer locally. Categories: `faq`, `reading`, `pattern`, `troubleshoot`,
`how-to`, `defer`, `oos`. ANSWER copy lives only on `troubleshoot.*` and
`how-to.*` intents (device/sync/app-feature answers); FAQ / reading / pattern
intents are EDUCATE and route to a Learn card.

### Tier-B fall-through (never show an AI error)

When Tier B is invoked, `askTierB` returns a discriminated union and never
throws (`tierB.ts`). `mapAskLeikoTierBResult` (`fallThrough.ts`) maps it:

- `ok` → render the body (`testID ask-leiko-tier-b-body`).
- `defer` → render `DEFER_TEMPLATES[trigger]`. The server's American
  `pediatric` trigger is translated to the mobile British `paediatric` key at
  the `tierB.ts` seam.
- `quota_exceeded` → render the quota copy.
- structural error (`no_family`, `no_session`/`unauthorized`,
  `question_too_long`) → render the matching fixable-error copy.
- any **soft** error (network, `client_timeout`, `invoke_failed`, unknown
  server response) → **silently** fall through to deterministic copy
  (`DETERMINISTIC_COPY.ask_leiko`), flagged `degraded`
  (`testID ask-leiko-tier-b-degraded`) and logged as
  `ai_degraded_fall_through`. The user never sees a raw AI error.

`askTierB` enforces a 12s client timeout so the "Thinking…" state can never
hang. PHI / answer bodies are never logged (`tierB.ts`, per CLAUDE.md / D14
§13).

---

## States

The result block is absent until the first submit. Once submitted, exactly one
of the following renders below "You asked" + the echoed question:

| State | Visual | Source |
| --- | --- | --- |
| `idle` (Tier-A answered) | `<AIResponseRenderer/>` renders ANSWER / EDUCATE / DEFER / placeholder | `AIResponseRenderer.tsx` |
| `loading` (Tier-B in flight) | Spinner + **"Thinking…"** (`testID ask-leiko-tier-b-loading`) | `AskLeikoBody.tsx` |
| `ok` | Tier-B body text (or deterministic degraded copy) | — |
| `defer` | DEFER template string | — |
| `quota_exceeded` | Quota copy (see below) | — |
| `error` (structural) | Fixable-error copy (see below) | — |

### Empty / first-impression state

There is **no separate empty-state component**. Before any question is
submitted, the surface is the helper line + the pre-filled placeholder
**"What is blood pressure?"** + a disabled Send button. The placeholder
doubles as the suggested first question.

> Note: the verified empty-state row for "AI assistant" in
> `docs/05-voice-and-claims.md` ("Ask anything about Mum's readings" /
> "Try: …") is **not** what the shipped `AskLeikoBody` renders. The code uses
> the helper-line + placeholder pattern above instead. Flagging the divergence
> for the doc owner — it is a copy mismatch, not a voice violation.

### TIER_B_PLACEHOLDER (Tier-A no-match, before Tier B replaces it)

`AIResponseRenderer` renders `TIER_B_PLACEHOLDER_TEXT`
(`tierBPlaceholder.ts`): "I'm not sure how to answer that yet — try
rephrasing." In the shipped `AskLeikoBody` flow this is short-lived — a
no-match immediately triggers the Tier-B call, so the user normally sees
"Thinking…" then the Tier-B (or deterministic) result rather than this string.

---

## User-visible copy (voice check)

All strings below were checked against `docs/05-voice-and-claims.md`. **All
pass** — no "patient", no "diagnose/treat/predict/prevent", no fear language,
no outcome promises; defers say "talk to your doctor" / "your doctor".

`ASK_LEIKO_COPY` (`AskLeikoBody.tsx`):

| Key | String | Voice |
| --- | --- | --- |
| header | "Ask Leiko" | pass |
| helper | "A short, plain-language question works best." | pass |
| placeholder | "What is blood pressure?" | pass |
| send | "Send" | pass |
| loading | "Thinking…" | pass |
| youAsked | "You asked" | pass |
| quotaExceeded | "You've used your AI questions for this month. They reset on the 1st." | pass |
| errorNoFamily | "Finish setting up Leiko first to ask questions." | pass |
| errorNoSession | "Sign in again to ask Leiko." | pass |
| errorQuestionTooLong | "That question is a bit long — try shortening it." | pass |

DEFER templates (`deferTemplates.ts`) — all pass; each routes to a doctor /
pharmacist / clinician or a crisis line:

| Trigger | String |
| --- | --- |
| medication | "Decisions about medication are best made with your doctor or pharmacist — they know what else you're taking and what's right for you." |
| symptom | "Symptoms can mean different things in different people. Worth a chat with your doctor about what you're feeling." |
| pregnancy | "Leiko isn't designed for pregnancy or for younger users — those situations need a clinician who can use the right monitor and the right thresholds." |
| paediatric | "Leiko isn't designed for younger users — those situations need a clinician who can use the right monitor and the right thresholds for a child." |
| mental_health_crisis | "This sounds heavy. If you're struggling, please reach out to a friend, family member, or local crisis line. You're not alone in this." |
| generic | "That's outside what I can help with. Your doctor is the right person for this one." |

Deterministic fall-through (`fallThrough.ts`, `DETERMINISTIC_COPY.ask_leiko`):
"I'm not sure I can answer that one. You might find more in Learn, or talk to
your doctor." — pass.

Tier-A placeholder (`tierBPlaceholder.ts`): "I'm not sure how to answer that
yet — try rephrasing." — pass.

EDUCATE default lead-in (`AIResponseRenderer.tsx`): "There's a card on this in
Learn — tap below to read it." — pass.

ANSWER templates (`intents.ts`, `troubleshoot.*` + `how-to.*`) are
device/sync/app-feature instructions (e.g. "Bring the watch close to the
phone…"). Spot-checked: no forbidden vocabulary, calm and instructional. Pass.

---

## Accessibility

- Header: `accessibilityRole="header"` on "Ask Leiko".
- Back: `accessibilityRole="button"`, label "Back".
- Input: `accessibilityLabel="Type your question"`.
- Send: `accessibilityRole="button"`, label "Send question".
- EDUCATE card link: `accessibilityRole="link"`, label "Open {card title}"
  (`AIResponseRenderer.tsx`).
- "You asked" eyebrow uses `allowFontScaling={false}` to hold the caption size.

---

## Out of scope (matches code, per `docs/07-ai-assistant.md` §10)

- Multi-turn conversation — the body is single-shot per submit; a new Send
  replaces the previous result (`AskLeikoBody.tsx` header comment).
- Voice input / output.
- Tier C is never called from this surface (Tier C is weekly summaries +
  doctor-prep narrative).
