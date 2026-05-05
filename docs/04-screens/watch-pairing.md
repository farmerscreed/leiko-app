# Screen — Watch Pairing

Caregiver-side OR parent-side flow, with Web Bluetooth fallback (Android Chrome) when caregiver attempts to pair a watch that physically lives with a parent on Android.

Sourced from D8 §4.9 + D7 §5 (BLE protocol) + D7 §5.6 (Web Bluetooth path). See `docs/06-ble-protocol.md` for the connection state machine and command inventory.

---

## Audience
- Caregiver (caregiver-local pairing path)
- Self-buyer (caregiver-local pairing path; same flow)
- Parent (Web Bluetooth or native iOS path, after receiving a 6-digit code or Universal Link from caregiver)

---

## Caregiver-local flow (5 steps + failure)

| Step | Screen | Components |
| --- | --- | --- |
| 1 | "Power on the watch" | Illustration of watch with power button highlighted; `type.body-l` instructions; `button.primary` "It's on" |
| 2 | Scanning | Centred spinner; `type.body-m` "Looking for the watch nearby…"; `button.ghost` Cancel |
| 3a | Watch found | Card showing watch model + last-4 of MAC; `button.primary` "Pair this watch"; `button.ghost` "Not this one" — disambiguates multi-watch (D7 §5.5) |
| 3b | Watch not found → Web Bluetooth handoff (Android only) | Bottom sheet: "Pair from your parent's Android phone" with QR code that opens `https://pair.kena.app/{url_token}` on their device |
| 4 | Pairing… | Progress indicator with `motion.normal` pulse; `type.body-m` "Talking to the watch…" |
| 5 | Paired | Phosphor `CheckCircle` Bold 64pt amber; `type.title` "Paired"; `button.primary` "Continue" — routes to Take Reading (`take-reading.md`) |
| Failure | Pair failed | Phosphor `WarningCircle`; friendly cause from `docs/06-ble-protocol.md` §5; suggested fix; `button.primary` "Try again" |

---

## Parent-side Web Bluetooth flow (Android Chrome)

Per `docs/06-ble-protocol.md` §6:

1. Caregiver finishes step 3b on their phone — sees a QR code.
2. Parent scans QR → opens `https://pair.kena.app/{url_token}` in Chrome.
3. Single-page Next.js flow (`/kena-pair-web` repo) requests `navigator.bluetooth.requestDevice({ filters: [{ services: ["6E40FFF0-..."] }]})`.
4. Parent grants Web Bluetooth permission. Watch pairs.
5. `/accept-pairing` Edge Function binds device to family. Parent takes their first reading directly from the watch.
6. After first reading, web page suggests: *"Want ongoing sync? Install the Kena app."* (links to App Store / Play Store).

**Voice copy on web flow** (D6 US-15 / US-16):
- *"Hi {parent_first_name}. {caregiver_first_name} would like you to wear this watch. Tap the watch to pair, then we're done."*
- Consent screen lists every caregiver in the family by name and photo. Two large buttons: "Yes, I agree" / "Not now". **No tiny pre-checked checkboxes** (D7 §7.6).

---

## iOS Universal Link path

iOS Safari does NOT support Web Bluetooth. The pairing page detects this (`navigator.bluetooth === undefined`) and routes to a Universal Link: `kena://pair?token=...`

- If the Kena app is installed: opens the app, restores the pairing context.
- If not installed: routes to App Store, then on first launch the deep link is preserved and pairing context is restored.

---

## Voice

Per `docs/05-voice-and-claims.md`:
- All errors use the friendly-cause + suggested-fix pattern from `docs/06-ble-protocol.md` §5.5.
- Never "Bluetooth error 0x21". Always "We couldn't reach the watch — bring the phone closer to it."
- Per CLAUDE.md anti-pattern: **Don't make the "Take a reading" CTA smaller than the spec says** — and the same applies here for "Pair this watch".

---

## Permissions priming (Sprint 5)

Before BLE scanning starts, the app primes the user with an inline explainer:

- iOS: explains that Bluetooth is needed to talk to the watch.
- Android 14+: requires `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `FOREGROUND_SERVICE_CONNECTED_DEVICE`. Show the explainer, then trigger native permission prompt.
- If denied: settings deep link with explainer text per D7 §5.5 failure-mode table.

---

## Accessibility

- Spinner during scanning is announced as "Searching for watch" via `accessibilityLiveRegion="polite"`.
- "Watch found" announcement reads model + last-4-of-MAC ("Kena Watch ending 4F2C").
- Confirmation screen (step 5): `accessibilityLiveRegion="assertive"` for "Paired" announcement.
- Cancel button always reachable via screen reader keyboard navigation.

---

## Sprint 5 acceptance criteria
- All 5 caregiver-local steps render and transition.
- BLE state machine reflects each step (`scanning` → `connecting` → `connected`).
- Web Bluetooth handoff QR generates a valid `pair.kena.app/{url_token}` URL.
- Failure-mode handling per `docs/06-ble-protocol.md` §5.5 (at least 6 failure paths covered with friendly copy).
- Voice gate passes.
- Component tests + BLE-mock integration test covering happy path + at least 2 failure paths.

---

## Risk note
This sprint is HIGH risk per D10 §6.1 sprint table. **Plan for slip.** A physical Urion U16 watch must be in hand from sprint start. Confirmed: founder has multiple watches available.
