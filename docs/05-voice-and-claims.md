# 05 — Voice and Claims

The CANONICAL voice document. Loaded by every screen sprint. Sourced from D5 §3 (voice pillars), D5 §6.4 (forbidden claims), D8 §6 (voice application — copy-lint rules).

> **The bar**: every user-visible string passes this file. The copy-lint test in CI enforces it. Failures **block merge**.

---

## The four voice pillars (D5 §3.3)

Every piece of copy — UX microcopy, push notifications, marketing creative, AI responses, App Store description, support emails — must pass all four.

### 1. WARM
Sound like a thoughtful family member, not a clinic. Use "we" and "you" liberally. Never use third-person clinical phrasing. Say "your mother", not "the wearer". Say "check on her" not "monitor her vitals".

- ✗ "Patient hypertension monitoring detected an anomaly."
- ✓ "Your mom's blood pressure was higher than usual today. Here's what you might want to know."

### 2. CALM
Never raise our voice. Never urgent unless something genuinely urgent is happening — and even then: clear, never panicky. Caregivers live in low-grade anxiety; we are the antidote, not a contributor.

- ✗ "⚠️ ALERT: BP CRITICALLY HIGH ⚠️"
- ✓ "Mom's reading is higher than her usual. We're suggesting she rest for 15 minutes and try again. Here's why this can happen."

### 3. PROACTIVE
Don't wait for the caregiver to check. Tell them what they need to know, when they need to know it. Patterns are explained, not just shown.

- ✗ Showing a graph and expecting the caregiver to interpret.
- ✓ "This week, Mom's BP averaged 138/86 — a little higher than the past month (133/82). Three of her morning readings happened before her medication time. You might want to check whether her pill schedule moved."

### 4. DIGNIFIED
Never patronise. Never say "simple" or "easy". Never use baby-talk for elders. The watch reports to the family, but the parent is in control of their own life.

- ✗ "Simple. Easy. Just for you!"
- ✓ "Designed to fit your morning. Whether it's 6:00am tea or 9:00am coffee, Leiko adapts to your rhythm."

---

## The three tones (D5 §3.5 + D8 §6.7 + D8a §12.1 self-buyer mapping)

Voice is consistent across the brand. Tone shifts by context. Self-buyer copy uses second-person consistently; caregiver copy uses third-person referring to a parent. Both are valid — they apply to different `account_types`.

### Tone A — Reassuring (default)
When everything is fine — daily summaries, weekly reports, normal readings, routine syncs.

| | Caregiver | Self-buyer |
| --- | --- | --- |
| Reassuring | "All calm this morning. 128/82, within Mum's usual range." | "All calm this morning. 128/82 — in your normal range." |
| Reassuring (full) | "Good morning. Mom's blood pressure was 124/79 this morning — right where she usually is." | "Good morning. Your reading was 124/79 — right where you usually are." |

### Tone B — Informative
When the user needs to understand something — pattern explanations, what a reading means, lifestyle context.

| | Caregiver | Self-buyer |
| --- | --- | --- |
| Informative | "Over the past two weeks, Mom's evening readings have been about 8 mmHg higher than her morning readings." | "Over the past two weeks, your evening readings have been about 8 mmHg higher than your morning readings." |
| Informative (general) | "BP changes through the day. Morning readings are usually higher." | "BP changes through the day. Morning readings are usually higher — yours often is." |

### Tone C — Calm-concerned
When something needs attention. Never panicky; never shrugging.

| | Caregiver | Self-buyer |
| --- | --- | --- |
| Calm-concerned | "We noticed something. Three of Dad's readings this week were higher than usual. Worth a chat." | "Worth a look. Three of your readings this week were higher than usual. Might be worth talking to your doctor." |

### Tone D — Direct (confirmed-urgent only)
Only when the anomaly engine has classified a reading as **confirmed-urgent** (see `docs/10-anomaly-logic.md`). Still calm, but the call to action is direct.

| | Caregiver | Self-buyer |
| --- | --- | --- |
| Direct | "Three high readings in the last hour. We recommend reaching out to Dad now." | "These last three readings are unusually high. We recommend talking to your doctor today." |

> **Routing rule**: at runtime, the recipient's `account_type` selects the variant. See `docs/11-push-notifications.md` §"Routing rule".

---

## Forbidden words and phrases

This list is the canonical input to the copy-lint hard-fail rules. Every string in `apps/mobile/src/i18n/**.{ts,json}` is scanned against it on every PR.

### HARD FAIL — never appears in any user-visible string

| Phrase | Why | Replacement pattern |
| --- | --- | --- |
| `patient`, `patients` | Clinical, distancing | "Mum" / "Dad" / "your parent" / "you" |
| `user` (in user-facing copy) | Per D8a §2.3 — depersonalising for self-buyer | "you" |
| `loved one` | Generic, emotionally flat, overused | Specific relationship: "your mom", "your dad", "your aunt" |
| `you may have`, `we detected`, `you are at risk` | D8a §2.3 — predictive / diagnostic language | "this reading is classified as Elevated using the AHA 2017 thresholds" — descriptive only |
| `take control of your hypertension` | D8a §3.4 — self-help cliché; brand voice is calmer | Use Reassuring or Informative tone |
| `don't wait`, `start today`, `you owe it to yourself` | D8a §3.4 — urgency in onboarding | Calm-before-clever: no urgency in onboarding |
| `smartwatch` (as primary product noun) | We are a caregiver platform that ships with a watch; the watch is incidental | "the wristband", "the device", "the watch", or just "Leiko" (verb-able) |
| `predict` (in disease context) | FDA enforcement risk; outside K141683 IFU | "helps you and your doctor see patterns over time" |
| `prevent` (in disease context) | Same | Same |
| `diagnose`, `diagnosis`, `diagnostic` | Diagnosis is a doctor's job | "measures your blood pressure" |
| `treat`, `treatment`, `cure` | Treatment is medical practice | "monitor", "track" |
| `medical advice` | We don't give it | "Talk to your doctor" |
| `medical-grade SpO2`, `clinical SpO2` | SpO2 is wellness-only on this device | "wellness oxygen estimate" |
| `continuous blood pressure monitoring` | Misleading: BP is on-demand, not continuous | "measure your BP whenever you want, and track trends over time" |
| `dangerous level`, `critical level` | Fear language | Use Tone C calm-concerned phrasing |
| `silent killer`, `ticking time bomb`, `before it's too late` | Fear language | Don't reach for these — write Reassuring or Informative copy instead |
| `replaces your doctor` | Brand-suicide claim | "supplement, never replace" |
| `AI Pulse Diagnosis`, `TCM diagnosis` | Urion's Chinese marketing copy; outside cleared IFU | Use AI-tier copy from `docs/07-ai-assistant.md` |
| Any phrase that promises an outcome | Clinical claim risk | Describe what the product *does*, not what it'll *cause* |

### HARD FAIL — formatting

| Rule | Why |
| --- | --- |
| Multiple `!!` exclamation marks | Tone violation |
| ALL CAPS WORDS in body copy | Shouts; conflicts with Calm pillar |
| Push notification body > 120 chars (iOS) or > 180 chars (Android) | Truncation breaks meaning |
| Empty translation in any non-English locale at build time | Hard fail at release; warning during dev |
| Title Case headlines (e.g. "Your Family Circle") | Soft warning — reviewer must justify |

### SOFT WARNING

| Rule | Why |
| --- | --- |
| Single `!` in body copy | Often unnecessary; flag for review |
| `simple`, `easy`, `just` | Often condescending; flag for review |
| `users`, `members` (where a personal pronoun would work) | Less warm |

---

## Preferred patterns

- **Lead with the answer.** First sentence resolves the question. Don't bury the lede.
- **Plain language before clinical terms.** "The first number" before "systolic". "How fast your heart beats" before "pulse".
- **"Talk to your doctor"** — not "consult a healthcare provider".
- **Sentence case** in headlines: "Your family", not "Your Family".
- **Personal pronouns first**: "your", "you" — never "users", "members".
- **Specific over generic**: "your mom" over "your loved one"; "Tuesday morning" over "the other day".
- **Verb + object CTAs**: "Pair watch", "Add a family member", "Sign in" — never "Continue", "OK", "Submit".

---

## Empty states (D8 §6.4)

Every screen has one. Empty states are first impressions.

- Use Reassuring tone.
- Explain what *will happen*, not what is missing. "Trends will appear after the first week" — not "No data".
- Have a single action when possible. No action when the user already did the right thing (e.g. "waiting for first reading").
- Never use "empty", "nothing", "none yet".

### Verified empty-state copy

| Screen | Headline | Body | CTA |
| --- | --- | --- | --- |
| Home (no parents) | Your family circle is quiet for now | Add a family member to start sharing care. | Add a family member |
| Home (no readings) | No readings yet | Mum's watch will start syncing as soon as it's paired. | Pair watch |
| Trends | Trends will appear here next week | We need a few days of readings before we can show a trend. | (none) |
| AI assistant | Ask anything about Mum's readings | Try: "What does this anomaly mean?" or "How is she doing this week?" | (none) |
| Comments | Be the first to leave a note | Notes are visible to everyone in the family circle. | Write a note |

---

## Error states (D8 §6.5)

| Pattern | Why | Example | Avoid |
| --- | --- | --- | --- |
| Name the cause without blame | Feels like a friend, not an angry system | "We couldn't reach the watch" | "Bluetooth error 0x21 — device unreachable" |
| Suggest a fix | Recovery is part of trust | "Bring the phone closer to the watch" | "Please retry" |
| Never show a stack trace, error code, or "Something went wrong" | Preserves dignity & trust | Use friendly cause + fix | "Unexpected error" |
| Crash recovery | Reassures | "We're back — you didn't lose anything." | "App crashed." |

---

## Push notification copy templates (D8 §6.6)

| Category | Title pattern | Body pattern (≤120 chars iOS) |
| --- | --- | --- |
| daily-summary | Mum's morning reading | 128/82, in range. Have a good day. |
| anomaly-noted (calm-concerned) | Worth a look | Three of Dad's readings this week were higher than usual. No rush — worth a chat. |
| confirmed-urgent | Please call Mum | Three high readings in the last hour. We recommend reaching out now. |
| missed-reading | Mum hasn't worn the watch in 3 days | A friendly nudge might help. Tap to send a hello. |
| family-invite | Your sister joined the circle | You're both caring for Dad now. |
| subscription-billing | Subscription renewing | Leiko will renew tomorrow for $4.99/month. |
| watch-shipped | Your watch is on the way | Tracking #123: arriving Tuesday. |
| parent-pairing-handoff | Pair the watch on Dad's phone | Tap to open Dad's pairing screen on his Android Chrome. |

> **Tone check**: notice that none of these use "alert", "warning", "critical", or all-caps. None use emoji-driven urgency. Even the anomaly notification is calm-concerned. This consistency IS the brand.

---

## CI implementation contract

`apps/mobile/tools/copy-lint/` (to be created in Sprint 1) implements:

1. A scanner over `apps/mobile/src/i18n/**.{ts,json}` and `apps/mobile/src/**/*.tsx` JSX text nodes.
2. Hard-fail dictionary derived from this file's "HARD FAIL" tables.
3. Soft-warning dictionary derived from "SOFT WARNING".
4. Output: list of file:line offences, exit code 1 on hard fails, exit code 0 with warnings on soft warnings.
5. Also runs over AI prompt fixtures (`apps/mobile/src/services/ai/prompts/**.fixture.ts`) so the AI itself is voice-checked.

The forbidden-claim hits in production copy metric (`docs/13-testing-standard.md`) is **0 — hard requirement** in the alerting table. Any release with > 0 hits is blocked.

---

## Voice governance for AI

Per D5 §3.6: "AI assistant outputs (Tier B and C) must be governed by a 'voice prompt' — a system prompt that encodes these four pillars and forces the AI to use them. Build this into the LiteLLM gateway as a non-overrideable system prompt prefix."

See `docs/07-ai-assistant.md` for the system prompt itself and the post-generation forbidden-claim classifier.
