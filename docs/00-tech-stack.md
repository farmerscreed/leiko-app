# 00 — Tech Stack

Canonical version pins and service locks. Sourced from D7 §2 (final lock) and D4 Block 3. Compliance posture from D3 + D7 §7.

> **Rule**: any deviation from this file is an ADR (D7 §15). No silent version bumps. If a `package.json` version doesn't match this file, that's a bug.

---

## Mobile

| Concern | Locked choice | Version |
| --- | --- | --- |
| Framework | React Native + Expo bare workflow (EAS Development Build) | Expo SDK 52 |
| Language | TypeScript strict | 5.5.x |
| Node runtime | Node.js LTS | **24.x** (Node 22 entered Maintenance Oct 2025; 24 is current Active LTS — see ADR-0001) |
| Package manager | npm | 10.x |
| BLE | react-native-ble-plx | 3.x |
| State (client) | Zustand | 4.x |
| Server-state cache | TanStack Query (React Query) | v5 |
| Navigation | React Navigation (native stack + bottom tabs) | v7 |
| Local relational DB | WatermelonDB | 0.27+ |
| Encrypted KV | react-native-mmkv (with platform Keychain/Keystore) | 2.x |
| Charts | Victory Native XL | latest stable |
| i18n | i18next + react-i18next | latest stable |
| Forms | React Hook Form + Zod | latest stable |
| Date/time | Luxon (IANA TZ) | latest stable |

**Rejected (do not propose without ADR)**: Native Swift+Kotlin, Flutter, Expo Go, Realm, AsyncStorage as primary, Redux Toolkit, Apollo, Material/Chakra/NativeBase UI libs.

---

## Backend

| Concern | Locked choice |
| --- | --- |
| Platform | Supabase self-hosted on Hetzner (Frankfurt primary, Helsinki replica) |
| Database | PostgreSQL 15 |
| Auth | Supabase Auth (GoTrue) — email magic-link + Apple + Google. PKCE on mobile. |
| Realtime | Supabase Realtime |
| File storage | Supabase Storage (S3-compatible on Hetzner volume) |
| Edge runtime | Supabase Edge Functions (Deno) |
| Workflow orchestration | n8n (existing self-host) for AI pipelines |
| Migrations | Supabase CLI `db push` + hand-rolled SQL in `supabase/migrations/` |

---

## AI Layer (D7 §2.3)

Three-tier model routing through a single LiteLLM gateway.

| Tier | Model | Hosting | Use case |
| --- | --- | --- | --- |
| A (local) | Llama 3.1 8B (default) + Llama 3.2 3B (fast path) | Ollama on Hetzner GPU node | FAQ Q&A, output classifier (forbidden-claims pre-screen), reading-quality scoring |
| B (cloud) | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Anthropic API via LiteLLM | Conversational pattern explanation; latency-sensitive caregiver Q&A |
| C (cloud) | Claude Sonnet 4.6 (`claude-sonnet-4-6`) | Anthropic API via LiteLLM | Weekly summaries, doctor report narrative |

**Gateway**: LiteLLM (existing on Hetzner). OpenAI-compatible egress; per-customer rate limits; 24h identical-prompt cache; fallback graph.

**BAA gate**: Anthropic BAA must be signed before any reading data is forwarded. Until then, Tier B/C run only against synthetic/scrubbed data in dev.

> CLAUDE.md uses the simplified phrasing "Haiku 4.5 for most queries, Sonnet 4.6 for complex." That's accurate for Tier B/C only — Tier A (Llama on Ollama) handles classification and FAQ. See `docs/07-ai-assistant.md`.

---

## Subscription Billing (D7 §2.4)

- **Manager**: RevenueCat (Purchases SDK)
- **Server validation**: RevenueCat webhook → `/revenuecat-webhook` Edge Function. Source-of-truth for entitlements is `families.subscription_status`.
- **Free trial**: 7 days, no card collected at start; card collected at trial end if user converts.
- **Pricing**: $4.99 / month · $39.99 / year (33% off)
- See `docs/09-paywall-and-iap.md` for plumbing.

---

## Push Notifications (D7 §2.5)

**LOCK: Expo Notifications** (not direct APNs/FCM at this stage). Routes to APNs and FCM under the hood. Store both the Expo push token AND the underlying APNs/FCM token at registration so a future migration is one-deploy away.

See `docs/11-push-notifications.md` for categories, routes, quiet hours.

---

## Analytics (D7 §2.6)

**LOCK: PostHog self-hosted on Hetzner.**

**Strict event policy** (HARD requirement, see Compliance below): event names + non-identifying metadata ONLY. NEVER reading values (sys/dia/pulse), NEVER full names, NEVER device serial numbers. PHI redaction enforced by a thin wrapper (D7 §11.2).

---

## Error Tracking (D7 §2.7)

**LOCK: Sentry SaaS** (Team plan $26/mo). Self-hosted Sentry deferred until MAU > 5,000.

**Mandatory Sentry `beforeSend` hook** strips PHI fields (`sys`, `dia`, `pulse`, `parent_name`, `caregiver_name`, `email`, `phone`, `device_serial`). CI test: a synthetic crash with PHI-shaped fields must arrive in Sentry redacted. Failure of this test BLOCKS release.

---

## CI / CD (D7 §2.8)

**LOCK: GitHub Actions + EAS Build** (not Fastlane).

**Branching**: trunk-based on `main`; release branches `release/v1.x.y` cut for App Store submissions; hotfix branches off the latest release tag. **Squash-merge to main.**

**Required CI gates** (all must pass):
- TypeScript strict
- ESLint
- Prettier check
- Jest unit tests
- React Native Testing Library component tests
- Copy-lint (D6 §6.5 forbidden-claims linter — see `docs/05-voice-and-claims.md`)
- Secret scanning
- Snyk / Dependabot on dependency PRs

---

## Compliance Posture (D3 + D7 §7)

### HIPAA scope (canonical)
Kena is **direct-to-consumer**; we are NOT a Business Associate to a Covered Entity. HIPAA does not apply de jure. We adopt HIPAA-aligned practices because (a) D3 lists them as the operational floor, (b) US state laws (CCPA, CPRA, NY, CT) impose substantively similar duties, (c) caregiver buyers expect it, (d) it future-proofs us if a covered-entity partnership emerges.

### Encryption inventory

| Layer | Algorithm | Key management |
| --- | --- | --- |
| BLE link | AES-128 CCM (Bluetooth bonding) | OS BT stack on phone + watch flash |
| Mobile ↔ Backend | TLS 1.3 | Let's Encrypt on Hetzner; auto-renew |
| Backend ↔ LiteLLM | TLS 1.3 (intra-Hetzner) | Internal network |
| LiteLLM ↔ Anthropic | TLS 1.3 | API key in Hetzner secret store |
| Postgres at rest | TDE (LUKS volume) | LUKS key in Hetzner KMS |
| Storage at rest | AES-256 (Supabase Storage) | Per-bucket key |
| Mobile keychain | iOS Keychain / Android Keystore (hardware-backed where available) | OS-managed |
| Local relational DB | SQLCipher AES-256 (WatermelonDB) | Key derived from Keychain entry; rotates on re-install |

### PHI handling rules (HARD)
1. **Never** log reading values (sys/dia/pulse) outside the database.
2. **Never** include reading values, full names, email, phone, MAC, or device serial in PostHog events.
3. **Never** include the same in Sentry crash reports — Sentry `beforeSend` strips them.
4. **AI egress** goes only through LiteLLM → Anthropic (BAA). Payload is scrubbed first: only first names, year of birth, residence city, and reading values pass through.
5. Every PHI read/write writes a row to `public.audit_log` (D7 §3.2.12).
6. Account deletion is a **30-day grace, then anonymise** (D6 US-82). Audit trail retained 7 years.

---

## NAFDAC / FDA (D3 — engineering implications)

Engineering does not block on regulatory submissions; they're a separate workstream. But these touch the codebase:
- **Watch firmware boot screen** must show "Kena Watch" / "Kena Watch Pro" + "LawOne Cloud LLC" manufacturer-of-record (D5 §5.2).
- **App Store listing**: every visible string runs through the forbidden-claims linter before submission (`docs/05-voice-and-claims.md`).
- **FDA listing transfer + 510(k) labeling** is a Sprint 17 launch gate (US market only).
- **Pregnancy deferral**: see `docs/_reference/D3-regulatory.md` for current pending amendment.

---

## Repo Layout (canonical from D10 §2.1)

```
kena-app/
├── CLAUDE.md
├── README.md
├── package.json              # npm workspaces root
├── docs/                     # this folder
├── plans/                    # sprint cards
├── apps/mobile/              # Expo bare app
├── supabase/                 # migrations, edge functions, seed
└── scripts/
```

D7 §2.9 has a slightly different layout (`/db`, `/functions`, `/workflows`, `/tools` at root). **D10 supersedes D7 on layout** — follow this file. The D7 layout was a working draft; the D10 layout is what shipped.

---

## Open questions tracked in this stack
- Q5 — Clinical advisor hire (gates Cluster A Learn content)
- Q11 — RevenueCat IAP product setup (gates Sprint 10 paywall)
- Anthropic BAA (gates Tier B/C in production)

See `plans/backlog.md` for full open-question list (D7 §14).
