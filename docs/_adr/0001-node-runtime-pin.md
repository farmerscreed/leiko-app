# ADR-0001: Node.js runtime pin — 22 → 24

- **Status**: Accepted
- **Date**: 2026-05-05
- **Sprint**: 0 (bootstrap, Session 0b)
- **Supersedes**: original Node 22 pin in `docs/00-tech-stack.md`

## Context

`docs/00-tech-stack.md` originally pinned **Node.js 22.x LTS**. That pin was correct when written: Node 22 was the Active LTS line and Node 20 had just hit EOL (2026-04-30).

By 2026-05-05 the release calendar has moved on:

- Node 22 entered **Maintenance LTS** in October 2025. Its EOL is April 2027.
- Node 24 became **Active LTS** in October 2025. Its Maintenance period begins October 2026; EOL is April 2028.

CLAUDE.md states: *"Versions are pinned in `docs/00-tech-stack.md`. If a `package.json` version doesn't match this file, that's a bug. Don't bump."* It also requires deviations to be documented as ADRs (D7 §15). Hence this ADR.

## Decision

**Pin Node.js to 24.x LTS.**

`package.json` `engines.node` becomes `>=24.0.0 <25.0.0`. The `scripts/install-toolchain.ps1` winget id `OpenJS.NodeJS.LTS` is unchanged — it now resolves to Node 24, which is what we want.

## Rationale

1. **Launch-window coverage.** Sprint 17 (App Store / Play Store submission) lands in late-2026 to early-2027 if sprints stay on cadence. Node 22's EOL (April 2027) brackets that submission window; Node 24's EOL (April 2028) gives a year of post-launch headroom on a fully supported runtime.
2. **Same rationale as the original pin.** The Node 22 pin's stated rationale was "current Active LTS". Node 24 is the current Active LTS as of October 2025; the rule's spirit points at 24.
3. **No install friction.** Node 24.x was already on the dev machine when Session 0b started — installing 22 alongside would have introduced version-management overhead for no upside.
4. **Compatibility.** Expo SDK 52 (RN 0.76) supports Node ≥ 18; no upper-bound issues with Node 24. WatermelonDB 0.27, react-native-ble-plx 3, and the rest of the stack pin against Node ≥ 18.

## Consequences

- `package.json` `engines` updated to `>=24.0.0 <25.0.0`.
- `docs/00-tech-stack.md` Node row + rationale updated.
- `.github/workflows/ci.yml` (created in Group F) pins `node-version: 24`.
- A future ADR will be required to bump again.

## Alternatives considered

- **Stay on Node 22.** Rejected: requires a second Node install on the dev machine and lands the project on a Maintenance-LTS runtime at launch, with EOL inside the same window as Sprint 17.
- **Move to Node LTS-floating (no upper bound on majors).** Rejected: violates the exact-pinned stack rule. We pin majors deliberately so future bumps are explicit, not CI-time surprises.
