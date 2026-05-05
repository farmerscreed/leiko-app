# Sprint 5 — Watch Pairing (BLE)

## Goal
Pair the user's phone to a Urion U16 watch over BLE. Handle re-pair, forget, and the unhappy paths (Bluetooth off, watch out of range, OS-level permission denied). **This is the highest-risk sprint; budget for slip.**

## Duration
~1 work-week (with explicit slip allowance).

## Hard dependencies
Sprint 3 OR Sprint 4. **A physical Urion U16 dev watch.** (Confirmed: founder has multiple watches available.)

## Docs to load
docs/06-ble-protocol.md, docs/04-screens/watch-pairing.md, docs/01-data-model.md (§ devices), docs/02-design-tokens.md.

## Deliverables
- apps/mobile/src/services/ble/UrionDevice.ts — typed wrapper around react-native-ble-plx
- apps/mobile/src/services/ble/connectionMachine.ts — XState v5 finite-state machine per docs/06-ble-protocol.md §2
- Pairing screens: Searching, Found, Pairing, Success, Failure
- Settings screens: paired devices, forget device, re-pair
- Migration: devices table per docs/01-data-model.md
- tools/ble-mock — in-memory mock implementing the same interface

## Acceptance criteria
- From scratch: launch app, complete onboarding, reach pairing screen, find watch, pair, see success
- Killing the app and reopening: paired watch is remembered (MMKV) and reconnects
- Forget watch: removes the device from MMKV and database, requires re-pair
- Bluetooth off: app shows the correct error state with a "Turn on Bluetooth" CTA
- Permission denied: app shows the correct error state with an "Open settings" CTA
- Watch out of range: app shows "Couldn't find your watch" with a retry CTA
- All flows tested on iOS AND Android — BLE behaviour differs significantly

## Test plan
- Manual test on real device + real watch (no automated test for hardware integration in this sprint)
- Unit tests for the connectionMachine state transitions
- Mock-BLE integration test for the pair flow happy path

## Open prompt
Sprint 5 — Watch Pairing (BLE). HIGH RISK — plan for slip.

Read CLAUDE.md, then docs/06-ble-protocol.md, docs/04-screens/watch-pairing.md, docs/01-data-model.md.

Propose:

1. The state machine for the pairing flow (states + transitions)
2. iOS-vs-Android BLE differences you'll handle and how
3. Permission handling sequence
4. Testing strategy given that automated BLE testing is hard
5. The minimal pairing happy path you'll demo first, before adding error states

Wait for approval. Do not start coding the BLE wrapper before we agree on the state machine.

## Risk notes
- iOS BLE permissions changed across recent OS versions — confirm the latest behaviour on the latest iOS.
- Android background BLE has its own permission set (BLUETOOTH_SCAN, BLUETOOTH_CONNECT). Don't skip it.
- The Urion protocol may have undocumented quirks. Plan for one full week of "test, fail, fix" with the real watch.
- If the dev watch has not arrived by Sprint 5 start, pause the sprint. Do NOT try to fake BLE in a simulator and call it done.
