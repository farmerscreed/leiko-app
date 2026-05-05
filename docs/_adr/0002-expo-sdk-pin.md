# ADR-0002: Expo SDK pin — 52 → 54

- **Status**: Accepted
- **Date**: 2026-05-05
- **Sprint**: 0 (bootstrap, Session 0b)
- **Supersedes**: original Expo SDK 52 pin in `docs/00-tech-stack.md`

## Context

`docs/00-tech-stack.md` originally pinned **Expo SDK 52**. That pin was correct when written: SDK 52 launched November 2024 and was the current stable.

By 2026-05-05 the Expo release calendar has moved on:

| SDK | Released | Status (2026-05-05) |
|---|---|---|
| 52 | Nov 2024 | Out of support — Expo only patches the latest 2 SDKs |
| 53 | Apr 2025 | Maintenance |
| 54 | Nov 2025 | Stable, currently supported |
| 55 | Apr 2026 | Latest (`@latest` tag) |

CLAUDE.md states the rule: *"If a `package.json` version doesn't match `docs/00-tech-stack.md`, that's a bug. Don't bump."* It also requires deviations to be documented as ADRs (D7 §15). Hence this ADR.

## Decision

**Pin Expo SDK to 54.x.** `expo@~54.0.x` resolved exactly via the root lockfile, scaffolded from `expo-template-bare-minimum@sdk-54`.

## Rationale

1. **Healthcare app — favor mature SDK over freshly-cut.** SDK 54 has 6 months of patches; SDK 55 was released ~one month ago. Third-party libraries (react-native-ble-plx 3.x is the critical one for Sprint 5) are well-tested against SDK 54 / RN 0.78.
2. **Still in Expo's support window.** SDK 52 is past end of Expo's typical 2-SDK support window — no more security patches. SDK 54 will keep getting patches at least through SDK 56's release (~Nov 2026).
3. **Same rationale as the original pin.** SDK 52 was chosen as "current stable when convenient for new project". SDK 54 fills that role now.
4. **Launch coverage.** Sprint 17 lands ~late 2026 / early 2027. SDK 54 will still be in maintenance through 2027; one further bump (to 56 or 57) before App Store submission is realistic and inexpensive.

## Consequences

- React Native version moves from 0.76 (SDK 52 default) to ~0.78 (SDK 54 default).
- React version moves accordingly to whatever SDK 54 ships (~19.x).
- `apps/mobile/package.json` pins resolved by `npm install` after scaffold from the SDK 54 template.
- `docs/00-tech-stack.md` Mobile row updated.
- Future ADRs required to bump SDK again.

## Alternatives considered

- **Stay on SDK 52.** Rejected: out-of-support runtime, Sprint 5 BLE work would hit library compatibility trouble.
- **Move to SDK 55 (latest).** Rejected: too fresh — only one month of patches; third-party libraries still adjusting. Healthcare app warrants a stability margin.
