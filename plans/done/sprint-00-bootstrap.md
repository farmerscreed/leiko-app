# Sprint 0 — Bootstrap

## Goal
Stand up the repository, the operating manual, the docs/ structure, the Expo app, the Supabase schema, and CI. By the end, the repo compiles, tests pass, and CI is green. Zero product features.

## Duration
~1 work-week.

## Hard dependencies
None. This is sprint zero.

## Docs to load
CLAUDE.md (drafting), D10 §2.3 bootstrap sequence, D10 §4 extraction map, D7 §2 (tech stack), D7 §3 (data model).

## Deliverables
- Initialised git repo on GitHub
- CLAUDE.md at repo root (D10 §3, copied verbatim)
- docs/ folder populated with all 13+ files per the extraction map
- plans/ folder with all 18 sprint cards (sprint-00 through sprint-17)
- apps/mobile/ scaffolded as Expo bare workspace, TypeScript strict
- supabase/migrations/0001_initial.sql with the schema from docs/01-data-model.md
- .env.example with all required env var keys
- GitHub Actions CI: lint, typecheck, jest test on every PR
- README.md with project intro and quick-start

## Acceptance criteria
- `git clone <repo> && npm install && npm run test` — succeeds
- `npm run typecheck` — passes with zero errors
- CI run on initial PR — passes
- `cat CLAUDE.md` — returns the operating manual
- `ls docs/` — returns at least 13 files matching the extraction map
- `ls plans/` — returns 18 sprint card files
- Expo: `cd apps/mobile && npx expo prebuild && npx expo run:ios` (or android) — launches the default Expo splash screen
- Supabase: `supabase db reset` — succeeds, schema is created

## Test plan
- CI sanity test (a single passing test in `apps/mobile/__tests__/` to prove the test runner works)
- No product tests yet

## Definition of done
Universal definition (CLAUDE.md) plus: the founder can clone the repo on a fresh machine and reach a green build in <30 minutes following README.md.

## Open prompt
We are starting Sprint 0 — Bootstrap. Read CLAUDE.md (which you'll be drafting in this sprint per D10 §3), then read D10 §2.3 (the bootstrap sequence) and D10 §4 (the docs extraction map).

Propose:

1. The exact list of files you'll create, in the order you'll create them
2. Any decisions in the bootstrap sequence that need my input before you start (e.g. Supabase project name, GitHub org)
3. The verification step you'll run after each major group of files

Do not write any files yet. Wait for my approval.

## Risk notes
- Don't skip the docs/ extraction step. Sprint 1 onwards depends on those files existing.
- Pin every dependency. Use exact versions, not ranges.
- Order the Urion U16 dev watch NOW. Lead time will eat Sprint 5 if you wait.

---

## Session status — last updated 2026-05-05

### Session 0a — DONE
- Group A (repo plumbing): `package.json`, `.gitignore`, `.env.example`, `README.md` written. `git init -b main` done. `origin` set to `https://github.com/farmerscreed/kena-app.git`.
- Group B-ref (`docs/_reference/`): D1, D2, D3, D4, D5, D6×2, D7, D8, D8a, D9, D10 = **12 files**.
- Group B-canon (`docs/`): 12 top-level + 6 components + 10 screens = **28 canonical sliced files**.
- Group C (`plans/`): 18 sprint cards + `backlog.md` = **19 files**.
- D8a published mid-session: all amendments applied to onboarding-fork, self-buyer-onboarding, self-buyer-home, reading-detail, trends, settings, reading-card, paywall, push-notifications, voice-and-claims, data-model. `docs/_reference/D8a-self-buyer-mode.md` carries the full text.

### Session 0b — PENDING (this is the next thing to do)
**Blocker**: Node.js + Supabase CLI not installed locally; Docker Desktop installed but pending Windows restart.

Remaining work for Sprint 0:

- **Group D — Expo bare scaffold**:
  - `cd apps/mobile && npx create-expo-app . --template bare-minimum` (target Expo SDK 52)
  - Edit `app.json` — slug `kena`, name `Kena`, bundle `com.kena.app`
  - Edit `tsconfig.json` for strict mode
  - Add `jest.config.js` + `__tests__/sanity.test.ts`
  - Add `.eslintrc.json`, `.prettierrc`, `eas.json`
  - `.gitkeep` stubs in `src/{components,screens,navigation,services,hooks,state,i18n,learn,utils,types}/`
  - `npm install` with **exact-pinned versions** per `docs/00-tech-stack.md`. Commit `package-lock.json`.
- **Group E — Supabase**:
  - `cd supabase && supabase init`
  - Write `supabase/migrations/0001_initial.sql` from `docs/01-data-model.md`
  - Write `supabase/seed.sql` (minimal dev fixtures)
  - `supabase db reset` (requires Docker — runs after Windows restart)
- **Group F — CI**: write `.github/workflows/ci.yml` — lint + typecheck + jest on PR to main. Node 22.
- **Group G — Initial commit + push**:
  - Two commits: (1) Sprint 0a + D8a output, (2) Node 22 bump + toolchain scripts + 0b output.
  - `git push -u origin main` (will prompt GCM for GitHub auth on first push).

### Resume sequence after Windows restart

1. Run **`scripts\install-toolchain.ps1`** from an elevated PowerShell.
2. Close that window. Open a new PowerShell.
3. Run **`scripts\verify-toolchain.ps1`** — confirms Node, npm, Supabase CLI, GitHub CLI, Docker, Git are all on PATH.
4. Configure git author once:
   ```powershell
   git config --global user.name  "Your Name"
   git config --global user.email "biebele@gmail.com"
   ```
5. Open a new Claude Code session in this directory.
6. Say "continue Sprint 0" — the new session will read CLAUDE.md, this file, and proceed with Group D → E → F → G.

### Decisions baked in during 0a (do not re-decide in 0b)
- GitHub remote: `https://github.com/farmerscreed/kena-app.git` (private)
- Bundle ID: `com.kena.app` (iOS + Android)
- Expo slug: `kena`. Display name: `Kena`.
- Local Supabase project name: `kena`. Remote project: deferred to Sprint 17.
- npm workspaces enabled at root (`apps/*`).
- Node 22 LTS (was 20 — bumped because Node 20 hit EOL 2026-04-30).
- Manual doc slicing — no `extract-docs.sh` script.
- `_specs/` is `.gitignore`d (canonical extracts live in `docs/_reference/`).
- E2E tool: **Maestro** (per D7 §12.2). CLAUDE.md still says "Detox" — flagged in `plans/backlog.md` § Discrepancies for founder reconciliation.

### Open questions to track in 0b
- Confirm GitHub auth path on first push (PAT via Git Credential Manager browser prompt vs. `gh auth login`).
- Verify `supabase db reset` against the migration once Docker is up (ideally before pushing the migration).
