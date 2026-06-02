# Leiko

Caregiver-mode blood pressure monitoring app, paired with a Urion U16 family BP smartwatch over BLE. Built for caregivers, self-buyers, and parents across Nigeria and the United States.

This is the monorepo. The mobile app lives in [`apps/mobile/`](apps/mobile/). Backend schema and edge functions live in [`supabase/`](supabase/).

> **For Claude Code sessions**, read [CLAUDE.md](CLAUDE.md) first.

## Quick start

```bash
git clone https://github.com/farmerscreed/leiko-app.git
cd leiko-app
npm install
cp .env.example .env.local   # then fill in keys
npm run typecheck
npm test
```

A green `npm test` run from a fresh clone is the bar for "the repo works." Target: under 30 minutes on a fresh machine.

### Run the mobile app

```bash
cd apps/mobile
npx expo prebuild         # one-time, generates ios/ + android/
npx expo run:ios          # macOS only
npx expo run:android      # any host with Android SDK
```

### Run Supabase locally

Requires Docker Desktop.

```bash
cd supabase
supabase start            # spins up local Postgres + Studio
supabase db reset         # applies migrations + seed
```

## Repo layout

```
leiko-app/
├── CLAUDE.md              # Operating manual. Read every session.
├── docs/                  # Spec, sliced. One concern per file.
│   ├── 00-tech-stack.md
│   ├── 01-data-model.md
│   ├── 02-design-tokens.md
│   ├── 03-components/
│   ├── 04-screens/
│   ├── 05-voice-and-claims.md
│   ├── 06-ble-protocol.md
│   ├── 07-ai-assistant.md
│   ├── 08-learn-module.md
│   ├── 09-paywall-and-iap.md
│   ├── 10-anomaly-logic.md
│   ├── 11-push-notifications.md
│   ├── 12-localisation.md
│   ├── 13-testing-standard.md
│   └── _reference/        # Full D1–D15 spec dumps. Don't load by default.
├── plans/                 # Sprint cards. Active card is your job.
├── apps/
│   └── mobile/            # React Native + Expo bare
├── supabase/              # Migrations, edge functions, seed
└── scripts/               # Dev helpers
```

## Stack (locked — see `docs/00-tech-stack.md`)

- **Mobile**: React Native + Expo bare (TypeScript strict)
- **State**: Zustand 4.x · **Server cache**: TanStack Query v5
- **Local DB**: WatermelonDB (relational) + MMKV (encrypted KV)
- **BLE**: react-native-ble-plx 3.x
- **Backend**: Supabase self-hosted on Hetzner (Postgres 15, Auth, Storage, Edge Functions)
- **AI**: LiteLLM gateway · Tier A Llama 3.1 8B on Ollama · Tier B Haiku 4.5 · Tier C Sonnet 4.6
- **Payments**: RevenueCat
- **Push**: Expo Notifications
- **Analytics**: PostHog self-hosted · **Errors**: Sentry SaaS
- **Test**: Jest + React Native Testing Library · Maestro for E2E (deferred to v1.1)
- **CI**: GitHub Actions · **Builds**: EAS Build

Versions are pinned exactly in `apps/mobile/package.json`. If a version doesn't match, that's a bug.

## Common scripts

| Command | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript strict check across the workspace |
| `npm run lint` | ESLint on `apps/mobile/src/` |
| `npm test` | Jest unit + component tests |
| `npm run format` | Prettier check |
| `npm run format:fix` | Prettier write |

## How we work

Every sprint is one focused work-week. The active sprint card is in [`plans/`](plans/). The roadmap is in [`docs/_reference/D10-implementation-plan.md`](docs/_reference/D10-implementation-plan.md).

Conventional Commits. One logical change per commit. Tests pass in CI before a sprint is "done."

## Voice rules

Every user-visible string passes the rules in `docs/05-voice-and-claims.md`. The short version: no fear language, no "patient" (use "Mum" / "Dad" / "you"), no medical-claim verbs ("diagnose", "treat", "predict", "prevent"). Lead with the answer. Plain language before clinical terms.

## License

UNLICENSED — proprietary, all rights reserved.
