> **📎 Historical reference (stamped 2026-06-02).** This is a dated strategy/spec snapshot, kept for context — **not** living spec. For the app's current behaviour see the docs in `docs/00–15`, `docs/04-screens/`, and the decisions in `docs/_adr/`. Where this document and the shipped app disagree, the app + ADRs win.

D7  —  Technical Requirements Document  •  Leiko v1.0



**DELIVERABLE 7**

**Technical Requirements Document**

*Leiko Caregiver BP Monitoring App  •  v1.0 (MVP)*

BP Smartwatch Venture  •  LawOne Cloud LLC

*Prepared: May 2026  •  Status: Sprint-1-Ready*


# **Document Metadata**

|**Field**|**Value**|
| :- | :- |
|Deliverable|D7 — Technical Requirements Document (TRD), v1.0 MVP|
|Project|Leiko Caregiver BP Monitoring App (Urion U16H + U19M white-label)|
|Entity|LawOne Cloud LLC (US-registered)|
|Output Standard|<p>Sprint-1-ready. Every choice in D4 with an "or" is locked here with rationale.</p><p>Every requirement traces to a D6 user story or a D3/D5 constraint.</p><p>An AI coding agent or contracted engineer can begin Sprint 1 immediately upon reading.</p>|
|Predecessor Documents|D1 (Competitive), D2 (Unit Economics), D3 (Regulatory), D4 (App Strategy), D5 (Brand Brief), D6 (PRD v1.0)|
|Successor Documents|D8 (Design System Spec), D9 (Implementation Plan), D10 (Phase-1 Tickets)|
|Primary Audience|Mobile engineer(s), backend engineer(s), AI coding agents (e.g., Claude Code), QA, founder|
|Versioning|v1.0 = locked stack and architecture for MVP build. Material changes require an ADR (Architecture Decision Record) appended to §15.|


# **§0  Executive Summary**
This TRD turns the "what" of D6 (PRD v1.0, 95 user stories) into the "how" the engineering team will build. It locks every technology choice that D4 left as an "or", specifies the Supabase schema in detail, names every Edge Function the app will call, fully implements the BLE connection state machine on top of D4 Block 4 reference code, and codifies the regulatory and privacy posture in code-level detail.

The TRD does not introduce new product decisions. Where a question turns out to be a product decision (not a technical one) it is escalated back to the PRD via §14 Open Technical Questions. Where D6 flagged an assumption that has now been resolved by the founder, the resolution is applied here:

- Parent pairing: Web Bluetooth via Chrome on Android is the primary remote-pairing path (Nigeria is ~85% Android — Statcounter Nov 2025). Native iOS app install via Universal Link is the iOS fallback. US pre-pairing was rejected on shipping cost grounds. (Resolves D6 §9.1 row 4.)
- Watch reading deletion: Soft delete with reason code. Reading is hidden from UI, preserved in DB with reason code (e.g., "cuff slipped", "measured someone else"), excluded from anomaly baseline and trend averages. (Resolves D6 §9.1 row 5.)
- Order tracking: Shopify webhook + light tracking. Order number, ship date, ETA shown in dashboard; carrier tracking via link-out. (Resolves D6 §9.1 row 6.)
- Watch firmware UI customization scope is TBC pending response from Urion (James Lee). The firmware track runs in parallel and does NOT block app delivery. The TRD therefore proceeds on the assumption that the watch on-screen experience is delivered by the supplier-default firmware unless and until LawOne customisations are confirmed.



|<p>**TRD READING ORDER**</p><p>Engineers and AI coding agents should read §1–§3 first (architecture, stack, data model). Anyone implementing BLE should then read §5 (BLE Implementation) cover-to-cover. Anyone implementing auth or the family-circle role model should read §6 cover-to-cover. §7 (Privacy, Security & Compliance) is mandatory reading for everyone before merging any PR that touches PHI. §11 (Observability) and §12 (Testing) are mandatory reading before opening the first PR.</p>|
| :- |


## **Document Structure**
- §1 Architecture Overview
- §2 Tech Stack (final lock)
- §3 Data Model (Supabase tables, RLS, indexes)
- §4 API Surface (Edge Functions and external integrations)
- §5 BLE Protocol Implementation
- §6 Authentication & Authorization
- §7 Privacy, Security & Compliance
- §8 Push Notifications
- §9 Offline Behavior
- §10 Internationalization
- §11 Observability
- §12 Testing Strategy
- §13 Build & Release
- §14 Open Technical Questions
- §15 Architecture Decision Records (ADR ledger)


# **§1  Architecture Overview**
Leiko is a six-tier system: (a) the Urion-manufactured BLE watch on the parent's wrist; (b) the React Native app on the parent's phone (the BLE bridge); (c) the React Native app on the caregiver's phone (the consumer surface); (d) Supabase self-hosted on Hetzner (Postgres + Auth + Realtime + Storage + Edge Functions); (e) the AI orchestration layer (LiteLLM gateway → Ollama for Tier A, Claude Haiku 4.5 for Tier B, Claude Sonnet 4.6 for Tier C, with n8n for scheduled multi-step pipelines); (f) supporting external services (RevenueCat for subscription billing, Sentry for error tracking, PostHog for analytics, Shopify for hardware commerce).


## **1.1  System Diagram (described)**
The diagram below describes the production data plane. ASCII drawing is provided for at-a-glance reading. The textual description that follows is the authoritative reference.



`   `PARENT (Lagos)                           CAREGIVER (NJ)

`   `─────────────────                        ─────────────────

`   `Leiko Watch (U16H/U19M)                   iPhone / Android

`   `│ BLE 5.2 (Nordic UART GATT)             │

`   `│  6E40FFF0-... service                  │

`   `▼                                        │

`   `Parent's phone                           │

`   `┌───────────────────────────┐            │

`   `│  Leiko App (Parent mode)   │            │

`   `│  - react-native-ble-plx   │            │

`   `│  - WatermelonDB cache     │            │

`   `│  - Foreground Service     │            │

`   `└─────────┬─────────────────┘            │

`             `│ HTTPS / TLS 1.3              │

`             `▼                              │

`   `┌────────────────────────────────────────┴─────────────┐

`   `│  Hetzner (Frankfurt, eu-central; replica Helsinki)   │

`   `│                                                      │

`   `│   ┌──────────────────────┐   ┌────────────────────┐  │

`   `│   │  Supabase            │   │  LiteLLM Gateway   │  │

`   `│   │  - Postgres 15       │◄──┤  - Tier A (Ollama) │  │

`   `│   │  - GoTrue Auth       │   │  - Tier B (Haiku)  │  │

`   `│   │  - Realtime          │   │  - Tier C (Sonnet) │  │

`   `│   │  - Storage (S3-API)  │   │  - rate-limit/cache│  │

`   `│   │  - Edge Functions    │   └────────────────────┘  │

`   `│   └──────────┬───────────┘                           │

`   `│              │                                       │

`   `│              ▼                                       │

`   `│   ┌──────────────────────┐   ┌────────────────────┐  │

`   `│   │  n8n workflows       │   │  PostHog analytics │  │

`   `│   │  - weekly-summary    │   │  (PHI-free events) │  │

`   `│   │  - doctor-report     │   └────────────────────┘  │

`   `│   │  - anomaly-explainer │                           │

`   `│   └──────────────────────┘                           │

`   `└────────────────┬─────────────────────────────────────┘

`                    `│

`                    `│ webhooks / SDK

`                    `▼

`   `┌────────────────────────────────────────────────────┐

`   `│  External SaaS (no PHI; tokens / events only)      │

`   `│   - RevenueCat (subscription state)                │

`   `│   - Sentry (error traces, stripped)                │

`   `│   - Anthropic Claude API (with BAA)                │

`   `│   - Shopify (orders, fulfilment webhooks)          │

`   `│   - APNs / FCM (Expo Notifications routes)         │

`   `│   - Twilio (verify only — phone OTP, optional)     │

`   `└────────────────────────────────────────────────────┘




### **1.1.1  Components (authoritative)**

|**Component**|**Description**|**Owned by**|**Trust zone**|
| :- | :- | :- | :- |
|Leiko Watch firmware|<p>Urion-supplied firmware on U16H/U19M.</p><p>Out of scope for this TRD; tracked separately. App treats it as a black box exposing the BLE protocol from D4 Block 4.</p>|Urion (vendor)|Untrusted boundary|
|iOS app|<p>React Native + Expo bare workflow.</p><p>Two modes: Caregiver, Parent (Self-Buyer = Caregiver mode where wearer==watcher).</p>|LawOne Cloud|Trusted client|
|Android app|<p>Same RN codebase.</p><p>Foreground Service required for background BLE.</p>|LawOne Cloud|Trusted client|
|Supabase (self-hosted)|<p>Postgres 15 + GoTrue + Realtime + Storage + Edge Functions on Hetzner CCX23 in Frankfurt (eu-central).</p><p>Read-replica in Helsinki (eu-north).</p>|LawOne Cloud|Server (PHI in clear)|
|LiteLLM Gateway|<p>Single egress point for AI model calls.</p><p>Routes to local Ollama (Tier A) or Anthropic API (Tier B/C).</p><p>Enforces non-overrideable system prompt prefix from D6 §6.5.</p>|LawOne Cloud|Server (PHI scrubbed before egress to cloud LLMs)|
|Ollama|<p>Llama 3.1 8B / Llama 3.2 3B quantised.</p><p>Hetzner GPU node (existing).</p>|LawOne Cloud|Server (PHI in clear)|
|n8n|Workflow orchestrator for: weekly summary, doctor report, anomaly explanation.|LawOne Cloud|Server|
|RevenueCat|<p>SaaS subscription manager.</p><p>Receives only Apple/Google subscription tokens and our internal user\_id. NO PHI.</p>|RevenueCat|External SaaS (no PHI)|
|Sentry|<p>SaaS crash & error tracking.</p><p>PHI scrubbing wrapper before submission.</p>|Sentry|External SaaS (no PHI)|
|PostHog (self-hosted)|<p>Product analytics on Hetzner.</p><p>Event names + non-identifying metadata only.</p>|LawOne Cloud|Server (no PHI in events)|
|Anthropic Claude API|<p>Tier B (Haiku 4.5) and Tier C (Sonnet 4.6).</p><p>Requires signed BAA before any PHI is sent.</p>|Anthropic|External SaaS (PHI under BAA)|
|Shopify|<p>Hardware D2C storefront.</p><p>Webhooks → Edge Function /shopify-webhook for order tracking.</p>|Shopify|External SaaS (no PHI)|
|Expo Notifications|Unified push tier; routes to APNs and FCM.|Expo + Apple/Google|External (no PHI in payloads)|


### **1.1.2  Data flow — happy path (parent takes a BP reading)**
This is the defining product moment. End-to-end latency target: ≤ 60 seconds from cuff-deflation to caregiver phone vibration (per D4 Block 4 §4.5.13).

- Parent presses watch side button. Cuff inflates ~45s. Watch computes SYS / DIA / Pulse and writes to internal flash. Watch fires BLE Notify packet 0x73 0x02 ("new BP available").
- Parent's phone (in CONNECTED or RECONNECTING state) receives 0x73. State machine transitions to SYNCING.
- App writes 0x14 (read BP history since last cursor). Watch responds with multi-packet sequence. App parses, validates CRC8, computes quality\_score (good / fair / suspect) from quality\_flags.
- App POSTs to Edge Function /sync with the new readings + device\_id + timestamp. JWT bearer auth.
- /sync validates schema, deduplicates against (device\_id, measured\_at) unique index, inserts rows, fires PostgreSQL NOTIFY on channel reading\_inserted.
- /check-alerts (triggered by NOTIFY) runs anomaly logic from D6 §5.11. If anomaly: enqueue n8n workflow anomaly-explainer. If no anomaly: skip.
- /check-alerts emits a record into push\_queue (a Postgres-LISTEN-driven outbound queue).
- A long-lived worker (Deno on Edge Functions) consumes push\_queue and calls Expo Notifications API with the categorized payload (per §8). Expo routes to APNs/FCM. Caregiver's phone vibrates.
- Caregiver opens app from notification. Realtime subscription pulls the new reading. Dashboard renders.


### **1.1.3  Data flow — caregiver opens app cold**
- App launches. JWT validated locally; if expired (24h), refresh against Supabase Auth.
- App subscribes to Realtime channel realtime:public:bp\_readings:family\_id=eq.{family\_id} and realtime:public:family\_events:family\_id=eq.{family\_id}.
- App reads from local WatermelonDB cache (last 30 days of readings) for instant render. Then reconciles with server: SELECT \* FROM bp\_readings WHERE family\_id = $1 AND updated\_at > $local\_high\_water\_mark.
- Dashboard shows latest reading within ≤ 1s p50 (D6 §6.1).


# **§2  Tech Stack (final lock)**
Every choice that D4 left as an "or" is locked in this section. Each lock includes the rejected alternative and the reason for rejection. Material changes to any of these locks must be filed as an ADR (§15) and reviewed by the founder and lead engineer.


## **2.1  Mobile**

|**Concern**|**Locked choice**|**Rejected alternative(s)**|**Rationale**|
| :- | :- | :- | :- |
|Framework|React Native + Expo bare workflow (a.k.a. EAS Development Build)|<p>Native (Swift + Kotlin)</p><p>Flutter</p><p>Expo Go</p>|<p>Locked in D4 Block 3.1.1.</p><p>RN bare gives full native module access (required for foreground service + BLE state restoration), keeps single codebase, leverages largest mobile dev talent pool. Flutter is plan-B only.</p>|
|BLE library|react-native-ble-plx v3.x|react-native-ble-manager|<p>Locked in D4 Block 4.2.</p><p>Industry standard, healthcare-track-record, Expo config plugin available, supports iOS state restoration.</p>|
|State management|Zustand 4.x|<p>Redux Toolkit</p><p>React Context only</p><p>Jotai</p><p>MobX</p>|<p>New choice in this TRD.</p><p>Zustand keeps boilerplate minimal, plays well with TypeScript, supports async actions natively, and integrates cleanly with React Query for server state. Redux Toolkit is overkill for this app size; Context-only causes re-render storms with realtime data.</p>|
|Server-state cache|TanStack Query (React Query) v5|<p>SWR</p><p>Apollo (GraphQL — not used)</p><p>Hand-rolled</p>|<p>New choice.</p><p>React Query handles cache, retries, optimistic updates, and integrates with Supabase Realtime via subscription invalidation. Standard pattern in 2026.</p>|
|Navigation|React Navigation v7 (native stack + bottom tabs)|Expo Router|<p>New choice.</p><p>Native Stack uses platform-native transitions. Expo Router is file-based but adds churn risk; deferred to v2 evaluation.</p>|
|Local DB|WatermelonDB 0.27+|<p>Realm</p><p>SQLite via op-sqlite</p><p>AsyncStorage</p>|<p>Locked in D4 Block 3.1.2.</p><p>WatermelonDB designed for sync-conflict-resilient offline. Works for the parent-side 30-day local cache.</p>|
|Encrypted KV|react-native-mmkv 2.x with platform keystore|AsyncStorage|<p>Locked in D4 Block 3.1.2.</p><p>AsyncStorage is plaintext on Android; unsafe for tokens.</p>|
|Charts|Victory Native XL|<p>react-native-svg-charts</p><p>react-native-chart-kit</p><p>Skia direct</p>|<p>New lock.</p><p>Victory Native XL is the modern Skia-backed rebuild from Formidable. Renders fast at 30+ days of readings, and theming is straightforward with our D8 design tokens.</p>|
|BLE-bridged i18n|i18next + react-i18next|FormatJS / Lingui|Mature, MessageFormat support, easy to externalize and lint.|
|Form handling|React Hook Form + Zod|Formik|Smaller, faster, schema-first validation aligns with backend.|
|Date/time|Luxon|<p>date-fns</p><p>Day.js</p><p>native Intl only</p>|IANA TZ-correct (parent in Lagos, caregiver in NJ — never optional). Better DST handling than date-fns.|


## **2.2  Backend**

|**Concern**|**Locked choice**|**Rationale**|
| :- | :- | :- |
|Platform|Supabase self-hosted on Hetzner|Locked in D4 Block 3.2. Cost-controlled; Hetzner already operational; portability if Supabase pricing shifts.|
|Database|PostgreSQL 15 (Supabase pinned version)|Stable, RLS, JSONB, partitioning available for bp\_readings if scale demands.|
|Auth|Supabase Auth (GoTrue)|Email magic link + Apple Sign-In + Google Sign-In. JWT + refresh tokens. PKCE on mobile.|
|Realtime|Supabase Realtime (Postgres LISTEN/NOTIFY broker)|Used for caregiver dashboard live updates and family events.|
|File storage|Supabase Storage (S3-compatible) on local Hetzner volume|For PDF doctor reports, profile photos, and family member avatars.|
|Edge runtime|Supabase Edge Functions (Deno)|Locked in D4 Block 3.2.4. Single language for all server-side endpoints.|
|Workflow orchestration|n8n (existing self-hosted)|Long-running, retryable AI pipelines (weekly summary, doctor report).|
|Migrations|Supabase CLI db push with hand-rolled SQL files in /db/migrations|Standard Supabase pattern; PR-reviewable.|
|Region (primary)|Hetzner Frankfurt (eu-central)|GDPR-compatible. Founder choice. Latency to Lagos and to US East both acceptable (<160ms p95).|
|Region (replica)|Hetzner Helsinki (eu-north)|Read replica for warm-standby and EU residency redundancy. Per D6 §6.2.|


## **2.3  AI Layer**

|**Tier**|**Model**|**Hosting**|**Use cases**|
| :- | :- | :- | :- |
|Tier A (local)|Llama 3.1 8B (default) + Llama 3.2 3B (fast path)|Ollama on Hetzner GPU node|Tier A FAQ Q&A, output classifier (forbidden-claims pre-screen), reading-quality scoring.|
|Tier B (cloud)|Claude Haiku 4.5 (model id: claude-haiku-4-5-20251001)|Anthropic API via LiteLLM|Conversational pattern explanation (D6 US-61). Latency-sensitive caregiver-facing Q&A.|
|Tier C (cloud)|Claude Sonnet 4.6 (model id: claude-sonnet-4-6)|Anthropic API via LiteLLM|Weekly summaries (D6 US-62), doctor report narrative.|
|Gateway|LiteLLM (existing)|Hetzner|OpenAI-compatible egress; per-customer rate limits; cache (24h identical prompt → cached response); fallback graph.|



|<p>**AI MODEL DECISION (locked at TRD time)**</p><p>Per the product self-knowledge skill, the most current Anthropic model family is Claude 4.7 (Opus 4.7); Sonnet 4.6 and Haiku 4.5 are also current. Tier C uses Sonnet 4.6 (best output quality for narrative summaries at the lowest cost capable of clearing the brand-voice and forbidden-claims bar). Tier B uses Haiku 4.5 (4-7× cheaper, 2-3× faster — appropriate for Q&A). Opus 4.7 is over-spec for both tiers; we revisit annually in §15 ADR review.</p><p>All Anthropic API calls are routed via LiteLLM to a single egress key. The Anthropic BAA (open question §14) MUST be in place before any reading data is forwarded — until then, Tier B/C run only against synthetic/scrubbed data in dev, and the production launch of AI features is gated on BAA completion.</p>|
| :- |


## **2.4  Subscription Billing**

|**Concern**|**Locked choice**|**Rationale**|
| :- | :- | :- |
|Subscription manager|RevenueCat (Purchases SDK)|Locked in D4 Block 3.4. Cross-platform, A/B paywall, retry, churn. ~1% of revenue.|
|Server validation|RevenueCat webhook → /revenuecat-webhook Edge Function|Source-of-truth for entitlements is the families.subscription\_status column, updated by webhook.|
|Free trial|7 days; no credit card collected at start of trial; card collected at trial end if user converts|Per D6 US-69. Industry trend supports higher conversion in the diaspora segment.|
|Pricing|$4.99 / month  •  $39.99 / year (33% off)|Per D2 + D6 §5.8.|


## **2.5  Push Notifications**

|<p>**LOCK: Expo Notifications (NOT direct APNs/FCM)**</p><p>D6 leaves this open. We lock Expo Notifications because (a) we are already on Expo bare workflow and the Expo push token model is the path of least friction, (b) Expo routes to APNs and FCM under the hood with no proprietary lock-in (the underlying token can be swapped for a direct one if we ever need to), (c) Expo's receipt API gives us a delivery-success signal we use in observability (§11).</p><p>Risks accepted: Expo's service is a single point of dependency. Mitigated by storing both the Expo push token AND the underlying APNs/FCM token at user device registration, so a future migration is one-deploy away.</p>|
| :- |


## **2.6  Analytics**

|<p>**LOCK: PostHog self-hosted on Hetzner**</p><p>Locked in D4 Block 3.5. PostHog is HIPAA-friendlier than Mixpanel/Amplitude (control over data residency), runs on existing Hetzner, and is open source.</p><p>Strict event policy: event names + non-identifying metadata ONLY. NEVER reading values, NEVER names, NEVER device serial numbers. PHI redaction is enforced by a thin wrapper (see §11.2). Analytics is for product behaviour (which screen, what action, retention) — not for clinical outcomes.</p>|
| :- |


## **2.7  Error Tracking**

|<p>**LOCK: Sentry SaaS (Team plan)**</p><p>D6 leaves this open. We lock Sentry SaaS Team plan ($26/mo) over self-hosted Sentry because (a) self-hosting Sentry is a non-trivial DevOps line item — Sentry-on-Hetzner adds 40-60 GB RAM and ongoing OnCall load — and we cannot afford it at MVP scale, (b) the BAA-equivalent we need for crashes is satisfied by stripping PHI client-side BEFORE submission, which is independent of where Sentry runs.</p><p>Mandatory: a Sentry beforeSend hook strips known PHI fields (sys, dia, pulse, parent\_name, caregiver\_name, email, phone, device\_serial). Test in CI: a synthetic crash with PHI-shaped fields should arrive in Sentry with PHI redacted. Failure of this test BLOCKS release.</p><p>Re-evaluation: if user count > 5,000, re-evaluate Sentry self-host (cost crossover).</p>|
| :- |


## **2.8  CI / CD**

|<p>**LOCK: GitHub Actions + EAS Build (NOT Fastlane)**</p><p>EAS Build is the native partner of Expo bare workflow; it removes the macOS-runner-and-Xcode-version pain and is well documented. Fastlane remains relevant if we ever leave Expo (deferred).</p><p>Branching: trunk-based on main; release branches (release/v1.x.y) cut for App Store submissions. Hotfix branches off the latest release tag. Squash-merge to main.</p><p>Required CI gates (all must pass): TypeScript strict; ESLint; Prettier check; Jest unit tests; React Native Testing Library component tests; copy-lint (D6 §6.5 forbidden claims linter); secret scanning; Snyk/Dependabot on dependency PRs.</p>|
| :- |


## **2.9  Repository Layout**


/leiko

├── apps/

│   └── mobile/                # React Native + Expo bare

│       ├── src/

│       │   ├── app/           # screens (mirrors React Navigation tree)

│       │   ├── components/    # design-system primitives + composites

│       │   ├── ble/           # state machine, command wrappers (§5)

│       │   ├── data/          # WatermelonDB models, React Query hooks

│       │   ├── i18n/          # locale files

│       │   ├── theme/         # design tokens (consumed from D8)

│       │   └── lib/           # supabase client, sentry, posthog, etc.

│       ├── ios/               # native projects (Expo prebuild output)

│       ├── android/

│       └── eas.json

├── db/

│   ├── migrations/            # SQL migrations (Supabase CLI)

│   └── seed/                  # synthetic seed data for dev

├── functions/                 # Supabase Edge Functions (Deno)

│   ├── sync/

│   ├── check-alerts/

│   ├── revenuecat-webhook/

│   ├── shopify-webhook/

│   ├── generate-doctor-report/

│   ├── pairing-code/

│   └── \_shared/               # auth, logging, PHI scrub, types

├── workflows/                 # n8n workflow JSON exports

├── tools/

│   ├── copy-lint/             # D6 §6.5 forbidden-claims linter

│   ├── ble-mock/              # in-memory BLE adapter for tests

│   └── e2e/                   # Maestro flows

├── docs/

│   ├── adr/                   # Architecture Decision Records (§15)

│   └── runbooks/

└── .github/workflows/




# **§3  Data Model**
Every Supabase table is specified below with columns, types, constraints, indexes, and Row-Level Security policies. Foreign keys, cascade rules, and the soft-delete strategy are explicit. Schemas are the source of truth — when this section diverges from the implementation, the implementation is the bug.


## **3.1  Entity Map**


auth.users (Supabase managed)

`        `│

`        `│  one-to-one

`        `▼

public.users  ─────────────┐

`   `│                       │ created\_by

`   `│  belongs to (M:N)     ▼

`   `├──► public.family\_members  ──── role  ───────┐

`   `│       │                                     │

`   `│       └──► public.families ◄── parent ──────┘

`   `│              │

`   `│              ├──► public.devices  ──► public.readings  ──► public.reading\_quality

`   `│              │                                       │

`   `│              │                                       └──► public.reading\_notes

`   `│              │

`   `│              ├──► public.subscriptions

`   `│              │

`   `│              └──► public.invitations

`   `│

`   `├──► public.ai\_conversations  ──► public.ai\_messages

`   `│

`   `└──► public.audit\_log




## **3.2  Tables**
### **3.2.1  users**
Public-schema profile that mirrors auth.users. Created on first sign-in via a Postgres trigger.

create table public.users (

`  `id              uuid primary key references auth.users(id) on delete cascade,

`  `email           text,

`  `display\_name    text not null,

`  `photo\_url       text,

`  `preferred\_language text not null default 'en',

`  `timezone        text not null,                       -- IANA, e.g. 'America/New\_York'

`  `year\_of\_birth   smallint check (year\_of\_birth between 1900 and 2100),

`  `account\_type    text not null check (account\_type in ('caregiver','parent','self\_buyer')),

`  `marketing\_opt\_in boolean not null default false,

`  `deleted\_at      timestamptz,                          -- soft delete; 30-day grace

`  `created\_at      timestamptz not null default now(),

`  `updated\_at      timestamptz not null default now()

);

create index users\_email\_idx on public.users (lower(email)) where deleted\_at is null;

create index users\_active\_idx on public.users (id) where deleted\_at is null;


### **3.2.2  families**
A family circle — one wearer (parent\_owner) and 0..N caregivers. The created\_by user becomes the family\_owner.

create table public.families (

`  `id                  uuid primary key default gen\_random\_uuid(),

`  `parent\_user\_id      uuid references public.users(id) on delete restrict,

`  `parent\_display\_name text not null,                  -- 'Mom', 'Mama Linda', 'Dad'

`  `parent\_relationship text not null,                  -- 'mother','father','aunt','other:godmother'

`  `parent\_year\_of\_birth smallint,

`  `parent\_residence    text,                           -- 'Lagos, Nigeria'

`  `subscription\_status text not null default 'free' check (subscription\_status in ('free','plus','plus\_trial','plus\_grace','past\_due')),

`  `subscription\_renewal\_date timestamptz,

`  `created\_by          uuid not null references public.users(id) on delete restrict,

`  `created\_at          timestamptz not null default now(),

`  `updated\_at          timestamptz not null default now()

);

create index families\_created\_by\_idx on public.families (created\_by);

create index families\_parent\_user\_idx on public.families (parent\_user\_id);


### **3.2.3  family\_members**
Membership table. Joins users to families with a role. Replaces the older family\_caregivers naming from D4 §3.2.2 — broader because it includes parent roles.

create type public.family\_role as enum ('family\_owner','caregiver','parent\_owner','parent\_viewer');



create table public.family\_members (

`  `family\_id     uuid not null references public.families(id) on delete cascade,

`  `user\_id       uuid not null references public.users(id) on delete cascade,

`  `role          public.family\_role not null,

`  `invited\_by    uuid references public.users(id) on delete set null,

`  `joined\_at     timestamptz not null default now(),

`  `removed\_at    timestamptz,                          -- soft removal

`  `removed\_reason text,

`  `primary key (family\_id, user\_id)

);

create index family\_members\_user\_idx on public.family\_members (user\_id) where removed\_at is null;

-- one and only one family\_owner per family at a time

create unique index family\_members\_one\_owner

`  `on public.family\_members (family\_id) where role = 'family\_owner' and removed\_at is null;

-- one and only one parent\_owner per family at a time

create unique index family\_members\_one\_parent\_owner

`  `on public.family\_members (family\_id) where role = 'parent\_owner' and removed\_at is null;


### **3.2.4  devices**
create table public.devices (

`  `id                  uuid primary key default gen\_random\_uuid(),

`  `family\_id           uuid not null references public.families(id) on delete restrict,

`  `serial\_number       text not null unique,           -- last-4-of-MAC visible to user

`  `mac\_address         text not null,

`  `model               text not null check (model in ('U16H','U19M')),

`  `firmware\_version    text,

`  `paired\_at           timestamptz not null default now(),

`  `paired\_by\_user\_id   uuid not null references public.users(id),

`  `unpaired\_at         timestamptz,                    -- soft unbind

`  `last\_sync\_at        timestamptz,

`  `last\_battery\_pct    smallint check (last\_battery\_pct between 0 and 100),

`  `created\_at          timestamptz not null default now()

);

create index devices\_family\_idx on public.devices (family\_id) where unpaired\_at is null;

create unique index devices\_active\_mac on public.devices (mac\_address) where unpaired\_at is null;


### **3.2.5  readings**
The core data table. NEVER hard-deleted. Soft delete via hidden + hidden\_reason (resolves D6 §9.1 watch-deletion assumption).

create type public.reading\_source as enum ('watch','manual','clinic','pharmacy','other');

create type public.quality\_score    as enum ('good','fair','suspect');

create type public.hidden\_reason as enum (

`  `'cuff\_slipped',

`  `'measured\_someone\_else',

`  `'duplicate\_reading',

`  `'parent\_request',

`  `'caregiver\_correction',

`  `'other'

);



create table public.readings (

`  `id                  uuid primary key default gen\_random\_uuid(),

`  `family\_id           uuid not null references public.families(id) on delete restrict,

`  `device\_id           uuid references public.devices(id) on delete set null,

`  `source              public.reading\_source not null default 'watch',

`  `measured\_at         timestamptz not null,           -- parent local time, stored UTC

`  `measured\_at\_local   text,                           -- ISO with offset, for display

`  `systolic            smallint not null check (systolic between 30 and 300),

`  `diastolic           smallint not null check (diastolic between 20 and 200),

`  `pulse               smallint check (pulse between 30 and 240),

`  `quality\_score       public.quality\_score,

`  `quality\_flags       jsonb not null default '{}',     -- raw bits from BLE 0x14

`  `motion\_detected     boolean,

`  `hidden              boolean not null default false,

`  `hidden\_reason       public.hidden\_reason,

`  `hidden\_by\_user\_id   uuid references public.users(id),

`  `hidden\_at           timestamptz,

`  `created\_at          timestamptz not null default now()

);

-- One row per (device, measured\_at) pair; defends against BLE retries

create unique index readings\_dedupe on public.readings (device\_id, measured\_at)

`  `where device\_id is not null;

create index readings\_family\_time on public.readings (family\_id, measured\_at desc);

create index readings\_visible on public.readings (family\_id, measured\_at desc) where hidden = false;

-- partial index used by anomaly engine: only baseline-eligible rows

create index readings\_for\_baseline on public.readings (family\_id, measured\_at)

`  `where hidden = false and source = 'watch' and quality\_score in ('good','fair');


### **3.2.6  reading\_notes**
Caregiver- or parent-authored notes attached to a reading (D6 US-27).

create table public.reading\_notes (

`  `id            uuid primary key default gen\_random\_uuid(),

`  `reading\_id    uuid not null references public.readings(id) on delete cascade,

`  `family\_id     uuid not null references public.families(id) on delete cascade,

`  `author\_id     uuid not null references public.users(id) on delete restrict,

`  `body          text not null check (length(body) <= 500),

`  `created\_at    timestamptz not null default now()

);

create index reading\_notes\_reading\_idx on public.reading\_notes (reading\_id);


### **3.2.7  reading\_comments**
Multi-caregiver comment thread on a reading (D6 US-50).

create table public.reading\_comments (

`  `id            uuid primary key default gen\_random\_uuid(),

`  `reading\_id    uuid not null references public.readings(id) on delete cascade,

`  `family\_id     uuid not null references public.families(id) on delete cascade,

`  `author\_id     uuid not null references public.users(id) on delete restrict,

`  `body          text not null check (length(body) <= 280),

`  `emoji         text check (length(emoji) <= 8),

`  `created\_at    timestamptz not null default now()

);

create index reading\_comments\_reading\_idx on public.reading\_comments (reading\_id);


### **3.2.8  vitals\_other  (HR, SpO2, sleep, steps)**
Non-BP vitals share a denormalised table; partitioning by metric\_type if scale demands.

create type public.vital\_type as enum ('hr','spo2','sleep\_session','steps\_day','calories\_day');



create table public.vitals\_other (

`  `id            uuid primary key default gen\_random\_uuid(),

`  `family\_id     uuid not null references public.families(id) on delete restrict,

`  `device\_id     uuid references public.devices(id),

`  `vital\_type    public.vital\_type not null,

`  `measured\_at   timestamptz not null,

`  `-- generic value columns; NULLs ignored per type

`  `value\_int     integer,                             -- HR bpm; steps; calories

`  `value\_int\_2   integer,                             -- SpO2 max for sample window

`  `value\_int\_3   integer,                             -- SpO2 min, sleep deep min, etc.

`  `value\_jsonb   jsonb,                               -- sleep stages, stage transitions

`  `hidden        boolean not null default false,

`  `hidden\_reason text,

`  `created\_at    timestamptz not null default now()

);

create unique index vitals\_dedupe

`  `on public.vitals\_other (device\_id, vital\_type, measured\_at) where device\_id is not null;

create index vitals\_family\_time on public.vitals\_other (family\_id, vital\_type, measured\_at desc);


### **3.2.9  subscriptions  (denormalised RevenueCat state)**
create table public.subscriptions (

`  `user\_id              uuid primary key references public.users(id) on delete cascade,

`  `rc\_app\_user\_id       text not null,                -- RevenueCat App User ID

`  `product\_id           text,                         -- com.lawonecloud.leiko.plus.monthly

`  `entitlement          text not null default 'plus',

`  `status               text not null check (status in ('active','trialing','grace','past\_due','cancelled','expired')),

`  `trial\_ends\_at        timestamptz,

`  `current\_period\_end   timestamptz,

`  `cancelled\_at         timestamptz,

`  `last\_event\_at        timestamptz not null default now(),

`  `raw\_event            jsonb                          -- full latest webhook for audit

);


### **3.2.10  invitations**
Pending invitations from a caregiver to add another caregiver or pair the parent watch (D6 US-6, US-45).

create type public.invitation\_kind as enum ('caregiver','parent\_pairing');



create table public.invitations (

`  `id              uuid primary key default gen\_random\_uuid(),

`  `family\_id       uuid not null references public.families(id) on delete cascade,

`  `invited\_by      uuid not null references public.users(id),

`  `kind            public.invitation\_kind not null,

`  `invitee\_label   text,                              -- 'My sister Tola'

`  `invitee\_email   text,

`  `invitee\_phone   text,

`  `pairing\_code    text unique,                       -- 6-digit code for parent\_pairing

`  `url\_token       text not null unique default encode(gen\_random\_bytes(24),'base64url'),

`  `expires\_at      timestamptz not null,

`  `accepted\_at     timestamptz,

`  `accepted\_by     uuid references public.users(id),

`  `cancelled\_at    timestamptz,

`  `created\_at      timestamptz not null default now()

);

create index invitations\_family\_active

`  `on public.invitations (family\_id) where accepted\_at is null and cancelled\_at is null;


### **3.2.11  ai\_conversations / ai\_messages**
create table public.ai\_conversations (

`  `id              uuid primary key default gen\_random\_uuid(),

`  `user\_id         uuid not null references public.users(id) on delete cascade,

`  `family\_id       uuid not null references public.families(id) on delete cascade,

`  `context         text not null check (context in ('home','reading\_detail','weekly\_summary','onboarding')),

`  `created\_at      timestamptz not null default now()

);



create table public.ai\_messages (

`  `id              uuid primary key default gen\_random\_uuid(),

`  `conversation\_id uuid not null references public.ai\_conversations(id) on delete cascade,

`  `role            text not null check (role in ('system','user','assistant')),

`  `body            text not null,

`  `tier            text check (tier in ('A','B','C')),

`  `model           text,                              -- 'claude-haiku-4-5-20251001'

`  `prompt\_tokens   int,

`  `completion\_tokens int,

`  `flagged         boolean not null default false,    -- forbidden-claims classifier hit

`  `user\_thumb      smallint check (user\_thumb in (-1,0,1)),

`  `created\_at      timestamptz not null default now()

);

create index ai\_messages\_conversation\_idx on public.ai\_messages (conversation\_id, created\_at);


### **3.2.12  audit\_log**
create table public.audit\_log (

`  `id              bigserial primary key,

`  `occurred\_at     timestamptz not null default now(),

`  `actor\_user\_id   uuid references public.users(id),

`  `family\_id       uuid references public.families(id),

`  `action          text not null,                    -- e.g. 'reading.read', 'family.role\_change'

`  `target\_type     text,

`  `target\_id       uuid,

`  `metadata        jsonb not null default '{}',

`  `ip\_inet         inet,

`  `user\_agent      text

) partition by range (occurred\_at);

-- monthly partitions; rolled by a cron Edge Function

create index audit\_actor\_idx on public.audit\_log (actor\_user\_id, occurred\_at desc);

create index audit\_family\_idx on public.audit\_log (family\_id, occurred\_at desc);


### **3.2.13  push\_tokens**
create table public.push\_tokens (

`  `user\_id         uuid not null references public.users(id) on delete cascade,

`  `device\_id       text not null,                   -- per-device install identifier

`  `expo\_token      text not null,

`  `apns\_token      text,

`  `fcm\_token       text,

`  `platform        text not null check (platform in ('ios','android','web')),

`  `app\_version     text,

`  `os\_version      text,

`  `last\_seen\_at    timestamptz not null default now(),

`  `primary key (user\_id, device\_id)

);


### **3.2.14  shopify\_orders  (light tracking — D6 §9.1 row 6 resolution)**
create table public.shopify\_orders (

`  `id                  bigserial primary key,

`  `user\_id             uuid references public.users(id),

`  `family\_id           uuid references public.families(id),

`  `shopify\_order\_id    bigint not null unique,

`  `order\_number        text,

`  `fulfilment\_status   text,                       -- pending, shipped, delivered

`  `carrier             text,

`  `tracking\_number     text,

`  `tracking\_url        text,                       -- caregiver dashboard link-out

`  `ship\_date           timestamptz,

`  `estimated\_delivery  date,

`  `delivered\_at        timestamptz,

`  `raw\_event           jsonb,

`  `updated\_at          timestamptz not null default now()

);

create index shopify\_orders\_user\_idx on public.shopify\_orders (user\_id);


## **3.3  Row-Level Security  (RLS)**
All tables have RLS enabled. The /sync, /check-alerts, /generate-doctor-report, /revenuecat-webhook, and /shopify-webhook Edge Functions run with the service\_role key and bypass RLS by design — every other path goes through user-context RLS. Policies use a helper:

create or replace function public.is\_family\_member(\_family\_id uuid)

returns boolean language sql stable security definer set search\_path = public as $$

`  `select exists (

`    `select 1 from public.family\_members

`    `where family\_id = \_family\_id

`      `and user\_id = auth.uid()

`      `and removed\_at is null

`  `);

$$;



create or replace function public.is\_family\_owner(\_family\_id uuid)

returns boolean language sql stable security definer set search\_path = public as $$

`  `select exists (

`    `select 1 from public.family\_members

`    `where family\_id = \_family\_id

`      `and user\_id = auth.uid()

`      `and role = 'family\_owner'

`      `and removed\_at is null

`  `);

$$;


### **3.3.1  Reading policies**
alter table public.readings enable row level security;



create policy "members read" on public.readings

`  `for select using (public.is\_family\_member(family\_id));



create policy "service inserts" on public.readings

`  `for insert with check (auth.role() = 'service\_role');



create policy "members soft-hide" on public.readings

`  `for update using (public.is\_family\_member(family\_id))

`  `with check (

`    `-- only hidden flag fields may change via this path

`    `(old.systolic, old.diastolic, old.pulse, old.measured\_at)

`      `= (new.systolic, new.diastolic, new.pulse, new.measured\_at)

`    `and new.hidden\_by\_user\_id = auth.uid()

`  `);



-- HARD DELETE FORBIDDEN for watch readings; allowed only for source = 'manual'

create policy "manual delete only" on public.readings

`  `for delete using (

`    `public.is\_family\_member(family\_id) and source = 'manual'

`  `);


### **3.3.2  Family / membership policies**
alter table public.families enable row level security;

create policy "members read family" on public.families

`  `for select using (public.is\_family\_member(id));

create policy "owner update family" on public.families

`  `for update using (public.is\_family\_owner(id));

-- inserts handled via /create-family Edge Function (service\_role)



alter table public.family\_members enable row level security;

create policy "members see members" on public.family\_members

`  `for select using (public.is\_family\_member(family\_id));

create policy "owner edits members" on public.family\_members

`  `for update using (public.is\_family\_owner(family\_id));

create policy "self-leave" on public.family\_members

`  `for update using (user\_id = auth.uid())

`  `with check (removed\_at is not null);

create policy "parent\_owner self-revoke" on public.family\_members

`  `for update using (

`    `user\_id = auth.uid()  -- this case unused in v1; here to be explicit

`  `);


### **3.3.3  Reading-related child tables**
-- reading\_notes, reading\_comments, vitals\_other all follow the family-scoped pattern:

alter table public.reading\_notes enable row level security;

create policy "members read notes" on public.reading\_notes

`  `for select using (public.is\_family\_member(family\_id));

create policy "members write own notes" on public.reading\_notes

`  `for insert with check (

`    `public.is\_family\_member(family\_id) and author\_id = auth.uid()

`  `);

create policy "author edit own notes" on public.reading\_notes

`  `for update using (author\_id = auth.uid());



-- (vitals\_other and reading\_comments mirror this pattern)


### **3.3.4  Audit log**
alter table public.audit\_log enable row level security;

-- read access only for: family\_owner of the family in question, and users seeing their own events

create policy "owner reads family audit" on public.audit\_log

`  `for select using (

`    `family\_id is not null and public.is\_family\_owner(family\_id)

`  `);

create policy "self reads own audit" on public.audit\_log

`  `for select using (actor\_user\_id = auth.uid());

-- writes are service\_role only (audit hook in Edge Functions)

create policy "service inserts audit" on public.audit\_log

`  `for insert with check (auth.role() = 'service\_role');


## **3.4  Soft-Delete Strategy (canonical)**

|**Entity**|**Soft-delete column(s)**|**Hard delete?**|**Retention**|
| :- | :- | :- | :- |
|users (account)|deleted\_at|After 30-day grace period|30 days grace, then anonymised; 7 years for required audit trail|
|readings (watch)|hidden, hidden\_reason, hidden\_at|Never (forbidden by RLS)|Until family\_owner deletes account|
|readings (manual)|hidden / direct delete|Allowed (own author)|Same as above|
|family\_members|removed\_at, removed\_reason|Never|Persisted for audit even after removal|
|devices|unpaired\_at|Never|Persisted; same row may be re-paired (factory reset on watch resets MAC binding)|
|invitations|cancelled\_at|Allowed after 90 days expiry|90 days, then purged by /retention cron|
|ai\_messages|n/a (immutable)|Bulk delete on user request|90 days, unless user opts in to longer|
|audit\_log|n/a|Partitions dropped after 7 years|90 days hot, 7 years archive (per D6 §6.2)|


# **§4  API Surface**
All app↔server traffic goes through one of: (a) Supabase PostgREST (auto-generated REST over RLS-enforced tables) for simple CRUD, (b) Supabase Realtime channels for live updates, (c) Edge Functions for any logic that must run server-side. The app NEVER calls third-party APIs directly except RevenueCat's SDK (sandbox-validated by their servers).


## **4.1  Edge Function Inventory**

|**Path**|**Method**|**Auth**|**Trigger**|**Purpose**|
| :- | :- | :- | :- | :- |
|/sync|POST|JWT|App after BLE read|Validate, dedupe, insert readings + vitals; fire NOTIFY on reading\_inserted.|
|/check-alerts|POST (internal NOTIFY consumer)|service\_role|NOTIFY on reading\_inserted|Run anomaly logic (D6 §5.11), emit push\_queue rows.|
|/pairing-code|POST|JWT|App when caregiver invites parent|Generate 6-digit pairing code + url\_token; create invitations row.|
|/accept-pairing|POST|JWT or anonymous-token|Web/native pairing flow|Resolve url\_token → family\_id; bind device; mark invitation accepted.|
|/create-family|POST|JWT|Onboarding US-3|Create families row + family\_members(family\_owner).|
|/invite-caregiver|POST|JWT (must be family\_owner)|D6 US-45|Generate invitation; return shareable URL.|
|/accept-invite|POST|JWT|D6 US-46|Add user to family\_members(role=caregiver).|
|/transfer-ownership|POST|JWT (current owner)|D6 US-49|Atomic role swap; audit.|
|/remove-caregiver|POST|JWT (owner)|D6 US-44|Set removed\_at; push notify removed user.|
|/leave-family|POST|JWT|D6 US-48|Self-remove from family\_members.|
|/revoke-parent-consent|POST|JWT (parent\_owner only)|D6 US-39 / US-44|Strip caregiver access; readings stop streaming until re-consented.|
|/generate-doctor-report|POST|JWT (Plus only)|D6 US-54|Enqueue n8n workflow; return job\_id; final URL pushed back.|
|/share-link|POST|JWT (Plus only)|D6 US-55|Mint time-limited (24h or 7d) read-only signed URL.|
|/data-export|POST|JWT|D6 US-57|Enqueue CSV; email link.|
|/account-delete|POST|JWT|D6 US-82|Mark deleted\_at; schedule 30-day purge.|
|/account-restore|POST|JWT (within grace)|D6 US-82|Clear deleted\_at if within 30 days.|
|/ai-query|POST|JWT|D6 US-59 / US-61|Routed via LiteLLM; tier inferred from prompt classifier.|
|/revenuecat-webhook|POST|RevenueCat signature|External|Update subscriptions row.|
|/shopify-webhook|POST|Shopify HMAC|External|Update shopify\_orders row.|
|/firmware-manifest|GET|JWT|App device-info screen|Return latest approved firmware version + URL (if applicable).|
|/health|GET|none|External monitor|Liveness check; returns version + db ping.|


## **4.2  Schemas**
All Edge Functions accept and return JSON. Schemas defined with Zod and shared between functions and the app via /functions/\_shared/types.ts. The two most critical schemas are below; the rest follow the same pattern.


### **4.2.1  /sync — Request**
{

`  `"device\_id": "uuid",            // server-side device row id

`  `"watch\_mac": "AA:BB:CC:DD:EE:FF", // for re-validation

`  `"readings": [

`    `{

`      `"measured\_at": "2026-04-23T07:14:32+01:00",  // ISO with parent's offset

`      `"systolic": 124,

`      `"diastolic": 79,

`      `"pulse": 71,

`      `"quality\_flags": { "motion": false, "weak\_pulse": false, "cuff\_loose": false },

`      `"client\_dedupe\_key": "0x14:1729665272"        // ts-from-watch; idempotency

`    `}

`  `],

`  `"vitals": [

`    `{ "type": "hr",    "measured\_at": "...", "value": 71 },

`    `{ "type": "spo2",  "measured\_at": "...", "max": 98, "min": 96 },

`    `{ "type": "steps\_day", "measured\_at": "2026-04-23", "value": 3204 }

`  `],

`  `"battery\_pct": 78,

`  `"firmware\_version": "1.0.02"

}


### **4.2.2  /sync — Response**
{

`  `"accepted": 4,

`  `"duplicates": 1,

`  `"rejected": [],

`  `"anomalies\_triggered": 1,

`  `"server\_time": "2026-04-23T06:14:35Z"

}


### **4.2.3  /ai-query — Request / Response**
// Request

{

`  `"conversation\_id": "uuid | null",

`  `"context": "home | reading\_detail | weekly\_summary | onboarding",

`  `"context\_id": "uuid | null",      // reading\_id when applicable

`  `"message": "Why was Mom's reading higher this morning?"

}



// Response

{

`  `"conversation\_id": "uuid",

`  `"message\_id": "uuid",

`  `"tier": "B",

`  `"body": "string",

`  `"deflected": false,                // true if model fell back to 'ask the doctor'

`  `"tokens": { "prompt": 412, "completion": 188 }

}


## **4.3  External Integrations**

|**Service**|**Integration kind**|**Direction**|**PHI sent?**|**Notes**|
| :- | :- | :- | :- | :- |
|Anthropic Claude API|HTTPS via LiteLLM|Outbound|Yes (under BAA)|Tier B and Tier C only. PHI must be scrubbed of direct identifiers (email, phone, full name optional). BAA required before launch (§14).|
|RevenueCat|SDK + webhook|Bidirectional|No|Only user\_id, product\_id, status. No reading data.|
|Shopify|Webhook|Inbound|No|orders/create, orders/fulfilled, orders/updated. HMAC verified.|
|Expo Notifications|HTTPS|Outbound|No|Notification body MAY contain reading values (per D6 US-75). User accepts this risk via push permission.|
|Apple App Store|StoreKit 2|Bidirectional via RevenueCat|No|Subscription only.|
|Google Play Billing|Billing v6|Bidirectional via RevenueCat|No|Subscription only.|
|Sentry|HTTPS (SDK)|Outbound|No (after scrub)|beforeSend hook strips PHI; CI test required.|
|Twilio (optional)|HTTPS|Outbound|Phone number only|Used for phone-number OTP IF email is unavailable. Not in MVP critical path.|
|n8n  (internal)|HTTPS|Outbound from Edge Functions|Yes (internal trust zone)|n8n runs on same Hetzner; calls Anthropic on workflow side.|



|<p>**PHI EGRESS RULE**</p><p>Only TWO destinations may receive PHI: (1) the LiteLLM gateway (which then calls Anthropic under BAA), and (2) the user's own device over BLE / HTTPS. Every other outbound integration MUST have PHI redacted in the wrapper. A linter (/tools/phi-egress-lint) scans every fetch/axios call in the codebase and BLOCKS the build if a PHI-shaped object is passed to a non-allowlisted host.</p>|
| :- |


# **§5  BLE Protocol Implementation**
This section sits on top of D4 Block 4 (the protocol reference) and specifies how the app implements it: the connection state machine, command wrappers, reconnection strategy, and per-failure-mode handling. Anyone implementing BLE should read §5 cover-to-cover before writing code.


## **5.1  GATT Profile (recap from D4)**

|**Role**|**UUID**|**Direction**|
| :- | :- | :- |
|Service|6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E|—|
|Write Characteristic|6E400002-B5A3-F393-E0A9-E50E24DCCA9E|Phone → Watch|
|Notify Characteristic|6E400003-B5A3-F393-E0A9-E50E24DCCA9E|Watch → Phone|

Packets are 16 bytes fixed length: byte 0 = command, bytes 1–14 = payload, byte 15 = CRC8 (sum of first 15 bytes mod 256).


## **5.2  Connection State Machine**
Implemented as an XState v5 finite-state machine in /apps/mobile/src/ble/connectionMachine.ts. Boolean flags (isConnected, isScanning) are FORBIDDEN — see D4 Block 4.3 rationale.

// connectionMachine.ts (XState v5)

import { setup, assign } from 'xstate';



type Ctx = {

`  `deviceId: string | null;

`  `retryCount: number;

`  `lastError: string | null;

};



export const connectionMachine = setup({

`  `types: { context: {} as Ctx, events: {} as

`    `| { type: 'BT\_READY' }

`    `| { type: 'BT\_OFF' }

`    `| { type: 'SCAN' }

`    `| { type: 'CANCEL' }

`    `| { type: 'CONNECT'; deviceId: string }

`    `| { type: 'CONNECTED' }

`    `| { type: 'DISCONNECTED'; reason?: string }

`    `| { type: 'SYNC\_START' }

`    `| { type: 'SYNC\_DONE' }

`    `| { type: 'ERROR'; message: string }

`  `},

`  `delays: {

`    `backoff: ({ context }) => {

`      `const ladder = [5\_000, 15\_000, 30\_000, 60\_000, 5\*60\_000, 15\*60\_000];

`      `return ladder[Math.min(context.retryCount, ladder.length - 1)];

`    `},

`  `},

}).createMachine({

`  `id: 'ble',

`  `initial: 'uninitialized',

`  `context: { deviceId: null, retryCount: 0, lastError: null },

`  `states: {

`    `uninitialized: { on: { BT\_READY: 'idle', BT\_OFF: 'powered\_off' } },

`    `powered\_off:   { on: { BT\_READY: 'idle' } },

`    `idle: {

`      `on: {

`        `SCAN:    'scanning',

`        `CONNECT: { target: 'connecting',

`                   `actions: assign({ deviceId: ({ event }) => event.deviceId }) },

`      `},

`    `},

`    `scanning: {

`      `on: {

`        `CANCEL: 'idle',

`        `CONNECT: { target: 'connecting',

`                   `actions: assign({ deviceId: ({ event }) => event.deviceId }) },

`      `},

`      `after: { 60\_000: 'idle' },         // scan timeout

`    `},

`    `connecting: {

`      `on: {

`        `CONNECTED: { target: 'connected',

`                     `actions: assign({ retryCount: () => 0 }) },

`        `ERROR:    { target: 'reconnecting',

`                    `actions: assign({ lastError: ({ event }) => event.message,

`                                      `retryCount: ({ context }) => context.retryCount + 1 }) },

`      `},

`      `after: { 30\_000: { target: 'reconnecting',

`                         `actions: assign({ retryCount: ({ context }) => context.retryCount + 1 }) } },

`    `},

`    `connected: {

`      `on: {

`        `SYNC\_START:   'syncing',

`        `DISCONNECTED: 'reconnecting',

`      `},

`    `},

`    `syncing: {

`      `on: {

`        `SYNC\_DONE:    'connected',

`        `DISCONNECTED: 'reconnecting',

`        `ERROR:        'connected',          // log; stay connected

`      `},

`    `},

`    `reconnecting: {

`      `after: {

`        `backoff: { target: 'connecting' },

`      `},

`      `on: {

`        `BT\_OFF: 'powered\_off',

`        `CANCEL: 'idle',

`      `},

`      `// give up after 6 escalations

`      `always: [

`        `{ guard: ({ context }) => context.retryCount > 6, target: 'idle' },

`      `],

`    `},

`  `},

});


### **5.2.1  State Diagram**


`   `uninitialized ──BT\_READY──► idle ──SCAN──► scanning

`        `│                       │   ◄────CANCEL──┘

`        `▼ BT\_OFF                │

`   `powered\_off ◄── BT\_OFF ──────┤

`        `│                       │ CONNECT

`        `│ BT\_READY               ▼

`        `▼                  connecting ─CONNECTED─► connected

`        `idle                    │                     │ SYNC\_START

`                                `│ ERROR/timeout       ▼

`                                `▼                  syncing ─SYNC\_DONE─►

`                          `reconnecting ◄─DISCONNECTED─── connected

`                                `│ backoff (5,15,30,60,300,900s)

`                                `└────► connecting (retry)




## **5.3  Command Inventory**
Fourteen commands are wired in v1.0 (per D4 Block 4.5 reference). Each is a TypeScript wrapper in /apps/mobile/src/ble/commands/. Wrappers are pure functions; they consume a connected device handle and return a typed Promise.

|**Cmd**|**Hex**|**Wrapper**|**Used in**|
| :- | :- | :- | :- |
|Set time / language|0x01|setTime(device, tz)|D6 US-22|
|Set goals|0x21|setGoals(device, goals)|D6 US-86|
|Read activity (steps, calories)|0x12|readActivity(device, day)|D6 US-30|
|Read sleep|0x12 / 0x13|readSleep(device, day)|D6 US-29|
|Set user parameters (gender/age/h/w)|0x0A|setUserParams(device, p)|D6 US-86|
|Set time format / metric|0x04|setTimeFormat(device, fmt)|D6 US-86|
|Auto HR on/off|0x16|setAutoHR(device, bool)|D6 US-87|
|Read HR history|0x15|readHRHistory(device, since)|D6 US-29 / US-31|
|Read BP history|0x14|readBPHistory(device, since)|Core sync|
|Auto SpO2 on/off|0x2C|setAutoSpO2(device, bool)|D6 US-87|
|Read SpO2 history|0x2D|readSpO2History(device, day)|D6 US-31|
|Find watch (vibrate)|0x50|findWatch(device)|D6 US-84 helper|
|Watch-pushed notification|0x73|subscribed via Notify char|Live trigger (D6 §5.11)|
|Factory reset|0xFF|factoryReset(device, confirm)|D6 US-84 unpair|


### **5.3.1  Wrapper template**
// All wrappers follow this shape: build packet, write, await response, validate.

import { Device } from 'react-native-ble-plx';

import { buildPacket, expectByte0, sendCommand } from '../io';



export async function setAutoHR(device: Device, enabled: boolean): Promise<void> {

`  `const payload = new Uint8Array(14);

`  `payload[0] = 0x02;                 // sub-command per protocol

`  `payload[1] = enabled ? 0x01 : 0x02;

`  `await sendCommand(device, 0x16, payload, expectByte0(0x16));

}


## **5.4  Reconnection Strategy**
Reconnection is the single highest-leverage piece of code in the BLE stack. The strategy:

- Exponential backoff: 5s, 15s, 30s, 60s, 5m, 15m. Retry count resets to 0 on a successful connect.
- Cap at 6 escalations; after the 6th failure, the state machine returns to IDLE and the UI surfaces a "tap to retry" affordance. This prevents radio churn (battery drain).
- On iOS: use the BleManager state restoration identifier; iOS will auto-reconnect on advertise, and willRestoreState wakes the app to a CONNECTED transition.
- On Android: a Foreground Service holds the BLE connection; FOREGROUND\_SERVICE\_CONNECTED\_DEVICE service type required (Android 14+).
- On EVERY successful reconnect: write 0x01 (set time / sync clock to parent local TZ) before issuing any read. The watch clock drifts.
- Only one reconnection attempt at a time per device (mutex per device\_id).


## **5.5  Failure-mode Handling**

|**Failure**|**Detection**|**Handling**|**User-facing surface**|
| :- | :- | :- | :- |
|Bluetooth disabled|BleManager.state() != PoweredOn|Transition to POWERED\_OFF; surface modal asking user to enable BT|Modal: "Turn on Bluetooth to keep Mom's watch in sync"|
|Permission denied (Android)|PermissionsAndroid.request returned not-granted|Settings deep link with explainer|Inline explainer + button → Android settings|
|Watch out of range|0x73 timeout > 60s after expected|Stay in CONNECTED; do not surface anything to caregiver|Status pill: "Last sync 4h ago"|
|Watch low battery|0x73 0x0C event with battery < 20%|Banner on dashboard (D6 US-32)|Calm banner; no panic|
|CRC failure on packet|crc8(packet[0..14]) != packet[15]|Drop packet, request retransmit|Silent (logged to PostHog as ble\_crc\_fail)|
|Bond lost (factory-reset elsewhere)|discoverServices error AUTH\_FAIL|Show repair flow (D6 US-19)|Help screen|
|Multi-watch confusion|Multiple devices match service UUID|Show last-4-of-MAC + "match this code on the watch"|D6 US-18 disambiguation modal|
|Connection drops during sync (multi-packet)|Mid-sequence DISCONNECTED|Mark cursor at last successful packet; resume on reconnect|Silent|
|Foreground service killed (Samsung One UI)|Service onDestroy|Restart with foreground intent flag; if killed twice in 1h, prompt user to disable battery optimisations|Onboarding-time prime + settings deep link|
|Firmware bug returns malformed BP|sys < 30 or dia < 20 server-side rejection|Reject reading; PostHog event ble\_invalid\_reading; surface NOTHING to user|Hidden (would erode trust)|


## **5.6  Web Bluetooth Pairing (Parent Side — Resolution Applied)**

|<p>**LOCK: Web Bluetooth on Android Chrome is the primary parent-pairing path; iOS native fallback**</p><p>Per the founder resolution carried forward from the prior session: Nigeria is ~85% Android (Statcounter Nov 2025); the parent's phone in Lagos is overwhelmingly likely to be Android Chrome, where Web Bluetooth is supported. The parent receives a WhatsApp link from the caregiver, taps it, lands on a one-screen mobile web pairing flow at https://pair.leiko.app/{url\_token}, grants Web Bluetooth permission, and the watch is paired in ≤ 2 minutes without installing an app.</p><p>iOS Safari does NOT support Web Bluetooth. On iOS, the pairing page detects this (navigator.bluetooth === undefined) and routes to a Universal Link: leiko://pair?token=...  The link opens the Leiko app if installed, otherwise the App Store. Once the app is installed, the deep link is preserved and the pairing context is restored on first launch.</p><p>US pre-pairing was rejected on shipping cost grounds.</p>|
| :- |


### **5.6.1  Web pairing tech stack**
- Single Next.js page hosted on Vercel (separate repo /leiko-pair-web; no PHI; no auth).
- Web Bluetooth APIs: navigator.bluetooth.requestDevice({ filters: [{ services: ["6E40FFF0-..."] }]}).
- Communicates with the same Edge Function /accept-pairing using the url\_token.
- Once /accept-pairing returns success: device is bound to the family. The parent then takes their first reading (D6 US-17) directly from the watch.
- Web pairing flow does NOT do background sync; the parent is encouraged at this point to install the native app for ongoing sync (D6 US-15 voice copy).


# **§6  Authentication & Authorization**

## **6.1  Sign-up / Sign-in**

|**Method**|**Platforms**|**Implementation**|**Notes**|
| :- | :- | :- | :- |
|Email + magic link / OTP|iOS, Android, Web pairing|Supabase Auth (GoTrue)|6-digit OTP delivered via email; 10-minute validity; 5 attempts max.|
|Apple Sign-In|iOS (required by App Store)|@invertase/react-native-apple-authentication + Supabase exchange|Email may be Apple private relay; treat as canonical regardless.|
|Google Sign-In|Android (preferred), iOS (optional)|@react-native-google-signin/google-signin + Supabase exchange|Use One Tap on Android.|
|Phone OTP (Twilio Verify)|Optional V2|Deferred|Some diaspora users prefer phone — flagged for V2.|


### **6.1.1  JWT and refresh handling**
- Access token: Supabase JWT, 1-hour validity. Stored encrypted in MMKV (iOS Keychain / Android Keystore backed).
- Refresh token: opaque string from GoTrue. Stored encrypted. Used by Supabase SDK auto-refresh.
- Force re-auth after 90 days of complete inactivity (per D6 §6.2). On 401 with refresh failure, route to sign-in screen with deep-link return target preserved.
- PKCE: enabled for all OAuth flows (Apple/Google) — required by App Store guidelines and best practice.


## **6.2  Family Invitation Flows**
Two invitation kinds, both backed by the public.invitations table:


### **6.2.1  Caregiver invitation (D6 US-45)**
- family\_owner taps Invite → enter invitee label, optional email/phone.
- App calls /invite-caregiver. Server creates invitations row with kind=caregiver, url\_token (24-byte URL-safe), expires\_at = now() + 14 days.
- Server returns shareable URL: https://leiko.app/join/{url\_token}. App opens platform share sheet (default to WhatsApp on Android per §10).
- Invitee taps link → if app installed, deep links to /join/{url\_token}; else App Store / Play Store; on first open after install, deep link is restored.
- Invitee signs in (or signs up) → /accept-invite reads url\_token, validates, creates family\_members row with role=caregiver, marks invitation accepted\_at.
- All other caregivers receive a push: "Your sister Tola has joined the family circle."


### **6.2.2  Parent pairing invitation (D6 US-6)**
- Caregiver indicates parent will receive watch at a different address.
- App calls /pairing-code. Server creates invitations row with kind=parent\_pairing, generates 6-digit pairing\_code (only one active per family), url\_token, expires\_at = 24h after first use, single-use.
- App displays QR code containing JSON: { url: "https://pair.leiko.app/{url\_token}", code: "123456" }, plus a "share to WhatsApp" affordance.
- Parent receives link → opens on their device → §5.6 Web Bluetooth flow (Android Chrome) or Universal Link (iOS).
- On successful BLE bond: /accept-pairing creates devices row, marks invitation accepted\_at, fires push to caregiver: "Mom paired her watch."


## **6.3  Role Model (canonical from D6 US-44)**

|**Role**|**Can read readings?**|**Can invite caregivers?**|**Can remove caregivers?**|**Can soft-hide readings?**|**Can transfer ownership?**|**Can revoke own access?**|
| :- | :- | :- | :- | :- | :- | :- |
|family\_owner|✓ all|✓|✓|✓ (with reason)|✓|✓ (becomes regular caregiver)|
|caregiver|✓ all|—|—|✓ (with reason)|—|✓|
|parent\_owner|✓ own|—|✓ revoke own data sharing|✓ (own readings only)|—|✓|
|parent\_viewer|✓ family|—|—|—|—|✓|



|<p>**AUTHZ ENFORCEMENT POINTS**</p><p>1\. RLS at the database (§3.3) — defense in depth and the primary enforcement.</p><p>2\. Edge Function role checks for any privileged operation (transfer ownership, remove caregiver, generate doctor report).</p><p>3\. App-side route guards for UI affordance (do not show "Remove" button to non-owners) — purely cosmetic; the server is the authority.</p><p>A bug that hides the Remove button on the client must STILL be caught by the server. CI test asserts /remove-caregiver returns 403 when caller is not family\_owner.</p>|
| :- |


# **§7  Privacy, Security & Compliance**

## **7.1  HIPAA Alignment (canonical position)**
Leiko is direct-to-consumer; we are not a Business Associate to a Covered Entity. HIPAA does not apply de jure. We adopt HIPAA-aligned best practices because (a) D3 lists them as the operational floor, (b) US-state laws (CCPA, CPRA, NY, Connecticut) impose substantively similar duties, (c) caregiver buyers expect it, (d) it future-proofs us if a covered-entity partnership emerges.


### **7.1.1  HIPAA-alignment checklist**

|**HIPAA element**|**Implementation in Leiko**|
| :- | :- |
|Encryption at rest|Postgres TDE on Hetzner block storage; Supabase Storage AES-256; MMKV via Keychain/Keystore on device.|
|Encryption in transit|TLS 1.3 for all HTTPS; BLE bonded encryption between watch ↔ phone.|
|Access controls|RLS at database; role-based authz at Edge Functions; MFA optional but encouraged.|
|Audit log|public.audit\_log records every PHI read/write; 90-day hot, 7-year archive (Hetzner cold storage).|
|BAAs with vendors|Signed: Hetzner DPA, Supabase n/a (self-hosted), RevenueCat DPA, Anthropic BAA (open §14).|
|Workforce training|Founder + any future engineer reads /docs/security/handbook.md before commit access; documented quarterly attestation.|
|Breach response|Runbook /docs/runbooks/incident-response.md. 72-hour disclosure timeline (consistent with GDPR).|
|Right to access|D6 US-57 CSV export; US-88 view-what-is-collected.|
|Right to delete|D6 US-82 account deletion with 30-day grace.|
|Right to amend|D6 US-26 manual reading correction; soft-hide watch readings with reason.|
|Minimum necessary|Edge Functions return scoped result sets; PHI never logged in Sentry; PostHog event metadata excludes reading values.|
|De-identification before AI|PHI scrubber strips email, phone, full name, device serial before payload reaches LiteLLM; only first names, year of birth, residence city, and reading values pass through.|


## **7.2  Data Residency**

|**Data class**|**Primary region**|**Replica**|**Notes**|
| :- | :- | :- | :- |
|Readings, vitals, family records|Hetzner Frankfurt (eu-central)|Hetzner Helsinki (eu-north) read-replica|GDPR-compatible. Latency to Lagos and US East both acceptable.|
|User auth (GoTrue)|Frankfurt|Helsinki|Same region as data.|
|File storage (PDFs, photos)|Frankfurt|Helsinki async|S3-compatible.|
|AI prompts/responses (transient)|LiteLLM in Frankfurt; Anthropic API US|None|Anthropic BAA covers US processing of PHI. Logs in Anthropic disabled per BAA.|
|Analytics events (PostHog)|Frankfurt|None|No PHI; can lose without breach.|
|Crash reports (Sentry)|Sentry SaaS US-East|Sentry-internal|No PHI after scrub.|
|Subscription state (RevenueCat)|RevenueCat US|RevenueCat-internal|No PHI.|


## **7.3  Encryption Inventory**

|**Layer**|**Algorithm**|**Key management**|
| :- | :- | :- |
|BLE link|AES-128 CCM (Bluetooth bonding)|Bonded keys held by OS BT stack on phone + watch flash.|
|Mobile ↔ Backend|TLS 1.3 (HTTPS)|Let's Encrypt certs on Hetzner; auto-renew.|
|Backend ↔ LiteLLM|TLS 1.3 (intra-Hetzner)|mTLS optional; on internal network.|
|LiteLLM ↔ Anthropic|TLS 1.3|API key in Hetzner secret store.|
|Postgres at rest|TDE (LUKS volume)|LUKS key in Hetzner KMS.|
|Storage at rest|AES-256 (Supabase Storage)|Per-bucket key.|
|Mobile keychain|iOS Keychain / Android Keystore (hardware-backed where available)|OS-managed.|
|Local DB (WatermelonDB)|SQLCipher AES-256|Key derived from Keychain entry; rotates on app re-install.|


## **7.4  Audit Log Requirements**
- Every PHI read returns at least one row of result → log: action="reading.read", target\_id=family\_id, metadata.count=N.
- Every PHI write → log: action="reading.created" / "reading.hidden" / "reading.note\_added".
- Every role / family\_member change → log: action="family.role\_change" with from→to.
- Every authentication event (sign-in, sign-out, refresh failure) → log.
- Every external PHI egress (only Anthropic per §7.2) → log: action="ai.egress" with token counts.
- Every account deletion → log immutable record retained 7 years.
- Audit log writes are by service\_role only; readable by family\_owner of the family in question and by the actor user themselves (RLS in §3.3.4).


## **7.5  Data Retention & Deletion Policy**

|**Data**|**Retention**|**Triggered by**|
| :- | :- | :- |
|Readings|Until user deletes account|D6 US-82|
|ai\_messages|90 days (default); user can opt to keep longer in Settings|Auto cron /retention|
|Audit log (hot)|90 days|Monthly partition rollover|
|Audit log (cold)|7 years|Hetzner cold storage; encrypted|
|Push tokens|Inactive > 60 days → purged|Cron|
|Invitations|90 days after expiry|Cron|
|Account (post-deletion)|30 days grace, then anonymise (PHI columns NULLed; user\_id retained for foreign-key integrity)|D6 US-82|
|Backups (Postgres)|30 days rolling; encrypted|Hetzner snapshot|


## **7.6  Parent Consent Flow (HIPAA-aligned)**
- At pairing time (D6 US-16), parent sees an explicit consent screen listing every caregiver in the family circle by name and photo.
- Two large buttons only: "Yes, I agree" / "Not now". No tiny pre-checked checkboxes.
- On Yes: write to public.audit\_log with action="parent.consent\_granted", metadata containing the consent text version (semver) and the list of caregiver\_user\_ids.
- On Not now: pairing rolls back; no readings stream until consent. Caregiver gets a calm push: "Your mom paired her watch but hasn't agreed to share readings yet. Talk to her about this when you can."
- Consent text versioning: consent text lives in /apps/mobile/src/i18n/consent/{locale}-v{n}.md. When the text materially changes, increment v{n}. App detects user has consented to v{n-1} and asks them to re-consent to v{n} on next launch.
- Withdraw at any time: parent\_owner can revoke any caregiver's access via /revoke-parent-consent. Revocation logged; caregiver receives: "Mom has updated who can see her readings. You've been removed."


## **7.7  Vulnerability Management**
- CI: npm audit + Snyk on every PR. High-severity vulns block merge.
- Dependabot weekly; owner-required PR review.
- Penetration test: deferred to post-launch unless MAU > 1,000 (per D6 §6.2).
- Bug bounty: defer to v2.
- Secret scanning: GitHub native + git-secrets pre-commit hook.
- Threat model documented in /docs/security/threat-model.md (STRIDE checklist for each Edge Function, refreshed quarterly).


# **§8  Push Notifications**

## **8.1  Categories**

|**Category**|**iOS Category ID**|**Android Channel**|**Default state**|**Quiet-hours behaviour**|
| :- | :- | :- | :- | :- |
|Daily summary|leiko.daily\_summary|daily-summary (DEFAULT)|On|Suppressed|
|Weekly summary|leiko.weekly\_summary|weekly-summary (DEFAULT)|On (Plus)|Suppressed|
|Anomaly|leiko.anomaly|anomaly (HIGH)|On (Plus)|Honored unless user opts to override|
|Watch status|leiko.device|device (LOW)|On|Suppressed|
|Family activity|leiko.family|family (DEFAULT)|On|Suppressed|
|Medication reminder|leiko.medication|medication (HIGH)|On (parent)|Always honored (medication is time-bound)|
|Subscription / account|leiko.account|account (LOW)|On|Suppressed|
|Marketing|leiko.marketing|marketing (LOW)|OFF (D5 §3.4)|Suppressed|


## **8.2  Per-Category Quiet Hours**
- Default 22:00–07:00 caregiver-local-time.
- Configurable in Settings (D6 US-78) per category.
- During quiet hours, only Anomaly + Medication categories may fire (and Anomaly only if user opts in).
- Other categories are batched and delivered at end-of-quiet-hours; if same category has > 1 deferred, app collapses into a single "3 family events overnight" notification.
- Per-category 24h rate limit: max 3 notifications per category. Excess batched.


## **8.3  Deep Linking Targets**

|**Category**|**URL**|**Target screen**|
| :- | :- | :- |
|Daily summary|leiko://home|Caregiver home dashboard|
|Weekly summary|leiko://weekly|Weekly view (D6 US-52)|
|Anomaly|leiko://reading/{reading\_id}|Reading detail (D6 US-24)|
|Watch status|leiko://settings/devices|Device settings (D6 US-84)|
|Family activity|leiko://family|Family screen (D6 US-47)|
|Medication reminder|leiko://parent/medication/{med\_id}|Parent medication detail|
|Subscription|leiko://settings/subscription|Subscription settings|
|Marketing|leiko://home|Home (no targeted deep link to avoid abuse)|



|<p>**UNIVERSAL LINKS / APP LINKS REQUIRED**</p><p>Universal Links (iOS) and App Links (Android) must be set up at the leiko.app domain so that http(s)://leiko.app/\* and pair.leiko.app/\* paths can deep-link into the app. Apple's apple-app-site-association file and Android's assetlinks.json are checked into /apps/mobile/well-known/. Required because the parent's WhatsApp link will be a regular https URL, not a leiko:// URI.</p>|
| :- |


## **8.4  Notification Body Templates**
Templates live in /apps/mobile/src/i18n/notifications/{locale}.ts. Each is a function(payload) => string. The copy-lint linter (D6 §6.5) runs over all template outputs in CI by feeding synthetic payloads and asserting no forbidden claim is produced. Voice pillars (D5 §3) apply: warm, calm, proactive, dignified.

// /apps/mobile/src/i18n/notifications/en.ts (excerpt)

export const notifications = {

`  `daily\_summary: (p: { parent: string, sys: number, dia: number, time: string, sleepH: number }) =>

`    ``Good morning. ${p.parent}'s reading was ${p.sys}/${p.dia} ${p.time}. She slept ${p.sleepH} hours.`,



`  `daily\_no\_reading: (p: { parent: string }) =>

`    ``No readings from ${p.parent} yesterday. Want to check in?`,



`  `anomaly\_single: (p: { parent: string, sys: number, dia: number }) =>

`    ``${p.parent}'s reading just now was higher than usual: ${p.sys}/${p.dia}. We've added it to her log.`,



`  `anomaly\_morning\_trend: (p: { parent: string }) =>

`    ``${p.parent}'s morning readings have been higher this week. Worth a check-in when you can.`,



`  `weekly\_summary: (p: { parent: string, body: string }) =>

`    `p.body, // body is the AI-generated first sentence; lint runs in CI before send



`  `watch\_low\_battery: (p: { parent: string, pct: number }) =>

`    ``${p.parent}'s watch battery is at ${p.pct}%. She'll need to charge it soon.`,

};


# **§9  Offline Behavior**

## **9.1  What works offline**

|**Surface**|**Offline behaviour**|**Notes**|
| :- | :- | :- |
|Caregiver dashboard|Reads from WatermelonDB (last 30 days)|Stale-while-revalidate. Banner: "Offline — last sync 4h ago" if last\_sync > 1h.|
|Reading detail|Cached|Comments / notes need network — show pending state.|
|Trends (week / month)|Cached for last fetched windows|Older windows fetch on connect.|
|Settings|Read-only when offline|Mutations queued.|
|AI assistant|Disabled offline|Surface explainer: "AI needs a connection."|
|Watch pairing (parent web)|Requires connection|Web pairing must reach /accept-pairing.|
|Parent watch local recording|Up to 30 days of readings stored locally on the watch|Per Urion U16PRO spec; resumes sync on next connect.|


## **9.2  Sync Strategy**
- Single source of truth: server. Local DB is a cache + outbound mutation queue.
- On reconnection: WatermelonDB sync adapter pulls server changes since last\_pulled\_at, pushes any queued local mutations.
- Conflict-free additive operations (creating a reading, adding a comment) cannot conflict; just retry with idempotency key.
- Mutating operations (hide a reading, edit a note) use last-write-wins by updated\_at — server timestamp is authoritative.
- Reading inserts use client\_dedupe\_key (the watch's own timestamp) so a re-sent /sync is idempotent.


## **9.3  Conflict Resolution**
Conflicts will be rare in practice — readings are append-only and ownership of a note/comment is single-author. The conflict-resolution rules below cover the few cases that exist:

|**Resource**|**Concurrent editors possible?**|**Resolution**|
| :- | :- | :- |
|readings (insert)|No — only /sync writes|Idempotent on (device\_id, measured\_at)|
|readings.hidden|Yes — multiple caregivers could hide simultaneously|Last write wins; both hidden\_reason values logged in audit|
|reading\_notes|Author-bound — one author per note|Author can update; others cannot|
|reading\_comments|No edit; append only|Trivial|
|family\_members.role|Only family\_owner edits|Server enforces single-owner unique index|
|settings/preferences|User-scoped|Last write wins|


# **§10  Internationalization**

## **10.1  Library Choice**

|<p>**LOCK: i18next + react-i18next**</p><p>Mature MessageFormat support (plurals, gender, ordinals), excellent TypeScript types, well-documented React Native integration, and supports lazy locale loading.</p><p>Rejected: FormatJS (heavier; ICU support is great but the runtime is larger), Lingui (modern but smaller community).</p>|
| :- |


## **10.2  Locale Detection**
- Default: device locale (Localization.locale on Expo).
- User override in Settings (D6 US-89). Override is persisted in MMKV.
- Region (currency display, BP unit) follows device region by default; mmHg is fixed in v1.0 (no kPa toggle).


## **10.3  String Externalization**
- All user-facing strings live in /apps/mobile/src/i18n/{locale}/{namespace}.json. NO hardcoded strings.
- CI lint: /tools/i18n-lint scans .tsx and .ts files for string literals inside JSX text or AlertButton labels and BLOCKS the build on hits (allowlist for technical strings like log messages).
- Namespaces: common, onboarding, dashboard, reading, family, ai, settings, notifications, errors, paywall, parent.
- Default locale: en. v2 locales staged but not enabled: en-NG (Nigerian English), pcm (Nigerian Pidgin), yo (Yoruba), ig (Igbo), es (Spanish).
- Translations require: native speaker pass + clinical reviewer pass on regulated copy (D6 §6.4).


## **10.4  RTL Readiness**
- All layouts use logical properties (start/end, marginInlineStart) where supported, otherwise wrapped in I18nManager.isRTL conditionals.
- Icons that have directional meaning (back arrow, next arrow) are mirrored in RTL via transform: scaleX(-1) helper.
- No RTL locales ship in v1.0; readiness verified via dev-only Arabic dummy locale at every release.


## **10.5  String File Structure (example)**
/apps/mobile/src/i18n/en/common.json

{

`  `"appName": "Leiko",

`  `"actions": {

`    `"continue": "Continue",

`    `"cancel": "Cancel",

`    `"save": "Save",

`    `"delete": "Delete",

`    `"remove": "Remove"

`  `},

`  `"time": {

`    `"justNow": "Just now",

`    `"minutesAgo": "{{count}} minute ago",

`    `"minutesAgo\_other": "{{count}} minutes ago",

`    `"hoursAgo": "{{count}} hour ago",

`    `"hoursAgo\_other": "{{count}} hours ago"

`  `}

}



/apps/mobile/src/i18n/en/dashboard.json

{

`  `"greeting": {

`    `"doingWell": "{{parent}} is doing well today",

`    `"noReadingYet": "{{parent}} paired her watch. We'll let you know when she takes her first reading."

`  `},

`  `"readingCard": {

`    `"latest": "Latest reading",

`    `"label.systolic": "Systolic",

`    `"label.diastolic": "Diastolic",

`    `"label.pulse": "Pulse",

`    `"unit.mmHg": "mmHg",

`    `"unit.bpm": "bpm"

`  `}

}


# **§11  Observability**

## **11.1  Logging Schema**
Backend logs (Edge Functions, n8n, Supabase) are emitted as structured JSON to stdout, ingested by Hetzner-side Loki, and queryable from Grafana (existing infra). Mobile clients log to Sentry breadcrumbs (transient) and PostHog events (persistent, PHI-free).

// Server log shape (every Edge Function uses /functions/\_shared/log.ts)

{

`  `"ts": "2026-04-23T07:14:35.421Z",

`  `"level": "info" | "warn" | "error",

`  `"fn": "sync",

`  `"request\_id": "uuid",

`  `"user\_id": "uuid | null",

`  `"family\_id": "uuid | null",

`  `"msg": "human readable",

`  `"metadata": { ... }                  // never contains PHI; enforced by lint

}


## **11.2  PHI Scrubbing**
A small library /functions/\_shared/phi-scrub.ts is used by every external-egress wrapper. It strips: email, phone, full names, device serial, watch MAC, exact reading values (sys/dia/pulse) when egressing to non-allowlisted hosts. The same library is imported by Sentry beforeSend and by the LiteLLM client wrapper.

// /functions/\_shared/phi-scrub.ts

const PHI\_KEYS = new Set([

`  `'email','phone','full\_name','first\_name','last\_name',

`  `'parent\_display\_name','caregiver\_display\_name',

`  `'mac\_address','serial\_number','device\_serial',

`  `'systolic','diastolic','pulse','sys','dia',

]);



export function scrubPhi<T>(obj: T): T {

`  `if (obj == null || typeof obj !== 'object') return obj;

`  `if (Array.isArray(obj)) return obj.map(scrubPhi) as T;

`  `const out: any = {};

`  `for (const [k, v] of Object.entries(obj)) {

`    `out[k] = PHI\_KEYS.has(k) ? '[redacted]' : scrubPhi(v);

`  `}

`  `return out;

}


## **11.3  Key Metrics**

|**Metric**|**Source**|**Target**|**Alert threshold**|
| :- | :- | :- | :- |
|BLE sync success rate|PostHog event ble.sync|≥ 95% per family per 24h|< 90% over 1h window|
|BLE pairing success rate|PostHog event ble.pair|≥ 90%|< 85% over 24h|
|/sync latency p95|Edge Function logs|≤ 800 ms|> 1500 ms over 5m|
|/ai-query latency p95 (Tier B)|LiteLLM logs|≤ 10 s|> 12 s over 15m|
|Push delivery success rate|Expo receipts|≥ 98%|< 95% over 1h|
|App cold start p50|PostHog perf event|≤ 2 s|> 3 s over 24h|
|Realtime subscription health|Supabase Realtime metrics|WebSocket up > 99.5%|< 99% over 15m|
|Anomaly false-positive rate|PostHog ai.feedback|≤ 15% thumbs-down on anomaly notifications|> 25% week over week|
|Forbidden-claim hits in production copy|Copy-lint output|0 (zero — hard requirement, D6 §8.5)|> 0 ANY release|
|Sentry crash-free sessions|Sentry|≥ 99.5%|< 99% over 24h|
|BAA scope monitor|manual quarterly review|all PHI egresses go through Anthropic BAA endpoint|any non-BAA egress detected|


## **11.4  Alerting**
- Critical alerts (BLE-sync collapse, /sync 5xx storm, copy-lint regression) → PagerDuty (founder personal phone) within 5 minutes.
- Warning alerts → email + Slack to founder; non-business hours batched.
- Daily digest: synthetic morning email summarising key metrics for the prior 24 hours.
- Weekly summary: tickets opened, copy-lint regressions, anomaly accuracy, AI cost vs cap.


# **§12  Testing Strategy**

## **12.1  Test Pyramid**

|**Layer**|**Tool**|**Coverage target**|**Run on**|
| :- | :- | :- | :- |
|Unit|Jest 29 + ts-jest|80% on /src/lib, /src/ble (excluding wrappers that need a device)|Every PR|
|Component|React Native Testing Library + Jest|70% on screens and components|Every PR|
|Edge Function|Deno test + supabase-test-helpers|100% on policy-critical paths (sync, accept-invite, transfer-ownership, revoke-consent)|Every PR|
|BLE mock|In-memory BLE adapter (/tools/ble-mock)|100% of command wrappers + state machine transitions|Every PR|
|Integration (BLE on real device)|Maestro + AWS Device Farm BLE units|Smoke suite of 12 critical flows|Nightly + before release|
|E2E|Maestro|Smoke + 8 critical user journeys|Before release|
|Soak|Custom harness on Hetzner GPU node|7-day continuous BLE connect/disconnect cycles|Before each release|
|Load|k6|500 concurrent /sync, 100 concurrent /ai-query|Before release|
|Security|Snyk + npm audit + git-secrets|No high/critical vulns|Every PR|
|Copy-lint|/tools/copy-lint|No forbidden claims (D6 §6.5)|Every PR; also runs over AI prompt fixtures|
|Accessibility|iOS Accessibility Inspector + Android Accessibility Scanner; manual VoiceOver/TalkBack|WCAG 2.2 AA on all V1 screens|Before release|
|Jailbreak/red-team (AI)|Custom suite of ~50 adversarial prompts|100% deflection rate|Every PR touching AI prompts|


## **12.2  E2E Choice**

|<p>**LOCK: Maestro (NOT Detox)**</p><p>Maestro is YAML-driven, ~10× faster setup than Detox, doesn't require a debug native build, and is well-suited to a small team. Detox remains relevant for very large React Native projects but the operational overhead does not pay back at this scale.</p><p>Rejected: Detox (heavier; native build required); Appium (older paradigm; harder to maintain).</p>|
| :- |


## **12.3  BLE Testing Approach**
- Mock layer: /tools/ble-mock implements the same TypeScript interface as the production BleManager. Every command wrapper is unit-tested against the mock with command/response sequences captured from real watches.
- Real-device test matrix: iOS (iPhone 12, 14, 15, 16 covering iOS 16/17/18). Android (Pixel 7/8/9, Samsung A-series + S-series, Xiaomi Redmi, Tecno + Itel for Nigerian market). Owned devices in QA lab + AWS Device Farm BLE-capable units.
- Long-soak tests: 48-hour and 7-day continuous-connect/disconnect cycles. State machine must not leak. Must run before EVERY major release.
- Tecno / Itel testing is mandatory before V1 launch. Source via Jumia Nigeria; ship to dev team.


## **12.4  Pre-flight Checks (Before Every Release)**
- All CI gates green on the release branch.
- Maestro E2E suite green on iOS + Android.
- Soak test green on at least one Tecno + one Samsung + one iPhone.
- Copy-lint produces zero hits across all string files AND across an AI fixture run of 200 prompts.
- Forbidden-claims linter green on all marketing surfaces (App Store listing, Shopify hero, paid social ad copy).
- Sentry PHI-redaction test green (synthetic crash with PHI-shaped fields arrives redacted).
- Accessibility audit log shows no AA violations on V1 screens.
- Performance benchmarks (cold start, dashboard render, /sync p95) within targets from D6 §6.1.


# **§13  Build & Release**

## **13.1  Branching Model**
- Trunk-based development on main.
- Feature branches: feature/{ticket-id}-{slug}. PR required; one approving review (founder or lead engineer).
- Release branches: release/v1.x.y created at code-freeze for App Store submission; only patch commits permitted (cherry-picked from main).
- Hotfix branches: hotfix/v1.x.y from the latest release tag; merged to both main and the release branch.
- All commits pushed to main go through CI (§13.4). No direct pushes; protected branch.


## **13.2  Versioning**
- SemVer for the app (1.0.0 at MVP launch). Major = breaking schema; Minor = new features; Patch = bugfix only.
- Build number increments monotonically per platform (iOS CFBundleVersion, Android versionCode).
- Release tag format: v{major}.{minor}.{patch} on main.


## **13.3  Release Cadence**
- MVP build phase: bi-weekly internal builds via EAS; weekly TestFlight + Play Internal Testing once the build is feature-complete.
- Post-launch: aim for fortnightly minor releases for the first 90 days, then monthly.
- Hotfixes: same-day to TestFlight Beta, expedited App Store review request reserved for genuine production-impacting issues.


## **13.4  CI Pipeline (GitHub Actions)**
\# .github/workflows/ci.yml (excerpt)

name: CI

on: [pull\_request, push]

jobs:

`  `lint-and-test:

`    `runs-on: ubuntu-latest

`    `steps:

`      `- checkout

`      `- setup-node@v4 (cache: yarn)

`      `- run: yarn install --frozen-lockfile

`      `- run: yarn typecheck         # tsc --noEmit

`      `- run: yarn lint              # eslint + prettier

`      `- run: yarn copy-lint         # forbidden-claims linter (D6 §6.5)

`      `- run: yarn i18n-lint         # no hardcoded strings

`      `- run: yarn phi-egress-lint   # only allowlisted hosts receive PHI

`      `- run: yarn test              # jest unit + RNTL component

`      `- run: yarn deno test --allow-net=local --allow-read functions/



`  `ble-mock-suite:

`    `runs-on: ubuntu-latest

`    `needs: lint-and-test

`    `steps: [ ... ]                  # exhaustive command-wrapper + state-machine tests



`  `security:

`    `runs-on: ubuntu-latest

`    `steps:

`      `- run: yarn audit --level high

`      `- uses: snyk/actions/node@master

`      `- uses: trufflesecurity/trufflehog@main



`  `sentry-phi-redaction:

`    `runs-on: ubuntu-latest

`    `steps:

`      `- run: yarn test:sentry-redaction  # asserts beforeSend strips PHI



`  `ai-redteam:

`    `runs-on: ubuntu-latest

`    `if: contains(github.event.pull\_request.labels.\*.name, 'ai')

`    `steps:

`      `- run: yarn test:ai-redteam        # 50 adversarial prompts; 100% deflection required


## **13.5  Build & Release Tooling**
- EAS Build (managed by Expo). Profiles: development, preview (TestFlight / Internal Testing), production.
- EAS Update for hotfix JS-only patches between full store releases (within Apple's and Google's policies).
- Code signing: Apple iOS distribution cert + provisioning profile in EAS-managed credentials. Android upload key in GitHub Secrets, signed by Google Play App Signing.


## **13.6  App Store / Play Store Submission Checklist**
- App Store listing copy passes copy-lint (D6 §6.5) and has been reviewed by founder + (recommended) FDA-savvy lawyer per D5 §11.4.
- Privacy nutrition label: Health & Fitness data; Identifiers (per device); Usage data; collected, linked to user, not used for tracking.
- App Store screenshots use authentic photography (D5 §4.3 hero composition).
- App description includes: 510(k) K141683 reference, "FDA-cleared blood pressure measurement", and the disclaimer "Leiko is not a replacement for your doctor."
- Demo account credentials provided to App Store reviewers (a synthetic family with synthetic readings).
- FDA documentation (Establishment Registration Number, manufacturer-of-record) ready to attach if requested by Apple Health Records review.
- Google Play Health & Fitness declaration submitted; restricted health permissions (BLUETOOTH\_CONNECT etc.) justified in Play Console form.
- Both stores: Account deletion in-app (US-82) — required by Apple since 2022 and Google since 2024.
- Pre-submit App Store listing for review feedback at week 14 (per D6 §9.2 risk row 2).


# **§14  Open Technical Questions**
Items the founder or a senior engineer must decide BEFORE Sprint 1 begins. Each has an owner, a target resolution date, and a default we will assume if no decision is made by then.



|**#**|**Question**|**Owner**|**Target**|**Default if unanswered**|
| :- | :- | :- | :- | :- |
|Q1|Anthropic BAA signed for Claude API healthcare use?|Founder|Before Week 8 of build|Tier B/C disabled in production until signed; Tier A only available in production|
|Q2|Brand name LEIKO verified via USPTO TESS, NIPC, .com/.app/.health domains, App Store, Play Store?|Founder|Before Week 2|Hold app name as code-name "Leiko" but do NOT begin App Store listing prep|
|Q3|Urion firmware UI customization scope (parallel track)|Founder + Urion (James Lee)|Non-blocking|Watch ships with supplier-default firmware; LawOne customisations land in v1.1|
|Q4|510(k) Letter of Authorisation from K141683 holder|Founder|Before Week 4|CANNOT ship to US without — escalate to D3 if blocking|
|Q5|Clinical advisor for AI prompt and copy-lint review|Founder|Before Week 12|Ship without if unavailable; founder owns review pass; flagged as a risk|
|Q6|Hetzner read replica in Helsinki — provisioned?|Founder / DevOps|Before launch|Single region (Frankfurt) at launch; replica deferred 60 days|
|Q7|PostHog self-hosted stack on existing Hetzner — sized correctly?|DevOps|Before Week 6|Use PostHog Cloud free tier as fallback if Hetzner sizing inadequate|
|Q8|Pen-test before launch?|Founder|Optional|Defer to post-launch unless MAU > 1,000 (D6 §6.2)|
|Q9|Twilio account for phone OTP?|Founder|Optional V2|Skip in v1; email OTP only|
|Q10|Apple Health / Google Fit — opt-in export at launch?|Founder|Before App Store submission|Defer to v1.1; reduce App Store review surface|
|Q11|Tecno / Itel device sourcing for QA lab|Founder|Before Week 4|Source via Jumia Nigeria; budget $300|
|Q12|AWS Device Farm BLE units — account provisioned?|DevOps|Before Week 8|Manual device testing only; risk accepted|
|Q13|PagerDuty / on-call rotation — single-founder MVP?|Founder|Before launch|Founder is on call 24/7 at launch; alerts escalate to personal phone|



|<p>**SPRINT-1 GO/NO-GO**</p><p>Sprint 1 cannot begin until Q2 (brand name verified) and Q4 (510(k) LoA) are resolved. The other questions can be deferred to their targets without blocking the start of build.</p><p>A "Sprint 0" of one week is recommended to: (a) set up the repo skeleton in §2.9, (b) provision Hetzner Supabase, (c) wire up GitHub Actions CI, (d) write the BLE mock layer, (e) get one real Urion watch into the dev environment and complete a single end-to-end /sync of a synthetic reading. Sprint 0 deliverable: an engineer can pair a watch and see a reading in the dev dashboard.</p>|
| :- |


# **§15  Architecture Decision Records (ADR Ledger)**
All locks made by this TRD that override or specialise D4 are recorded as ADRs. Format: title, status, context, decision, consequences. Future material changes append a new ADR rather than editing existing ones.



|**ADR #**|**Title**|**Status**|**Section**|
| :- | :- | :- | :- |
|ADR-001|Use Zustand for client state (over Redux/Context/Jotai)|Accepted|§2.1|
|ADR-002|Use TanStack Query v5 for server-state cache|Accepted|§2.1|
|ADR-003|Use React Navigation v7 (over Expo Router)|Accepted|§2.1|
|ADR-004|Use Victory Native XL for charts (over react-native-svg-charts)|Accepted|§2.1|
|ADR-005|Use Luxon for date/time handling|Accepted|§2.1|
|ADR-006|Lock primary region to Hetzner Frankfurt; replica Helsinki|Accepted|§2.2 / §7.2|
|ADR-007|AI tier C uses Claude Sonnet 4.6; Tier B uses Claude Haiku 4.5|Accepted|§2.3|
|ADR-008|Use Expo Notifications (over direct APNs/FCM)|Accepted|§2.5|
|ADR-009|Use Sentry SaaS Team plan (over self-hosted)|Accepted|§2.7|
|ADR-010|Use GitHub Actions + EAS Build (over Fastlane)|Accepted|§2.8|
|ADR-011|Use Maestro for E2E (over Detox)|Accepted|§12.2|
|ADR-012|Soft-delete watch readings with reason code; never hard delete|Accepted|§3.4 (resolves D6 §9.1)|
|ADR-013|Web Bluetooth on Android Chrome is the primary parent-pairing path|Accepted|§5.6 (resolves D6 §9.1)|
|ADR-014|Light Shopify webhook tracking (order/ship/ETA only)|Accepted|§3.2.14 (resolves D6 §9.1)|
|ADR-015|Use XState v5 for BLE connection state machine|Accepted|§5.2|
|ADR-016|Use i18next + react-i18next|Accepted|§10.1|
|ADR-017|Mobile-only at MVP (no web caregiver app)|Accepted|D4 / D6 §7|


## **15.1  ADR Template**
\# ADR-NNN: <Title>

Status: Proposed | Accepted | Deprecated | Superseded by ADR-MMM

Date: YYYY-MM-DD

Authors: <names>



\## Context

What is the issue we are seeing that motivates a decision?



\## Decision

What is the change we propose / agreed to?



\## Alternatives considered

\- Option A: pros, cons, why rejected

\- Option B: pros, cons, why rejected



\## Consequences

What becomes easier? What becomes harder? What new risks?



\## Links

\- Related ADRs:

\- Source documents:


# **Document Status**
D7 — Technical Requirements Document v1.0 — COMPLETE. Sprint-1-ready pending resolution of §14 Q2 (brand name verification) and Q4 (510(k) LoA). Hand off to D8 (Design System Spec), D9 (Implementation Plan), and D10 (Phase-1 Tickets).



Total locked technology choices: 17 (recorded as ADR-001 through ADR-017).

Total Edge Functions specified: 21.

Total database tables specified: 14 (plus enum types).

Total BLE commands wired: 14 (per D4 Block 4).

Total open technical questions: 13 (one is hard-blocking, others deferrable).



**Prepared for:** LawOne Cloud LLC — BP Smartwatch Venture

**Date:** May 2026

**Next deliverable:** D8 — Design System Specification
LawOne Cloud LLC  •  Confidential  •  Page 
