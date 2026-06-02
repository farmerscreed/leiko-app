> **📎 Historical reference (stamped 2026-06-02).** This is a dated strategy/spec snapshot, kept for context — **not** living spec. For the app's current behaviour see the docs in `docs/00–15`, `docs/04-screens/`, and the decisions in `docs/_adr/`. Where this document and the shipped app disagree, the app + ADRs win.

D10  —  Implementation Plan & Sprint Roadmap  •  Leiko v1.0

**D10**

**Implementation Plan & Sprint Roadmap**

Leiko — Caregiver Blood Pressure Monitoring App

**Version 1.0**

Status: Draft for Execution

Prepared for: LawOne Cloud LLC

Date: May 2026

*Confidential*

*This document is the bridge between specification and code. It contains the operating manual (CLAUDE.md, drop-in ready), the docs extraction map showing how D1–D9 are decomposed into the repo, the 17-sprint roadmap with per-sprint detail, the dependency graph, and the exact prompt patterns to use with Claude Code so each session produces correct work the first time.*


# **Document Metadata**

|**Field**|**Value**|
| :- | :- |
|Document|D10 — Implementation Plan & Sprint Roadmap|
|Version|1\.0|
|Status|Draft for Execution|
|Owner|Founder|
|Audience|Founder (executing solo with Claude Code), any future engineering hires, any technical advisor reviewing the plan|
|Companion to|D1 through D9 — the full specification set|
|Implementation tool|Claude Code (primary), supplemented by direct founder review|
|Target completion (engineering)|Sprint 17 finishes ≈ 17–20 weeks from Sprint 0 start, depending on cadence|
|Target launch (NG market, soft)|Sprint 17 + NAFDAC clearance — see D3 for regulatory clock|
|Target launch (US market)|Sprint 17 + FDA listing transfer + Apple/Google review — see D3|
|Last updated|May 2026|


## **Document Lineage**
- D1–D9 are the specification — they answer "what does the product do?"
- D10 is the execution plan — it answers "in what order do we build it, what does each ticket look like, and how do we know it’s done?"
- D10 does not introduce new product requirements. If a sprint card seems to contradict a D1–D9 spec, the spec wins. Raise the contradiction as an open question for resolution before coding.
- D10 is the only document Claude Code needs to read in full. It will read CLAUDE.md (§3) on every session and pull from docs/ subfolders as each sprint requires.


# **Executive Summary**
Leiko has a complete specification (D1–D9) and zero lines of production code. The gap between those two states is what this document closes. It does so by separating three things that look the same but are not:

- The specification — D1–D9, ~250 pages of decisions about what to build
- The operating manual — CLAUDE.md, ~200 lines that Claude Code reads every session
- The execution plan — the sprint roadmap, with each sprint scoped to one focused build


## **The Operating Model**
Claude Code does its best work when the scope is narrow, the spec is loaded, and there is a propose-step before any code is written. Every sprint follows the same four-step loop:

|**Step**|**What happens**|**Who does it**|
| :- | :- | :- |
|1\. Read|Load CLAUDE.md and the docs files for this sprint. Re-read the sprint card.|Claude Code|
|2\. Propose|Output: ordered task list, ambiguities/missing info that would block, verification step. NO code yet.|Claude Code|
|3\. Approve / Adjust|Founder reviews the proposal, answers ambiguities, approves or amends scope.|Founder|
|4\. Execute & Verify|Code is written, tested against the acceptance criteria, demoed.|Claude Code + Founder|


## **Six Decisions That Shape This Plan**

|**Decision**|**What it locks**|**Why**|
| :- | :- | :- |
|One sprint = one focus|~1 week of work. One screen, one feature, one capability.|Claude Code’s best output is on narrow tasks. Stacking three features into one sprint produces averaged code.|
|Specs decompose into docs/|D1–D9 are not loaded as-is. Each is sliced into ~10–20 small markdown files in the repo, one per concern.|The 200-page docs are too large for the context window. Per-component / per-screen / per-rule files load only what the sprint needs.|
|CLAUDE.md is the keystone|Single file at repo root. Read every session. Encodes voice, forbidden claims, stack, conventions, the don’t-do list.|A 200-line manual that’s always loaded prevents drift better than 2,000 pages that aren’t.|
|Propose-before-code is non-negotiable|Every sprint, every session, no exceptions.|Catches misunderstood scope in 30 seconds instead of 2 hours of wrong code.|
|BLE pairing is the highest-risk sprint|Sprint 5. Plan for it slipping by 50%.|Hardware integration with a third-party OEM device + offline-first sync is the single hardest problem in the build.|
|Clinical advisor hire blocks two things|Cluster A Learn content (D9 §4.6) and any "When to call your doctor" copy in production. Engineering can proceed without; content cannot.|Per D7 §14 Q5 and D9 §10.2. The hire decouples engineering from the regulatory-claim-bearing copy.|


## **What This Plan Is Not**
- Not a substitute for the specification. Reading D10 without D1–D9 in the repo means writing code without grounding.
- Not a Gantt chart. The sprint sequence is dependency-ordered, not date-ordered. Pace varies by founder availability.
- Not a guarantee. Sprints 5 (BLE), 11 (AI Tier-B), and 16 (offline edge cases) carry real risk and should be expected to overrun.
- Not a hiring plan. D10 assumes founder + Claude Code execution. If/when an engineer is hired, the plan still works — hand them a sprint card, they execute it the same way.


# **1. The Operating Model**
How Claude Code, the founder, the docs, and the repo interact. The model is deliberately simple. Every sprint runs the same loop. Every Claude Code session opens with the same prompt pattern. Every commit follows the same convention.
## **1.1 Roles**

|**Role**|**Responsibility**|**Authority**|
| :- | :- | :- |
|Founder|Product owner, decides scope, approves proposals, reviews code, makes business calls (paywall, pricing, regulatory submissions)|Final on every decision|
|Claude Code|Implementation. Reads CLAUDE.md + sprint card + relevant docs. Proposes tasks. Writes code. Writes tests. Commits.|No authority — every meaningful choice is escalated to founder via the propose-step or via clarifying questions|
|Clinical advisor (Q5, D7 §14)|Approves all medical-claim copy, signs off on Cluster A Learn articles|Veto on regulatory-claim language|
|Designer (optional / future)|Visual design beyond what D8 specifies, marketing assets, illustrations referenced in onboarding|Approves visual deliverables; no code authority|


## **1.2 The Session Loop (every Claude Code session)**

|**Phase**|**Goal**|**Time budget**|**Output**|
| :- | :- | :- | :- |
|Open|Claude Code reads CLAUDE.md, the active sprint card, and the docs files referenced in the sprint card.|5 min|Loaded context. No output yet.|
|Propose|Claude Code outputs an ordered task list, flags ambiguities, names the verification step. Asks clarifying questions if needed.|5–10 min|A proposal. No code.|
|Approve|Founder reads proposal, resolves ambiguities, approves or amends scope.|5 min|A green light or an amendment.|
|Execute|Claude Code writes code, tests, runs the verify step.|30 min – several hours|Working code, passing tests.|
|Verify|Founder runs the acceptance criteria from the sprint card. Either passes or sends Claude Code back with specific failures.|10 min|Sprint moves forward, or specific bug list.|
|Commit|Single commit per logical unit. Conventional Commits format. CLAUDE.md and sprint card referenced in commit body when relevant.|2 min|Clean git history.|


## **1.3 The Don’t-Do List**
These are session-opener anti-patterns. Each one has wrecked Claude-Code-driven projects in the wild. CLAUDE.md §3.7 below repeats them; they are stated here for context.

- Do not say "build the Leiko app" or "implement everything in D8." That dilutes the context window across the whole spec and produces averaged, generic code.
- Do not skip the propose-step. The propose-step is faster than the cleanup-step.
- Do not load all of D1–D9 into a session. Load only the docs/ files the sprint card names.
- Do not let Claude Code "guess" at ambiguity. If something is ambiguous, the answer is to ask, not infer.
- Do not let a sprint go more than ~5 days without a demo. If you can’t see it working at the end of the week, scope was too big.
- Do not commit code that violates D5 §6.4 forbidden claims or D8 §1.3 anti-patterns. The CLAUDE.md test gate exists to catch this; if it slips through, revert.


## **1.4 What Founder Reviews on Every Sprint**
- The proposal (before code is written)
- The acceptance criteria pass (after code is written)
- Any new dependency added (npm package, native module, external service) — these change the surface area and warrant a 30-second check
- Any change to the data model (new table, new column, new index) — these are migration events and need explicit approval
- Any string visible to the user that wasn’t in the sprint card — voice review per D5 §3 and forbidden-claims check per D5 §6.4


# **2. Repo Structure & Bootstrap**
The repository layout is the second-most-important artifact in this plan after CLAUDE.md. It determines what Claude Code can find, how the docs are partitioned, and what the test surface looks like. The structure below is the target after Sprint 0 completes.
## **2.1 Target Repo Structure**
leiko-app/

`  `CLAUDE.md                          # The operating manual. Read every session.

`  `README.md                          # Human-facing project intro

`  `package.json                       # Monorepo root, npm workspaces

.gitignore

.env.example                       # Template for required env vars

.github/

`    `workflows/

`      `ci.yml                         # Lint + typecheck + test on PR

`  `docs/                              # The spec, sliced for context efficiency

`    `00-tech-stack.md                 # From D7 §2 (versions, services, locked deps)

`    `01-data-model.md                 # From D7 §3 (Supabase + MMKV schema)

`    `02-design-tokens.md              # From D8 §2 (color, type, spacing, motion)

`    `03-components/                   # From D8 §3, one file per component

`      `button.md

`      `card.md

`      `list-row.md

`      `bottom-sheet.md

`      `pill.md

`      `reading-card.md

...

`    `04-screens/                      # From D8 §4 + D8a, one file per screen

`      `onboarding-fork.md

`      `caregiver-onboarding.md

`      `self-buyer-onboarding.md

`      `watch-pairing.md

`      `take-reading.md

`      `reading-detail.md

`      `caregiver-home.md

`      `self-buyer-home.md

`      `trends.md

`      `settings.md

`    `05-voice-and-claims.md           # From D5 §3 + §6.4 (forbidden phrases)

`    `06-ble-protocol.md               # From D4 Block 4 + D7 §4 (Urion U16 BLE spec)

`    `07-ai-assistant.md               # From D6 §5.7 + D9 §8 (3-tier routing)

`    `08-learn-module.md               # From D9 (Surfaces A/B/C, taxonomy)

`    `09-paywall-and-iap.md            # From D8a §9 + D2 (price points, RevenueCat)

`    `10-anomaly-logic.md              # From D6 §4.7 + D8a §6 (calm-concerned, urgent)

`    `11-push-notifications.md         # From D8a §12, ROUTE table

`    `12-localisation.md               # From D9 §9, locale roadmap

`    `13-testing-standard.md           # Internal: how to test in this codebase

`  `plans/                             # Sprint-by-sprint roadmap, copied from D10 §7

`    `sprint-00-bootstrap.md

`    `sprint-01-design-system.md

`    `sprint-02-auth-and-fork.md

... through sprint-17-launch.md

`    `backlog.md                       # Anything deferred from a sprint

`  `apps/

`    `mobile/                          # The Expo bare app

`      `app.json

`      `eas.json

`      `package.json

`      `tsconfig.json

`      `ios/

`      `android/

`      `src/

`        `components/                  # UI primitives (button, card, etc.)

`        `screens/                     # One folder per screen

`        `navigation/                  # Stack + tab nav config

`        `services/                    # Supabase client, BLE manager, MMKV, push, AI

`        `hooks/                       # useReadings, useFamily, useAuth, etc.

`        `state/                       # Zustand stores (or whatever D7 §2.5 specifies)

`        `i18n/                        # Locale strings

`        `learn/                       # MDX content + Learn components (D9)

`        `utils/                       # Pure helpers, formatters, validators

`        `types/                       # TypeScript types for domain entities

`      `\_\_tests\_\_/                     # Unit + integration tests

`      `e2e/                           # Detox E2E (optional, Sprint 17)

`  `supabase/

`    `migrations/                      # SQL schema migrations

`    `functions/                       # Edge Functions (e.g. AI proxy, PDF gen)

`    `seed.sql                         # Seed data for dev

`  `scripts/

`    `dev.sh                           # Common dev tasks

`    `extract-docs.sh                  # Spec→docs slicing helper (Sprint 0)




## **2.2 Why This Structure**
- Monorepo with npm workspaces — keeps mobile + supabase + scripts + docs in one place. No cross-repo coordination overhead.
- docs/ is FLAT in concept (concern-per-file) but uses subfolders for components and screens because there are many of each — keeps any single file under ~300 lines.
- plans/ duplicates the sprint cards from D10 §7 into the repo so Claude Code can read the active card without leaving the working tree.
- apps/mobile/src/ structure is dictated by D7 §2 — don’t invent new top-level folders without updating CLAUDE.md and D7.
- supabase/ at root, not under apps/, because the schema is shared infrastructure. Future web admin or analytics tools live as siblings to apps/mobile/.


## **2.3 Bootstrap Sequence (Sprint 0 detail)**
The exact order in which Sprint 0 stands up the repo. This is the only sprint with a step-by-step playbook in this section because everything after it follows the standard sprint pattern.

|**Step**|**Action**|**Verify**|
| :- | :- | :- |
|1|mkdir leiko-app && cd leiko-app && git init && npm init -y|package.json exists; git initialised|
|2|Drop CLAUDE.md (§3 of this doc) into repo root|cat CLAUDE.md returns the manual|
|3|Create docs/ structure (mkdir docs && mkdir docs/03-components docs/04-screens) and copy in the extraction map output|docs/ has 13+ files|
|4|Run scripts/extract-docs.sh OR manually slice D1–D9 into the docs/ files per the map in §4 below|docs/00-tech-stack.md exists and matches D7 §2|
|5|Create plans/ folder and copy each sprint card from D10 §7 into plans/sprint-XX-name.md|plans/sprint-00-bootstrap.md through sprint-17-launch.md exist|
|6|Initialise Expo bare workspace: npx create-expo-app apps/mobile --template bare-minimum|apps/mobile/ exists with iOS + Android folders|
|7|Install locked dependencies per docs/00-tech-stack.md (versions are pinned, NOT ranges)|package-lock.json committed|
|8|Initialise Supabase project (supabase init in supabase/)|supabase/migrations/ exists|
|9|Apply initial migration from docs/01-data-model.md|supabase db push succeeds against local Postgres|
|10|Create .env.example with all required keys (NO real values)|.env.example committed|
|11|Configure CI (.github/workflows/ci.yml): lint, typecheck, test on every PR|CI runs green on first push|
|12|Initial commit on main, push to remote|Repo visible in GitHub|


# **3. CLAUDE.md — The Operating Manual**
This is the file that lives at the repo root. Claude Code reads it on every session. It is the highest-leverage artifact in this plan: a 200-line manual that’s always loaded prevents drift better than 2,000 pages of spec that aren’t.

|<p>**How to use this section**</p><p>Copy the markdown block below into the file CLAUDE.md at the root of the repo. Do not edit it without raising a change in D10. Treat it the same way you treat the constitution: stable, referenced, amended only with explicit decision.</p>|
| :- |


## **3.1 The CLAUDE.md File (drop-in ready)**
\# CLAUDE.md — Leiko App Operating Manual



You are working on Leiko, a caregiver-mode blood pressure monitoring mobile app

built on a Urion U16 family BP smartwatch (FDA-listed, EU MDR Class IIa).



\## How every session starts



1\. Read this file (CLAUDE.md) in full.

2\. Read the active sprint card in plans/ (the one we're working on).

3\. Read the docs/ files referenced by the sprint card. Do not read others.

4\. Output a proposal:

`   `- Ordered list of tasks you'll do, in order

`   `- Ambiguities or missing info that would block you (ask, don't guess)

`   `- The verification step you'll run after each task

5\. Wait for approval. Do not write code yet.

6\. After approval: execute, test against the sprint's acceptance criteria,

`   `demo, commit.



If a sprint feels too big to do in one session, say so before starting.

Better to split than to half-finish.



\## What you're building



A React Native (Expo bare) app that pairs with a BP smartwatch over BLE,

displays readings to caregivers (or self-buyers, or both), tracks trends,

warns about anomalies, educates the user, and keeps families connected

across distance.



Two markets: Nigeria and the United States. Three personas: caregiver

(default), self-buyer, parent (the elder being cared for, large-text

mode). All three live in one codebase, switched by an immutable

`account\_type` field set during onboarding.



\## Stack (locked — do not propose alternatives without raising it first)



\- React Native via Expo bare workflow

\- TypeScript strict mode

\- Zustand for state, MMKV for local persistence (offline-first)

\- Supabase: Postgres, Auth, Storage, Edge Functions

\- BLE: react-native-ble-plx, with the Urion U16 protocol in docs/06-ble-protocol.md

\- Push: Expo notifications + APNs/FCM

\- AI: LiteLLM proxy, Haiku 4.5 for most queries, Sonnet 4.6 for complex

\- Payments: RevenueCat (iOS + Android in-app purchases)

\- Analytics: PostHog (privacy-respecting, self-hosted option for HIPAA later)

\- Test: Jest + React Native Testing Library; Detox for E2E (Sprint 17 only)

\- CI: GitHub Actions



Versions are pinned in docs/00-tech-stack.md. If a version doesn't match,

that's a bug. Don't bump.



\## What lives where



\- docs/ — the spec, sliced. Concern-per-file. Don't load anything you

`  `don't need.

\- plans/ — sprint cards. The active one is your job; the rest are context

`  `about what came before and what's next.

\- apps/mobile/src/ — the app. Folder structure is fixed; don't invent new

`  `top-level folders without updating this file.

\- supabase/ — migrations, edge functions, seed data.



\## Voice rules (every user-visible string passes these)



The full rules are in docs/05-voice-and-claims.md. The short version:



FORBIDDEN words and phrases:

\- "patient" (use "Mum" / "Dad" / "your parent" / "you")

\- "diagnose", "diagnosis", "diagnostic", "treat", "treatment", "cure"

\- "predict", "prevent" (when applied to disease)

\- "silent killer", "ticking time bomb", "before it's too late"

\- "medical advice" (we don't give it)

\- "dangerous level", "critical level"

\- Any phrase that promises an outcome ("will lower your BP", "will help

`  `you live longer")



PREFERRED patterns:

\- Lead with the answer. First sentence resolves the question.

\- Plain language before clinical terms. ("The first number" before "systolic")

\- "Talk to your doctor" — not "consult a healthcare provider"

\- Calm, warm, dignified. No fear language.



If a string fails any of these, fix it before commit. If you're not sure,

ask.



\## Anti-patterns (Leiko visual & UX)



From docs/02-design-tokens.md and docs/04-screens/. Do not:



\- Use red for normal-state UI. Red is for confirmed-urgent only.

\- Show count badges, "new" dots, or unread indicators on Learn cards.

\- Add fear-based push notifications.

\- Skip the empty state. Every screen has one.

\- Use `localStorage` or `sessionStorage` — we use MMKV.

\- Auto-fill medical data fields based on prior values.

\- Make the "Take a reading" CTA smaller than the spec says.

\- Animate anomaly banners aggressively. Calm-before-clever.



\## Data rules



\- account\_type is IMMUTABLE after onboarding. There is no migration path

`  `between caregiver and self-buyer; if the user wants to switch, they

`  `start a new account. Per D8a §14.1.

\- Reading values (BP, HR, SpO2) NEVER appear in analytics events. Per

`  `D7 §7 + D9 §8.6.

\- HIPAA scope: we are NOT a covered entity for the DTC path. We still

`  `encrypt at rest and in transit. Per D3.

\- Offline-first: every reading is saved to MMKV before any sync attempt.

`  `Sync is best-effort. The app must function with no network.

\- Family invites use email + 6-digit code, never URL tokens. Per D8a §10.



\## Testing standard



Every sprint produces tests. The bar is:



\- Unit tests for any pure function (formatters, validators, classification)

\- Component tests for any new component (renders, props, accessibility label)

\- Integration tests for any flow that crosses 2+ screens

\- E2E tests are Sprint 17 work, not per-sprint



A sprint is not done until tests pass in CI.



\## Commit convention



Conventional Commits. The body references the sprint card and any docs/

files that influenced the change.



Example:

\```

feat(onboarding): add account\_type fork screen



Implements D6 US-1 and D8a §3. account\_type is set here and

becomes immutable after this commit.



Sprint: 02

Docs: docs/04-screens/onboarding-fork.md, docs/05-voice-and-claims.md

\```



One logical change per commit. Don't bundle unrelated work.



\## Ask, don't guess



If a docs/ file says one thing and a sprint card says another, raise it.

If a string isn't in the spec, raise it. If a library would solve the

problem but isn't in the stack, raise it. If you're about to make a data

model change, raise it.



The right move is always: stop, summarise the ambiguity, ask. The

founder is faster at resolving ambiguity than you are at recovering from

having guessed wrong.



\## What "done" means



A sprint is done when:



1\. Acceptance criteria in the sprint card all pass.

2\. Tests pass in CI.

3\. Voice rules pass on every user-visible string.

4\. The change is demoed (screenshot or screen recording).

5\. The commit is on main with the conventional-commits format.

6\. The sprint card is moved to plans/done/ and the next card is opened.



Anything less is not done. Don't mark a sprint complete to make progress

look better.




# **4. Docs Extraction Map**
How D1–D9 are sliced into docs/. This is a one-time activity in Sprint 0. After that, the docs/ files in the repo are the source of truth Claude Code reads from; D1–D9 remain the authoritative spec but are not loaded into sessions.

|<p>**Why slice the specs**</p><p>D7 alone is 73 KB, D8 is 63 KB. Loading either as-is consumes most of a typical context window before any work begins. Slicing into per-concern files (one component, one screen, one rule set) means a screen sprint loads exactly the screen spec plus the design tokens plus the voice rules — not the full document set.</p>|
| :- |
## **4.1 D1 — Competitive Landscape Report**

|**Source section**|**Target file**|**Notes**|
| :- | :- | :- |
|Whole document|docs/\_reference/D1-competitive-landscape.md|Reference only. Not loaded into engineering sessions. Useful for marketing copy and positioning sanity-checks.|


## **4.2 D2 — Unit Economics & Financial Model**

|**Source section**|**Target file**|**Notes**|
| :- | :- | :- |
|Pricing tiers + IAP price points|docs/09-paywall-and-iap.md|Used by Sprint 10 (paywall) and Sprint 17 (store metadata). Pricing only — not the whole financial model.|
|Whole document|docs/\_reference/D2-unit-economics.md|Reference only.|


## **4.3 D3 — Regulatory Compliance Roadmap**

|**Source section**|**Target file**|**Notes**|
| :- | :- | :- |
|HIPAA scope (DTC path, non-covered-entity)|docs/00-tech-stack.md § Compliance|One-paragraph summary. Drives encryption defaults and analytics constraints.|
|NAFDAC submission gates|docs/\_reference/D3-regulatory.md|Reference. Engineering does not block on these; they are a separate workstream.|
|FDA listing transfer process|docs/\_reference/D3-regulatory.md|Same. Sprint 17 launch sequence references this.|
|Pregnancy deferral note|docs/\_reference/D3-regulatory.md|See pending D3 amendment.|


## **4.4 D4 — App Strategy**

|**Source section**|**Target file**|**Notes**|
| :- | :- | :- |
|Block 3 (Tech Stack)|docs/00-tech-stack.md|CANONICAL. Versions, services, locked deps. CLAUDE.md references this.|
|Block 4 (BLE protocol, Urion U16)|docs/06-ble-protocol.md|CANONICAL for Sprint 5. Includes service UUIDs, characteristic IDs, message format, pairing handshake.|
|Other blocks|docs/\_reference/D4-app-strategy.md|Reference.|


## **4.5 D5 — Brand Brief**

|**Source section**|**Target file**|**Notes**|
| :- | :- | :- |
|§3 Voice pillars (Warm, Calm, Proactive, Dignified)|docs/05-voice-and-claims.md|CANONICAL voice doc. Loaded for every screen sprint.|
|§6.4 Forbidden claims|docs/05-voice-and-claims.md|Same file. Listed prominently. Test gate references this list.|
|§1.3 Persona 3 (Self-Buyer)|docs/04-screens/self-buyer-onboarding.md|Used in Sprint 4.|
|§7.1 Positioning|docs/\_reference/D5-brand.md|Reference. Not loaded into engineering sessions.|
|§10.4 Parent-mode rules|docs/02-design-tokens.md § Parent Mode|Large-text breakpoints, tap-target sizes.|


## **4.6 D6 — PRD**

|**Source section**|**Target file**|**Notes**|
| :- | :- | :- |
|§2.3 Persona definitions|docs/\_reference/D6-prd-personas.md|Reference. Spec’d enough in screens.|
|§3.3 JTBDs (per persona)|docs/\_reference/D6-prd-jtbds.md|Reference.|
|§4.7 Anomaly logic|docs/10-anomaly-logic.md|CANONICAL for Sprint 15. Calm-concerned vs confirmed-urgent thresholds.|
|§5.7 AI Assistant|docs/07-ai-assistant.md|CANONICAL for Sprints 11–12. Loaded by D9 §8 too.|
|User stories (US-1 through US-95)|plans/sprint-XX cards reference specific US-IDs by number|Don’t copy the stories — reference them in the relevant sprint card.|


## **4.7 D7 — Technical Requirements Document**

|**Source section**|**Target file**|**Notes**|
| :- | :- | :- |
|§2 Tech stack|docs/00-tech-stack.md|Merged with D4 Block 3.|
|§3 Data model|docs/01-data-model.md|CANONICAL. Supabase schema, MMKV keys, sync strategy.|
|§4 BLE / sync logic|docs/06-ble-protocol.md|Merged with D4 Block 4.|
|§7 PHI handling|docs/00-tech-stack.md § Compliance|Encryption rules, analytics scrub.|
|§11 Observability|docs/13-testing-standard.md § Telemetry|Event names, properties, privacy constraints.|
|§14 Open questions (Q1–Q12)|plans/backlog.md|Track resolution per sprint. Q5 (clinical advisor) and Q11 (RevenueCat onboarding) are most likely to bite.|


## **4.8 D8 + D8a — Design System Specification**

|**Source section**|**Target file**|**Notes**|
| :- | :- | :- |
|D8 §2 Design tokens (color, type, spacing, motion, opacity, radius, elevation)|docs/02-design-tokens.md|CANONICAL. Loaded by every screen sprint.|
|D8 §3 Components (button, card, list-row, sheet, pill, etc.)|docs/03-components/<name>.md — one file per component|CANONICAL. Loaded by component sprints.|
|D8 §4 Screens (Home, Reading Detail, Trends, etc.)|docs/04-screens/<screen-name>.md — one file per screen|CANONICAL. Loaded by screen sprints.|
|D8a §3–11 Self-buyer amendments|docs/04-screens/self-buyer-\*.md — amendment notes inline in each affected screen file|Diff-style: "ADDS / AMENDS / SUPERSEDES / UNCHANGED". CLAUDE.md § routing rule references this.|
|D8a §12 Voice / push categories|docs/11-push-notifications.md|CANONICAL for Sprint 15.|
|D8a §14 Edge cases|docs/\_reference/D8a-edge-cases.md|Reference. Sprints 1–16 reference specific edge cases as they touch them.|


## **4.9 D9 — Learn / Education Module Specification**

|**Source section**|**Target file**|**Notes**|
| :- | :- | :- |
|§2 Surface architecture|docs/08-learn-module.md|CANONICAL. Three surfaces, anchor map.|
|§3 Content taxonomy|docs/08-learn-module.md|Same file.|
|§4 Article inventory (45 articles)|docs/08-learn-module.md § Inventory|Same file. Article copy itself lives in apps/mobile/src/learn/articles/.|
|§8 AI fallback / 3-tier routing|docs/07-ai-assistant.md|Merged with D6 §5.7.|
|§9 Localisation pipeline|docs/12-localisation.md|CANONICAL for v1.1+ work.|
|§10 Editorial review|docs/\_reference/D9-editorial.md|Reference. The editorial process happens outside the codebase.|


## **4.10 Reference Docs Folder**
- docs/\_reference/ holds the full original D1–D9 documents in markdown form for occasional consultation
- Claude Code does NOT load these by default — they exist as a fallback for ambiguity resolution
- When a sprint card or CLAUDE.md says "see D6 §X" the right behaviour is to look in the focused file (e.g. docs/10-anomaly-logic.md), NOT to load D6 in full


# **5. Critical Path & Dependencies**
Sprints depend on each other. Some dependencies are hard (Sprint 6 cannot start without Sprint 5 because Reading Detail needs real readings from a paired watch). Others are soft (Sprint 8 can start before Sprint 7 finishes if you switch persona). This section maps them so you can see what blocks what.
## **5.1 Dependency Table**

|**Sprint**|**Hard dependencies**|**Soft dependencies**|**Unblocks**|
| :- | :- | :- | :- |
|0 — Bootstrap|None|None|All other sprints|
|1 — Design system|Sprint 0|None|All screen sprints|
|2 — Auth + fork|Sprint 1|None|Sprints 3, 4|
|3 — Caregiver onboarding|Sprint 2|None|Sprint 5 (caregiver path)|
|4 — Self-buyer onboarding|Sprint 2|Sprint 3 (similar patterns)|Sprint 5 (self-buyer path)|
|5 — Watch pairing (BLE)|Sprint 3 OR 4|None|Sprint 6|
|6 — Take a reading + Reading Detail|Sprint 5|None|Sprints 7, 8, 9|
|7 — Caregiver home|Sprint 6|None|Sprint 10|
|8 — Self-buyer home|Sprint 6|Sprint 7 (similar shapes)|Sprint 10|
|9 — Trends + PDF export|Sprint 6|None|Sprint 10 (paywall lever)|
|10 — Settings + family invites + paywall|Sprints 7 or 8, Sprint 9|None|Sprints 11, 12|
|11 — AI Tier-A intent router|Sprints 6, 13 (Learn articles must exist)|None|Sprint 12|
|12 — AI Tier-B (LiteLLM)|Sprint 11|None|Sprint 17|
|13 — Learn Surface A + B|Sprint 6 (Reading Detail anchors)|None|Sprints 11, 14|
|14 — Learn Surface C (home seeding)|Sprints 7 or 8, Sprint 13|None|Sprint 17|
|15 — Push notifications + anomaly logic|Sprint 6|Sprint 7 (caregiver primary use case)|Sprint 17|
|16 — Offline edge cases + error states|Sprints 5, 6, 7/8|None|Sprint 17|
|17 — Launch (store submission, beta)|Sprints 12, 14, 15, 16|None|—|


## **5.2 The Critical Path**
The longest dependency chain through the project. Slowing any sprint on this path slows the launch. Sprints not on this path can absorb delays without affecting the date.

- 0 → 1 → 2 → (3 OR 4) → 5 → 6 → (7 OR 8) → 10 → 12 → 17
- Plus the Learn branch: 13 must finish before 14, and both must finish before 17
- Plus the safety branch: 15 must finish before 17
- Sprints 9 and 16 are off-critical-path and can be parallelised or compressed if the schedule slips


## **5.3 External (Non-Engineering) Dependencies**

|**Dependency**|**Blocks**|**Owner**|**Time to resolve**|
| :- | :- | :- | :- |
|Clinical advisor hire (Q5 in D7 §14)|Cluster A Learn content (D9 §4.6), any "When to call your doctor" copy in production|Founder|4–8 weeks from start of search|
|Apple Developer + Google Play accounts|Sprint 17 (store submission)|Founder|1–3 days for Apple, hours for Google|
|Supabase paid plan|Sprint 17 (production)|Founder|Hours|
|RevenueCat account + IAP product setup|Sprint 10 (paywall plumbing)|Founder|1–3 days|
|Anthropic API key + LiteLLM hosting|Sprint 12 (AI Tier-B)|Founder — already has Hetzner VPS per session context|Hours|
|NAFDAC pre-submission package (if NG launch first)|NG market launch (post-Sprint 17)|Founder + regulatory consultant|8–16 weeks|
|FDA listing transfer / 510(k) labeling|US market launch (post-Sprint 17)|Founder + regulatory consultant|6–12 weeks|
|First Urion U16 watch in hand|Sprint 5 (BLE pairing) — cannot test BLE without hardware|Founder|Lead time per Urion supplier|
|App Store screenshots + marketing copy|Sprint 17 (store submission)|Founder + designer|1–2 weeks|



|<p>**The watch dependency is real**</p><p>Sprint 5 (BLE pairing) requires a physical Urion U16 watch in the founder’s hand. The simulator path won’t catch the real-world BLE quirks. Order the dev unit at Sprint 0 start — it will not arrive faster because you waited until Sprint 5 to think about it.</p>|
| :- |


# **6. Sprint Roadmap — Overview**
Seventeen sprints from empty repo to launch-ready. Each is scoped to roughly one focused work-week. Realistic calendar time depends on founder availability — a half-time pace stretches the same work to 30–40 weeks.
## **6.1 The Full Sprint List**

|**#**|**Sprint**|**Goal in one line**|**Risk**|
| :- | :- | :- | :- |
|0|Bootstrap|Stand up the repo, CLAUDE.md, docs/, plans/, Expo bare, Supabase, CI|Low|
|1|Design System|Implement docs/02-design-tokens.md as ThemeProvider; build button, card, list-row, bottom-sheet, pill|Low|
|2|Auth + Fork|Email/passwordless auth via Supabase, account\_type fork screen (D6 US-1, D8a §3)|Low|
|3|Caregiver Onboarding|D8 §4.2 onboarding flow, family setup screens, parent profile creation|Low|
|4|Self-buyer Onboarding|D8a §3–4 onboarding flow, single "You" screen + Watch screen|Low|
|5|Watch Pairing (BLE)|react-native-ble-plx integration, Urion U16 protocol, pair / re-pair / forget flows|HIGH — plan for slip|
|6|Take Reading + Reading Detail|On-device reading capture, anomaly classification, Reading Detail screen with anchors|Medium|
|7|Caregiver Home|Family Circle, parent cards, weekly snapshot, FAB|Medium|
|8|Self-buyer Home|Your Readings hero card, weekly snapshot, FAB — D8a §6|Medium|
|9|Trends + PDF Export|Trends screen, range chips, % in range, doctor-ready PDF (paywall lever)|Medium|
|10|Settings + Family + Paywall|Settings hub, family invite flow (email + 6-digit code), RevenueCat paywall plumbing|Medium|
|11|AI Tier-A Router|Intent classifier mapping question patterns to Learn articles — NO LLM yet|Medium|
|12|AI Tier-B (LiteLLM)|LiteLLM integration on existing Hetzner VPS, system prompt, output guard, citation requirement|High|
|13|Learn Surface A + B|Dedicated Learn section (cluster grid + article list) and inline explainer (bottom sheet)|Low|
|14|Learn Surface C|Home-seeded Learn card, day-by-day onboarding sequence, contextual selection algorithm|Low|
|15|Push + Anomaly Logic|Push notification routing, calm-concerned and confirmed-urgent banner logic|Medium|
|16|Offline + Error States|Offline-first edge cases, retry strategies, every screen’s error state, every screen’s empty state|Medium|
|17|Launch|Store submission, beta channel, App Store + Play screenshots, final QA pass|Medium|


## **6.2 Sprint Card Anatomy**
Each sprint card in §7 follows the same structure. When in doubt, the structure tells you what info you should expect.

|**Field**|**Purpose**|
| :- | :- |
|Goal|One-paragraph statement of what this sprint produces|
|Duration estimate|~1 work-week of focused engineering. Calendar time varies.|
|Hard dependencies|Sprints that MUST be complete first|
|Docs to load|Exact list of docs/ files Claude Code reads at session open|
|Deliverables|Concrete artifacts — screens, components, schema changes, infrastructure|
|Acceptance criteria|Testable checks. Each must pass before sprint is "done".|
|Test plan|Unit / component / integration tests this sprint adds|
|Definition of done|Per-sprint specifics on top of the universal definition in CLAUDE.md|
|Open prompt|The exact prompt to paste into Claude Code at session start|
|Risk notes|What could go wrong, what to watch for|


# **7. Sprint Cards**
Detailed card per sprint. Each is reproduced into plans/sprint-XX-name.md in the repo at Sprint 0. Claude Code reads the active card at the start of every session in that sprint.

|<p>**How to use a sprint card**</p><p>At the start of each sprint, copy that sprint’s "Open prompt" verbatim into your first Claude Code message. Claude Code will read CLAUDE.md, the named docs files, and the sprint card itself, and respond with a proposal. Approve or amend the proposal before any code is written.</p>|
| :- |
## **Sprint 0 — Bootstrap**
### **Goal**
Stand up the repository, the operating manual, the docs/ structure, the Expo app, the Supabase schema, and CI. By the end, the repo compiles, tests pass, and CI is green. Zero product features.
### **Duration**
~1 work-week.
### **Hard dependencies**
None. This is sprint zero.
### **Docs to load**
CLAUDE.md (drafting), D10 §2.3 bootstrap sequence, D10 §4 extraction map, D7 §2 (tech stack), D7 §3 (data model).
### **Deliverables**
- Initialised git repo on GitHub
- CLAUDE.md at repo root (this document §3, copied verbatim)
- docs/ folder populated with all 13+ files per the extraction map
- plans/ folder with all 18 sprint cards (sprint-00 through sprint-17)
- apps/mobile/ scaffolded as Expo bare workspace, TypeScript strict
- supabase/migrations/0001\_initial.sql with the schema from docs/01-data-model.md
- .env.example with all required env var keys
- GitHub Actions CI: lint, typecheck, jest test on every PR
- README.md with project intro and quick-start
### **Acceptance criteria**
- git clone <repo> && npm install && npm run test — succeeds
- npm run typecheck — passes with zero errors
- CI run on initial PR — passes
- cat CLAUDE.md — returns the operating manual
- ls docs/ — returns at least 13 files matching the extraction map
- ls plans/ — returns 18 sprint card files
- Expo: cd apps/mobile && npx expo prebuild && npx expo run:ios (or android) — launches the default Expo splash screen
- Supabase: supabase db reset — succeeds, schema is created
### **Test plan**
- CI sanity test (a single passing test in apps/mobile/\_\_tests\_\_/ to prove the test runner works)
- No product tests yet
### **Definition of done**
Universal definition (CLAUDE.md) plus: the founder can clone the repo on a fresh machine and reach a green build in <30 minutes following README.md.
### **Open prompt**
We are starting Sprint 0 — Bootstrap. Read CLAUDE.md (which you'll

be drafting in this sprint per D10 §3), then read D10 §2.3 (the

bootstrap sequence) and D10 §4 (the docs extraction map).



Propose:

1\. The exact list of files you'll create, in the order you'll create them

2\. Any decisions in the bootstrap sequence that need my input before

`   `you start (e.g. Supabase project name, GitHub org)

3\. The verification step you'll run after each major group of files



Do not write any files yet. Wait for my approval.
### **Risk notes**
- Don’t skip the docs/ extraction step. Sprint 1 onwards depends on those files existing.
- Pin every dependency. Use exact versions, not ranges.
- Order the Urion U16 dev watch NOW. Lead time will eat Sprint 5 if you wait.


## **Sprint 1 — Design System**
### **Goal**
Implement the design tokens from D8 §2 as a ThemeProvider, then build the five base components every screen will use: button, card, list-row, bottom-sheet, pill. Each in three states (default, pressed, disabled) plus parent-mode large-text variant.
### **Duration**
~1 work-week.
### **Hard dependencies**
Sprint 0.
### **Docs to load**
docs/02-design-tokens.md, docs/03-components/button.md, docs/03-components/card.md, docs/03-components/list-row.md, docs/03-components/bottom-sheet.md, docs/03-components/pill.md, docs/05-voice-and-claims.md.
### **Deliverables**
- apps/mobile/src/theme/ — tokens, ThemeProvider, useTheme hook
- apps/mobile/src/components/Button.tsx with variants: primary, secondary, ghost, destructive
- apps/mobile/src/components/Card.tsx with elevation variants: low, medium, high
- apps/mobile/src/components/ListRow.tsx with variants: standard, navigation, value, switch
- apps/mobile/src/components/BottomSheet.tsx with drag handle, backdrop, dismiss
- apps/mobile/src/components/Pill.tsx with status variants: neutral, info, warn, urgent
- Storybook OR a /dev/components route that renders every component for visual review
### **Acceptance criteria**
- Each component renders correctly at default size
- Each component renders correctly in parent-mode (large-text) variant
- Each component’s tap-target is at least 48pt (or 64pt in parent-mode)
- Each component has accessibilityRole and accessibilityLabel
- Reduced-motion: bottom-sheet appears as hard cut, not slide
- Color tokens match D8 §2.1 hex values exactly
### **Test plan**
- Component test for each of the 5 components: renders, snapshot, accessibility props
- Theme test: useTheme returns expected token values
### **Open prompt**
Sprint 1 — Design System. Read CLAUDE.md, then docs/02-design-tokens.md

and the 5 component files in docs/03-components/.



Propose:

1\. The folder structure under apps/mobile/src/theme/ and src/components/

2\. The order in which you'll build the 5 components and why

3\. The /dev/components route OR Storybook setup — your recommendation,

`   `with a one-line justification

4\. Any token in D8 §2 that's ambiguous to implement directly



Wait for approval.
### **Risk notes**
- The bottom-sheet is the trickiest — drag-to-dismiss + reduced-motion + keyboard avoidance. Budget extra time.
- Don’t use a heavy UI lib. The Leiko look is calm-before-clever; Material/Chakra/NativeBase will fight that.


## **Sprint 2 — Auth + Fork Screen**
### **Goal**
Email-based auth via Supabase (passwordless OTP), and the account\_type fork screen that branches caregiver vs self-buyer. account\_type becomes immutable after this point per D8a §14.1.
### **Duration**
~1 work-week.
### **Hard dependencies**
Sprint 1.
### **Docs to load**
docs/04-screens/onboarding-fork.md, docs/01-data-model.md (§ users table), docs/05-voice-and-claims.md, docs/00-tech-stack.md (§ Compliance).
### **Deliverables**
- Supabase Auth configured for passwordless email OTP
- apps/mobile/src/screens/Auth/SignIn.tsx, SignUp.tsx, OTPVerify.tsx
- apps/mobile/src/screens/Onboarding/AccountTypeFork.tsx (D6 US-1, D8a §3)
- apps/mobile/src/services/supabase.ts — typed client
- apps/mobile/src/state/auth.ts — Zustand auth store
- Migration: users.account\_type CHECK constraint enum [‘caregiver’, ‘self\_buyer’]
### **Acceptance criteria**
- User can sign up with email, receive OTP, verify, and reach the fork screen
- Selecting "I’m caring for someone" sets account\_type=‘caregiver’ in users table
- Selecting "It’s for me" sets account\_type=‘self\_buyer’
- After fork, attempting to update account\_type via API returns a 403/forbidden response
- Sign-in returns the correct account\_type and routes to the correct onboarding (placeholder for sprints 3, 4)
- Voice: every string passes the docs/05-voice-and-claims.md gate
### **Test plan**
- Integration test: sign-up → OTP → fork → confirm account\_type set
- Integration test: attempt to update account\_type after fork → fails
- Component test: AccountTypeFork renders both options with correct copy
### **Open prompt**
Sprint 2 — Auth + Fork. Read CLAUDE.md, then docs/04-screens/

onboarding-fork.md, docs/01-data-model.md, docs/05-voice-and-claims.md.



Propose:

1\. The Supabase Auth configuration (passwordless settings, email template

`   `considerations, expiry)

2\. Screen components and routing structure

3\. How you'll enforce account\_type immutability (RLS policy? trigger?

`   `client-side? combination?)

4\. Any open questions about the OTP flow on iOS vs Android



Wait for approval.
### **Risk notes**
- Immutability of account\_type must be enforced at the database level (RLS or trigger), not just the client. Client-only is bypassable.
- Test the OTP delivery on a real Nigerian carrier; SMS→email-only delivery is the right pattern, but verify the email actually arrives.


## **Sprint 3 — Caregiver Onboarding**
### **Goal**
The caregiver-flavoured onboarding flow per D8 §4.2: profile setup, parent profile creation, family-circle context, "let’s get the watch on" handoff to Sprint 5 pairing.
### **Hard dependencies**
Sprint 2.
### **Docs to load**
docs/04-screens/caregiver-onboarding.md, docs/02-design-tokens.md, docs/05-voice-and-claims.md, docs/01-data-model.md (§ users, parents, family\_links).
### **Deliverables**
- apps/mobile/src/screens/Onboarding/Caregiver/Welcome.tsx
- Profile.tsx — the caregiver’s own info
- AddParent.tsx — first parent profile
- Permissions.tsx — push notifications, BLE permissions
- Migration if needed: parents table, family\_links table
### **Acceptance criteria**
- Onboarding flows from fork screen through to a "ready to pair the watch" screen
- Caregiver profile is saved to users.metadata; parent record is saved to parents table; family\_link row is created
- Skipping AddParent is supported (caregiver can pair watch first, add parent later)
- All copy uses caregiver voice (third-person about parent, "your Mum", etc.)
### **Open prompt**
Sprint 3 — Caregiver Onboarding. Read CLAUDE.md, then docs/04-screens/

caregiver-onboarding.md, docs/01-data-model.md, docs/05-voice-and-claims.md.



Propose:

1\. Screen sequence and navigation pattern (stack? tabs? wizard?)

2\. Where the parent profile is stored (parents table vs users.metadata

`   `for sole-parent caregivers — check spec)

3\. Permissions handling — do we ask up front or just-in-time?

4\. Skip-add-parent path: confirm the spec allows it



Wait for approval.


## **Sprint 4 — Self-Buyer Onboarding**
### **Goal**
The self-buyer onboarding per D8a §3–4: a simpler two-screen flow ("You" + "Watch"), no parent profile, voice in second-person ("your reading").
### **Hard dependencies**
Sprint 2.
### **Docs to load**
docs/04-screens/self-buyer-onboarding.md (which includes D8a amendments), docs/02-design-tokens.md, docs/05-voice-and-claims.md.
### **Deliverables**
- apps/mobile/src/screens/Onboarding/SelfBuyer/You.tsx — user info
- SelfBuyer/Watch.tsx — handoff to pairing
- Reuses Permissions.tsx from Sprint 3
### **Acceptance criteria**
- Onboarding flows fork → You → Watch → ready-to-pair
- users.metadata captures the self-buyer info; NO parents row is created
- Voice is consistently second-person ("your reading", "your watch") throughout
- Voice gate (docs/05-voice-and-claims.md) passes on every string
### **Open prompt**
Sprint 4 — Self-Buyer Onboarding. Read CLAUDE.md, then docs/04-screens/

self-buyer-onboarding.md (note D8a amendments), docs/02-design-tokens.md,

docs/05-voice-and-claims.md.



Propose:

1\. Reuse strategy from Sprint 3 components

2\. The "You" screen field set (per D8a §4)

3\. How the post-Watch screen routes (it should land on the same

`   `ready-to-pair handoff as caregiver flow)



Wait for approval.


## **Sprint 5 — Watch Pairing (BLE)**
### **Goal**
Pair the user’s phone to a Urion U16 watch over BLE. Handle re-pair, forget, and the unhappy paths (Bluetooth off, watch out of range, OS-level permission denied). This is the highest-risk sprint; budget for slip.
### **Hard dependencies**
Sprint 3 OR Sprint 4. A physical Urion U16 dev watch.
### **Docs to load**
docs/06-ble-protocol.md, docs/04-screens/watch-pairing.md, docs/01-data-model.md (§ devices), docs/02-design-tokens.md.
### **Deliverables**
- apps/mobile/src/services/ble/UrionDevice.ts — typed wrapper around react-native-ble-plx
- Pairing screens: Searching, Found, Pairing, Success, Failure
- Settings screens: paired devices, forget device, re-pair
- Migration: devices table per D7 §3
### **Acceptance criteria**
- From scratch: launch app, complete onboarding, reach pairing screen, find watch, pair, see success
- Killing the app and reopening: paired watch is remembered (MMKV) and reconnects
- Forget watch: removes the device from MMKV and database, requires re-pair
- Bluetooth off: app shows the correct error state with a "Turn on Bluetooth" CTA
- Permission denied: app shows the correct error state with a "Open settings" CTA
- Watch out of range: app shows "Couldn’t find your watch" with a retry CTA
- All flows tested on iOS AND Android — BLE behaviour differs significantly
### **Test plan**
- Manual test on real device + real watch (no automated test for hardware integration in this sprint)
- Unit tests for the UrionDevice wrapper’s pure logic (state machine transitions)
- Mock-BLE integration test for the pair flow happy path
### **Open prompt**
Sprint 5 — Watch Pairing (BLE). HIGH RISK — plan for slip.



Read CLAUDE.md, then docs/06-ble-protocol.md, docs/04-screens/

watch-pairing.md, docs/01-data-model.md.



Propose:

1\. The state machine for the pairing flow (states + transitions)

2\. iOS-vs-Android BLE differences you'll handle and how

3\. Permission handling sequence

4\. Testing strategy given that automated BLE testing is hard

5\. The minimal pairing happy path you'll demo first, before adding error states



Wait for approval. Do not start coding the BLE wrapper before we agree on

the state machine.
### **Risk notes**
- iOS BLE permissions changed across recent OS versions — confirm the latest behaviour on the latest iOS.
- Android background BLE has its own permission set (BLUETOOTH\_SCAN, BLUETOOTH\_CONNECT). Don’t skip it.
- The Urion protocol may have undocumented quirks. Plan for one full week of "test, fail, fix" with the real watch.
- If the dev watch has not arrived by Sprint 5 start, pause the sprint. Do NOT try to fake BLE in a simulator and call it done.


## **Sprint 6 — Take Reading + Reading Detail**
### **Goal**
User can trigger a reading from the app, the watch performs the oscillometric measurement, the result is stored locally and synced to Supabase, and the user lands on the Reading Detail screen with classification, anchors, and Learn integration points (anchors are wired but explainer comes in Sprint 13).
### **Hard dependencies**
Sprint 5.
### **Docs to load**
docs/04-screens/take-reading.md, docs/04-screens/reading-detail.md, docs/06-ble-protocol.md, docs/01-data-model.md (§ readings), docs/10-anomaly-logic.md, docs/05-voice-and-claims.md.
### **Deliverables**
- Take-a-Reading FAB / sheet flow
- Reading Detail screen: BP value, status chip, HR + SpO2 mini-stats, trend indicator, "Why this reading?" anchor (button only — explainer in Sprint 13), anomaly badge if applicable
- Reading classification logic per D6 §4.7 (Normal / Elevated / Stage 1 / Stage 2)
- Migration: readings table
- MMKV-first save, then Supabase sync (best-effort)
### **Acceptance criteria**
- User taps FAB, follows on-screen instructions ("stay still", etc.), watch inflates and measures, app receives reading
- Reading is saved to MMKV before any sync attempt
- Reading appears on Reading Detail with correct classification chip
- Reading syncs to Supabase when network is available; works offline if not
- Anchors render as button.ghost but tapping them does nothing yet (no-op until Sprint 13)
### **Open prompt**
Sprint 6 — Take Reading + Reading Detail. Read CLAUDE.md, then

docs/04-screens/take-reading.md, docs/04-screens/reading-detail.md,

docs/10-anomaly-logic.md.



Propose:

1\. The reading state machine: idle → prompting → measuring → result → saved

2\. MMKV save path before sync — confirm it's atomic

3\. Anchor placeholder strategy (button shows but doesn't open anything)

4\. Classification logic location — pure function in utils/, tested

`   `independently



Wait for approval.


## **Sprint 7 — Caregiver Home**
### **Goal**
The caregiver Home screen per D8 §4.5: Family Circle list of parents, each with most-recent reading and trend; weekly snapshot row; Take-a-Reading FAB; pull-to-refresh.
### **Hard dependencies**
Sprint 6.
### **Docs to load**
docs/04-screens/caregiver-home.md, docs/03-components/reading-card.md, docs/02-design-tokens.md, docs/01-data-model.md.
### **Deliverables**
- CaregiverHome.tsx with Family Circle list
- Parent card sub-component (uses reading-card pattern with caregiver variant)
- Weekly snapshot row component
- Empty state ("Add your first parent" or "Pair the watch")
### **Acceptance criteria**
- Home shows a card per parent in family\_links
- Each card shows the most-recent reading with classification chip and trend indicator
- Tap on parent card → routes to that parent’s reading list (placeholder OK; full screen in later sprint)
- Empty state shows when no parents added
- Pull-to-refresh re-syncs from Supabase
### **Open prompt**
Sprint 7 — Caregiver Home. Read CLAUDE.md, then docs/04-screens/

caregiver-home.md, docs/03-components/reading-card.md.



Propose:

1\. The query strategy for "most-recent reading per parent"

2\. How offline state is handled (cached MMKV reading vs nothing)

3\. Empty-state logic ordering (no watch → no parent → no readings)



Wait for approval.


## **Sprint 8 — Self-Buyer Home**
### **Goal**
The self-buyer Home screen per D8a §6: hero card with the user’s most-recent reading (large numeric), mini trend, weekly snapshot, Take-a-Reading FAB. Seven hero card states (no readings, normal, elevated, stage 1, stage 2, anomaly, stale).
### **Hard dependencies**
Sprint 6.
### **Docs to load**
docs/04-screens/self-buyer-home.md (D8a amendments), docs/03-components/reading-card.md, docs/02-design-tokens.md, docs/01-data-model.md.
### **Deliverables**
- SelfBuyerHome.tsx with hero card
- Hero card sub-component supporting all 7 states
- Mini trend chart (last 7 days)
- Weekly snapshot row (shared with caregiver home if patterns match)
### **Acceptance criteria**
- Each of the 7 hero card states renders correctly
- Hero card uses type.numeric-xl per D8a §6.1
- Mini trend chart shows last 7 days, marked stale if last reading >36h ago
- FAB always present, position per spec
### **Open prompt**
Sprint 8 — Self-Buyer Home. Read CLAUDE.md, then docs/04-screens/

self-buyer-home.md, docs/03-components/reading-card.md.



Propose:

1\. Hero card state-selection logic (which of the 7 states applies given

`   `the latest reading + age)

2\. Mini-trend chart library choice (we want lightweight — confirm against

`   `stack)

3\. Components shareable with Sprint 7 caregiver home



Wait for approval.


## **Sprint 9 — Trends + PDF Export**
### **Goal**
Trends screen with range chips (week / month / 3-month / all-time per D8a §8), summary stats (average, % in range, anomaly count), and a doctor-ready PDF export. PDF export is a paywall lever for self-buyers per D8a §9.
### **Hard dependencies**
Sprint 6.
### **Docs to load**
docs/04-screens/trends.md, docs/03-components/pill.md, docs/01-data-model.md, docs/09-paywall-and-iap.md.
### **Deliverables**
- Trends.tsx with range chips, line chart, summary stat tiles
- PDF generation — Supabase Edge Function (server-side rendering preferred over on-device)
- Export flow: trigger → paywall check → generate → share sheet
### **Acceptance criteria**
- All 4 ranges display correctly
- Summary stats compute correctly against test data
- Stat tiles tap targets are 48pt+ (per inline-explainer integration in Sprint 13)
- PDF export for free users prompts the paywall (placeholder paywall UI OK; real paywall in Sprint 10)
- PDF includes: user info, date range, all readings, summary stats, doctor-ready disclaimer
### **Open prompt**
Sprint 9 — Trends + PDF Export. Read CLAUDE.md, then docs/04-screens/

trends.md, docs/09-paywall-and-iap.md.



Propose:

1\. Chart library (must work offline-first — client-side rendering)

2\. PDF generation: server-side via Edge Function vs on-device

3\. Paywall placeholder strategy until Sprint 10

4\. Caching strategy for the summary stats (recompute or store)



Wait for approval.


## **Sprint 10 — Settings + Family + Paywall**
### **Goal**
Settings hub (paired watch, family, account, privacy, support). Family invite flow (email + 6-digit code per D8a §10). RevenueCat IAP plumbing for self-buyer paywall (PDF export + AI back-and-forth + full history).
### **Hard dependencies**
Sprint 7 OR 8, Sprint 9.
### **Docs to load**
docs/04-screens/settings.md, docs/09-paywall-and-iap.md, docs/01-data-model.md, docs/05-voice-and-claims.md.
### **Deliverables**
- Settings.tsx hub
- Family invite flow: send invite → recipient enters code → accepts → family\_link created
- RevenueCat configured, IAP products defined (monthly + annual tiers per D2)
- Paywall screen shown at PDF export and AI back-and-forth touch-points
### **Acceptance criteria**
- Settings shows all sections per spec
- Invite flow works end-to-end: caregiver A invites B, B receives email with code, B enters code in their app, both see the link in family
- Subscription state syncs correctly between RevenueCat and the app
- Paywall is shown at correct touch-points; non-subscriber cannot bypass
### **Open prompt**
Sprint 10 — Settings + Family + Paywall. Read CLAUDE.md, then

docs/04-screens/settings.md, docs/09-paywall-and-iap.md.



Propose:

1\. Family invite flow data model (codes table? expiry? rate-limit?)

2\. RevenueCat integration: identify-user pattern, entitlement model

3\. Paywall screen design — confirm against D8a §9 (PDF lead)

4\. Test users for IAP sandbox



Wait for approval.


## **Sprint 11 — AI Tier-A Intent Router**
### **Goal**
Build the intent classifier from D9 §8.3: incoming question → keyword + embedding match against a published mapping file → if matched, return the relevant Learn article inline; if not, escalate to Tier-B (placeholder until Sprint 12). NO LLM calls in this sprint.
### **Hard dependencies**
Sprint 6, Sprint 13 (Learn articles must exist as MDX assets in the bundle).
### **Docs to load**
docs/07-ai-assistant.md, docs/08-learn-module.md, docs/05-voice-and-claims.md.
### **Deliverables**
- apps/mobile/src/services/ai/intentRouter.ts — the matcher
- Question → article mapping JSON file (from D9 §8.3 table)
- Tier-A response component (renders Learn article inline in chat thread)
- Tier-B placeholder ("I’m not sure how to answer that yet — try rephrasing")
### **Acceptance criteria**
- Each question pattern in D9 §8.3 routes to the correct article in tests
- Unknown question routes to Tier-B placeholder
- No external network calls in this sprint
### **Open prompt**
Sprint 11 — AI Tier-A Intent Router. Read CLAUDE.md, then

docs/07-ai-assistant.md, docs/08-learn-module.md.



Propose:

1\. Matching strategy: pure keyword? embedding? both? confidence threshold

2\. Mapping file format and where it lives in the repo

3\. Test cases derived from D9 §8.3 table

4\. How Tier-B placeholder is wired so Sprint 12 swaps in cleanly



Wait for approval.


## **Sprint 12 — AI Tier-B (LiteLLM)**
### **Goal**
Wire LiteLLM (running on the founder’s Hetzner VPS) as the Tier-B handler. System prompt enforces account\_type variant, forbidden claims list, citation requirement. Output guard rejects responses that violate D5 §6.4. Tier-C refusals route to canned copy.
### **Hard dependencies**
Sprint 11.
### **Docs to load**
docs/07-ai-assistant.md, docs/05-voice-and-claims.md, docs/00-tech-stack.md (§ Compliance, § LiteLLM).
### **Deliverables**
- apps/mobile/src/services/ai/tierB.ts — LiteLLM client
- System prompt template with account\_type, forbidden claims, allowed article IDs
- Output guard: rejects responses containing forbidden phrases, retries with stronger prompt
- Supabase Edge Function as the proxy (so the API key never touches the client)
- Tier-C refusal canned copy per D9 §8.5
### **Acceptance criteria**
- A personalised question routes to Tier-B and returns within 5 seconds
- Response always cites at least one Learn article when relevant
- Diagnostic question ("Do I have hypertension?") returns the Tier-C canned copy
- Output guard catches a forbidden phrase in a synthetic test and retries
### **Open prompt**
Sprint 12 — AI Tier-B (LiteLLM). Read CLAUDE.md, then

docs/07-ai-assistant.md, docs/05-voice-and-claims.md.



Propose:

1\. Edge Function architecture and auth model

2\. System prompt structure (sections, lengths)

3\. Output guard implementation (regex? embedding? both?)

4\. Latency budget and timeout strategy

5\. Cost estimate per query for Haiku 4.5 vs Sonnet 4.6 routing



Wait for approval.
### **Risk notes**
- LLM behaviour will surprise you. Build the output guard expecting failures, not as a defensive afterthought.
- Cost per query at Sonnet 4.6 is real money at scale. Default to Haiku and only escalate when needed.


## **Sprint 13 — Learn Surface A + B**
### **Goal**
The dedicated Learn section (Surface A: cluster grid in Settings) and the inline explainer (Surface B: bottom sheet from Reading Detail anchors). All P0 articles ship with this sprint as MDX in the bundle.
### **Hard dependencies**
Sprint 6 (anchors exist as no-ops).
### **Docs to load**
docs/08-learn-module.md, docs/03-components/bottom-sheet.md, docs/02-design-tokens.md.
### **Deliverables**
- apps/mobile/src/learn/articles/ — MDX files for all 20 P0 articles
- Surface A screens: LearnHome (cluster grid), LearnCluster (article list)
- Surface B: InlineExplainer.tsx using BottomSheet component
- Anchor wiring on Reading Detail (the no-ops from Sprint 6 now open the explainer)
- learn.card.compact, cluster.card, article.list.row components per D9 §12
### **Acceptance criteria**
- All 20 P0 articles render at all 3 reading levels (60s, 3min, deep where applicable)
- Anchors on Reading Detail open the correct article via inline explainer
- Cluster A articles are HIDDEN if clinical advisor flag is not set (per D9 Q-D9-6)
- "Read more" expansion grows the bottom sheet correctly
- Voice gate passes on every article
### **Open prompt**
Sprint 13 — Learn Surface A + B. Read CLAUDE.md, then

docs/08-learn-module.md.



Propose:

1\. MDX rendering strategy in React Native (which library, fallback)

2\. Article frontmatter → routing logic

3\. Cluster A gate (clinical advisor sign-off check)

4\. Article authoring workflow: where do the 20 P0 articles come from?

`   `(Founder writes, clinical advisor signs off, you stub them with

`   `placeholder text in this sprint; final copy lands later)



Wait for approval.


## **Sprint 14 — Learn Surface C**
### **Goal**
Home-seeded Learn card per D9 §2.3 + §7. Day 0–3 fixed sequence, Day 4+ contextual algorithm. Dismissed articles don’t return for 30 days. Read articles don’t re-surface for 90 days.
### **Hard dependencies**
Sprint 7 OR 8, Sprint 13.
### **Docs to load**
docs/08-learn-module.md, docs/04-screens/caregiver-home.md, docs/04-screens/self-buyer-home.md.
### **Deliverables**
- Home learn card slot wired into both home screens
- Selection algorithm per D9 §7.2 (rule-based, deterministic, on-device)
- Dismiss + "read" tracking in MMKV
- Region-aware article selection (NG users see Cluster C subset)
### **Acceptance criteria**
- Day 0: F-1 surfaces. Day 1: F-2. Day 2: T-1. Day 3: V-3.
- Day 4+: rule-based selection per D9 §7.2 priority order
- Dismissed article does not return for 30 days
- Read article does not re-surface as seed for 90 days
- Algorithm runs offline (no network calls)
### **Open prompt**
Sprint 14 — Learn Surface C. Read CLAUDE.md, then

docs/08-learn-module.md.



Propose:

1\. MMKV schema for read/dismissed tracking

2\. Selection algorithm as a pure function (testable)

3\. How "day index since pairing" is computed reliably (timezone hazards)



Wait for approval.


## **Sprint 15 — Push + Anomaly Logic**
### **Goal**
Push notifications wired (Expo + APNs/FCM), 8 push categories per D8a §12, anomaly logic per D6 §4.7 (calm-concerned vs confirmed-urgent). User can opt out per category.
### **Hard dependencies**
Sprint 6.
### **Docs to load**
docs/11-push-notifications.md, docs/10-anomaly-logic.md, docs/05-voice-and-claims.md.
### **Deliverables**
- Expo push setup, APNs + FCM credentials in Supabase
- Edge Function: detect-anomaly — runs on every reading insert
- Edge Function: send-push — routes by category, respects user prefs
- Settings → Notifications screen with per-category toggles
- Anomaly banner component used on Reading Detail and Home
### **Acceptance criteria**
- Calm-concerned anomaly (single elevated reading) → in-app banner only, no push
- Confirmed-urgent (3 readings >180/120 in 24h) → push to caregiver(s) + in-app banner
- Each push category respects user opt-out
- Push tap deep-links to Reading Detail of the triggering reading
- No fear language in any push copy
### **Open prompt**
Sprint 15 — Push + Anomaly Logic. Read CLAUDE.md, then

docs/11-push-notifications.md, docs/10-anomaly-logic.md.



Propose:

1\. Anomaly detection: synchronous on insert vs cron over recent readings

2\. Push delivery via Edge Function vs direct from app

3\. Deep-link strategy

4\. iOS Critical Alerts: do we use them? (Spec says no for Leiko, but

`   `confirm.)



Wait for approval.


## **Sprint 16 — Offline + Error States**
### **Goal**
The polish sprint. Every screen has its empty state, error state, loading state, and offline state. Sync conflict resolution. Retry strategies for failed reads, failed pushes, failed PDF generation.
### **Hard dependencies**
Sprints 5, 6, 7/8.
### **Docs to load**
All docs/04-screens/\*, docs/\_reference/D8a-edge-cases.md.
### **Deliverables**
- Empty state component shared across screens
- Error state component
- Network status banner (when offline)
- Sync conflict resolution: server wins for readings, client wins for preferences
- Exponential-backoff retry for sync failures
### **Acceptance criteria**
- Offline E2E: airplane-mode the device, take a reading, kill app, reopen, reading is still there. Restore network: it syncs.
- Every screen renders correctly in airplane mode
- Failed PDF: shows error with retry
- Failed push token registration: silently retries on next launch
- Watch disconnect mid-reading: clean error path, no zombie state
### **Open prompt**
Sprint 16 — Offline + Error States. Read CLAUDE.md, then every

docs/04-screens/\*.md, plus docs/\_reference/D8a-edge-cases.md.



Propose:

1\. Inventory: every (screen, state) combination that needs handling

2\. Shared empty/error/loading components vs per-screen

3\. Sync conflict policy (server-wins for readings, client-wins for prefs)

4\. Retry policy for which operations



Wait for approval.


## **Sprint 17 — Launch**
### **Goal**
Store submission. Beta channel via TestFlight + Play Internal Testing. App Store + Play screenshots. Final regression QA on real iOS + real Android with the real watch. NAFDAC + FDA paperwork is a separate workstream and does not block this sprint.
### **Hard dependencies**
Sprints 12, 14, 15, 16.
### **Docs to load**
docs/\_reference/D3-regulatory.md, docs/09-paywall-and-iap.md.
### **Deliverables**
- App Store listing: screenshots, description, keywords, privacy policy, age rating
- Play Store listing: same
- TestFlight + Play Internal builds
- Beta tester recruit list (10–20 people, mix of NG and US)
- Detox E2E: smoke tests for the critical-path flows
### **Acceptance criteria**
- TestFlight build runs end-to-end on a real device
- Play Internal build runs end-to-end on a real device
- Screenshots match the live app (no "coming soon" elements)
- Privacy policy is published and accurate
- First 5 beta testers complete onboarding without help
### **Open prompt**
Sprint 17 — Launch. Read CLAUDE.md, then docs/09-paywall-and-iap.md

and docs/\_reference/D3-regulatory.md.



Propose:

1\. Submission checklist for both stores

2\. Screenshots: which screens, what device frames, what copy overlay

3\. Privacy policy generator vs founder-written

4\. Beta tester onboarding instructions

5\. Critical-path E2E tests for Detox



Wait for approval.
### **Risk notes**
- Apple review can reject for medical-app reasons — anchor positioning matters. Have D3 regulatory summary ready.
- NAFDAC and FDA processes run in parallel; they don’t block store submission but they DO block sales claims in the listing.
- First store rejection is normal. Plan for one rejection cycle (5–10 days slip).




# **8. Working with Claude Code**
Patterns that work, patterns that don’t, and the prompt scaffolds you’ll reuse all 17 sprints.
## **8.1 The Universal Session Opener**
Use this every time. The variables are the sprint number and any context that’s changed since last session.

We are starting Sprint <N> — <name>.



Read in order:

1\. CLAUDE.md (refresh — it may have changed since last session)

2\. plans/sprint-<NN>-<name>.md (the active sprint card)

3\. The docs/ files listed in the sprint card's "Docs to load"



Then propose:

1\. The ordered list of tasks you'll do, in the order you'll do them

2\. Any ambiguity, missing info, or contradiction between docs that

`   `would block you (ask, don't guess)

3\. The verification step you'll run after each task



Do not write any code yet. Wait for my approval.


## **8.2 The Mid-Sprint Continuation Prompt**
When picking up an in-progress sprint in a new session.

We are continuing Sprint <N>. Last session ended at <description of

where we stopped>.



Re-read CLAUDE.md and plans/sprint-<NN>-<name>.md.



Tell me:

1\. Your understanding of where we are in the task list

2\. Any context I need to refresh (decisions made last session, code

`   `patterns I should know)

3\. The next 1–2 tasks you'll do



Then proceed.


## **8.3 The "I Hit a Wall" Prompt**
When Claude Code is stuck — ambiguous spec, library not behaving, test failing for unclear reasons.

Stop. Don't try more solutions. Tell me:

1\. The exact error or ambiguity you're hitting

2\. The specific docs/ section or spec passage that's involved

3\. The 2–3 plausible interpretations or fixes

4\. Which one you'd choose and why



I'll resolve it. Do not keep iterating; we don't want a partly-broken

fix mixed with the original problem.


## **8.4 The Voice-Check Prompt**
After Claude Code adds user-visible strings, before commit.

List every user-visible string you added or changed in this session.

For each, confirm it passes:

1\. docs/05-voice-and-claims.md § forbidden words and phrases

2\. The "no fear language" rule

3\. The "lead with the answer" pattern (for Learn content)



If any fail, propose a replacement before commit.


## **8.5 What to Watch For**

|**Anti-pattern**|**How to spot it**|**How to redirect**|
| :- | :- | :- |
|Code without proposal|Claude Code starts writing files immediately|Stop, ask for the proposal first|
|Generic React Native code|Boilerplate that doesn’t reference Leiko tokens or spec|Point to docs/02-design-tokens.md, ask for revision|
|Forbidden language slips through|Word like "patient" or "diagnose" appears in copy|Reject the commit, point to docs/05-voice-and-claims.md|
|New dependency added unannounced|package.json changed without prior discussion|Ask why, evaluate, decide — don’t accept silently|
|Tests that don’t actually test|Tests that mock everything and assert nothing meaningful|Ask for at least one assertion that would catch a real regression|
|Sprint scope creeps|Claude Code starts touching screens not in the sprint|Stop, refocus, defer the extras to backlog.md|
|"It works on my machine"|No CI run, manual demo only|Insist on green CI before sprint is done|


## **8.6 Session Length & Cadence**
- Sessions of 30 min–3 hours work well. Beyond 3 hours, context degrades and proposing again is cheaper than continuing.
- At natural break points (a feature complete, a sprint complete), close the session and start fresh. Carrying stale context across sprints causes drift.
- One sprint per session block. If a sprint stretches multiple days, that’s fine — just always re-open with §8.2.
- After a sprint, before starting the next: spend 10 minutes updating CLAUDE.md if anything new emerged that should be captured (a new convention, a hard-won lesson, a library quirk).


# **9. Quality Gates & Testing Strategy**
Quality gates are checkpoints that run automatically OR are explicit acceptance criteria. They prevent the four most common Claude-Code-driven failures: silent forbidden-claims drift, broken offline behaviour, accessibility regressions, and dependency creep.
## **9.1 Gate Inventory**

|**Gate**|**When**|**How**|**Owner**|
| :- | :- | :- | :- |
|Lint|Every commit|eslint + prettier in CI|Automated|
|Typecheck|Every commit|tsc --noEmit in CI|Automated|
|Unit + component tests|Every commit|jest in CI|Automated|
|Voice / forbidden-claims|Before commit|Custom script grepping for forbidden words across user-visible strings|Automated + founder review|
|Bundle size|Every PR|CI script comparing apps/mobile/dist size to baseline|Automated alert; founder approves|
|Dependency check|Every PR|CI script flagging any new dependency|Founder review|
|Accessibility audit|Every screen sprint|axe-rn or manual VoiceOver/TalkBack pass|Founder + Claude Code|
|Offline E2E|Sprint 16 + before launch|Manual airplane-mode test on real device|Founder|
|Watch hardware E2E|Sprint 5 + before launch|Manual on real Urion U16|Founder|
|Clinical advisor sign-off|Before any Cluster A Learn copy ships|Manual review|Clinical advisor|


## **9.2 The Voice / Forbidden-Claims Gate (a real script)**
A simple grep-based script run in CI. Catches ~90% of slips. Lives in scripts/check-voice.sh.

#!/usr/bin/env bash

\# Fails if any user-visible string contains a forbidden word.

\# Run in CI on every PR. Run locally before commit.



set -euo pipefail



FORBIDDEN=(

`  `"patient"

`  `"diagnose"

`  `"diagnosis"

`  `"diagnostic"

`  `"treat\b"

`  `"cure"

`  `"predict"

`  `"silent killer"

`  `"ticking time bomb"

`  `"before it.s too late"

`  `"medical advice"

`  `"dangerous level"

`  `"critical level"

)



\# Search files that hold user-visible copy

TARGETS="apps/mobile/src/i18n apps/mobile/src/learn/articles apps/mobile/src/screens"



EXIT=0

for word in "${FORBIDDEN[@]}"; do

`  `if grep -ri -E "$word" $TARGETS --include="\*.ts" --include="\*.tsx" --include="\*.mdx" --include="\*.json" >/dev/null 2>&1; then

`    `echo "FAIL: forbidden term '$word' found in user-facing strings"

`    `grep -rin -E "$word" $TARGETS --include="\*.ts" --include="\*.tsx" --include="\*.mdx" --include="\*.json" || true

`    `EXIT=1

`  `fi

done



if [ $EXIT -ne 0 ]; then

`  `echo ""

`  `echo "Voice / forbidden-claims gate failed. See docs/05-voice-and-claims.md."

`  `exit 1

fi



echo "Voice gate: PASS"


## **9.3 Per-Sprint Test Volume Targets**

|**Sprint type**|**Unit**|**Component**|**Integration**|
| :- | :- | :- | :- |
|Bootstrap (S0)|1 sanity|0|0|
|Design system (S1)|5–10 (token utilities)|5 (one per component)|0|
|Auth / onboarding (S2–S4)|3–5|5–8|1–2 (auth flow)|
|BLE / readings (S5–S6)|5–8 (state machine, classification)|3–5|1–2 (mock BLE)|
|Home / Trends (S7–S9)|3–5|5–8|1–2|
|Settings / paywall (S10)|3–5|3–5|1 (invite flow)|
|AI (S11–S12)|5–8 (router, output guard)|2–3|1 (mock LLM)|
|Learn (S13–S14)|3–5 (selection algorithm)|5–8|1–2|
|Push / anomaly (S15)|5–8 (anomaly detection)|2–3|1–2|
|Polish (S16)|3–5|3–5|3–5 (offline scenarios)|
|Launch (S17)|—|—|5–10 Detox E2E|


## **9.4 What Tests Should Look Like**
- Every test has at least one meaningful assertion (no tests that just call render() and pass).
- Snapshot tests are limited to component render output. Don’t snapshot anything dynamic.
- Pure functions (classification, formatters, the Learn selection algorithm) get the highest test coverage — they are easiest to test and most likely to break silently.
- BLE tests use a mock BLE module — testing the wrapper logic, not the radio. Real-watch tests are manual.
- Tests run on Node, not on a simulator. React Native’s test environment is Node + jest.


# **10. Risks & Open Questions**
Things that could derail the plan, and the open decisions that should be resolved during execution.
## **10.1 Top Risks**

|**#**|**Risk**|**Probability**|**Impact**|**Mitigation**|
| :- | :- | :- | :- | :- |
|R1|BLE pairing on iOS or Android has undocumented Urion quirks that break the spec|High|High — blocks Sprint 5 onwards|Order watch at Sprint 0. Budget Sprint 5 with 50% slip headroom. Have a fallback: a "manual reading entry" path so the rest of the app can be built without BLE working.|
|R2|Clinical advisor hire takes >8 weeks|Medium|Medium — delays Cluster A Learn content|Engineering proceeds without; ship v1.0 with a "Talk to your doctor" generic fallback in the Cluster A slot, replace with real articles when advisor signs off.|
|R3|App Store rejects for medical-app reasons|Medium|Medium — 5–10 day slip per cycle|Have D3 regulatory summary ready for review response. Avoid claims in store copy. Anchor positioning matters — we are a wellness app surfacing FDA-listed device data, not a diagnostic.|
|R4|LLM costs exceed projections at scale|Medium|Low — budget impact, not blocker|Tier-A intent router (Sprint 11) absorbs ~50% of queries. Default Tier-B to Haiku 4.5. Add monthly cost monitoring in Sprint 17.|
|R5|Solo execution leads to blind spots in QA|High|Medium — quality bugs reach production|Beta tester pool (Sprint 17) catches user-facing bugs. CI catches regressions. Founder review of every commit is the third layer.|
|R6|Spec contradiction discovered mid-sprint|Medium|Low — 1–2 day delay per occurrence|CLAUDE.md "ask, don’t guess" rule. D10 §8.5 tracks contradictions and feeds them back to the spec set as amendments.|
|R7|Founder availability collapses (other commitments)|Medium|High — timeline doubles|Sprint cards make pause-and-resume cheap. Each card is a complete unit; resume from any sprint without prior context loss.|
|R8|NAFDAC clearance takes longer than expected|High|Medium — NG launch slips|Run NAFDAC submission in parallel with Sprint 0 onwards. Don’t block engineering on it. US-first launch is a viable fallback.|


## **10.2 Open Questions**

|**#**|**Question**|**Owner**|**Target sprint to resolve**|
| :- | :- | :- | :- |
|Q-D10-1|Detox E2E vs Maestro — which E2E framework?|Founder + Claude Code|Sprint 17 (decide at sprint start)|
|Q-D10-2|PostHog cloud vs self-hosted — timing of HIPAA-aware migration|Founder|Sprint 17 OR post-launch (default cloud at launch)|
|Q-D10-3|iOS Critical Alerts for confirmed-urgent anomaly?|Founder|Sprint 15 (default: no — too aggressive for v1.0)|
|Q-D10-4|Detox — only on macOS Apple Silicon, founder hardware?|Founder|Sprint 17|
|Q-D10-5|CMS at v1.2 — Sanity, Strapi, or KV-backed custom?|Founder|Post-launch (out of D10 scope)|
|Q-D10-6|Beta tester recruit channel and compensation?|Founder|Sprint 17|
|Q-D10-7|Sprint duration realistic at half-time founder availability?|Founder|Re-evaluate after Sprint 3|
|Q-D10-8|Per-sprint budget for Claude Code API cost (Sonnet 4.7)?|Founder|Sprint 0|


# **11. Document Changelog**

|**Version**|**Date**|**Changes**|
| :- | :- | :- |
|1\.0|May 2026|Initial issue. Defines operating model, repo structure, CLAUDE.md (drop-in ready), docs extraction map for D1–D9, dependency graph, 18 sprint cards (S0–S17), Claude Code prompt patterns, quality gates, risks.|



|<p>**Document status**</p><p>D10 v1.0 is approved for execution. The next action is Sprint 0: stand up the repo. Begin by copying the CLAUDE.md content from §3 into a new file at the repo root. Begin Sprint 0 only after a physical Urion U16 dev watch has been ordered — the watch lead time will outstrip Sprints 0–4 and you do not want it to block Sprint 5.</p>|
| :- |
## **Approvals**

|**Role**|**Name**|**Date**|**Signature**|
| :- | :- | :- | :- |
|Founder / Product||||
|Engineering Lead (if/when hired)||||
|Clinical advisor (Q-D7-5)||||


*— End of D10 —*
LawOne Cloud LLC  •  Confidential  •  Page 
