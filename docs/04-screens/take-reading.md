# Screen — Take Reading

Triggered when the caregiver or self-buyer wants to capture a fresh BP reading via the watch. Sourced from D8 §4.13 (Parent-Side Tap Confirm) + D6 US-21 / US-22 / US-23 (manual + watch-pushed reading flow).

---

## Audience
- Caregiver (when watch is in caregiver's hand — rare; usually parent wears it)
- Self-buyer (default user for this screen)
- Parent (post-reading tap-confirm — see "Parent-side flow" below)

---

## Two paths

> **Hardware constraint** (verified against `docs/_reference/U16PRO_protocol_en.pdf` 2026-05-06): the U16PRO protocol has NO command for the app to remotely trigger a BP measurement. The 14-section command catalog covers reads, config, find-watch, factory-reset, and the watch-pushed `0x73` notification — but no inflate-now command. Reading is **always** initiated by the parent pressing the BP button on the watch. Both Paths below converge on that physical action.

### Path A — Parent takes a reading on the watch (most common)
1. Parent presses the BP button on the watch.
2. Watch inflates cuff (~45s), reads sys/dia/pulse, pushes via `0x73` notify packet.
3. App receives reading via the BLE notify subscription (`docs/06-ble-protocol.md` §3 cmd `0x73`).
4. Reading is saved to MMKV pending buffer **before** any UI confirmation (`docs/01-data-model.md` §"Local storage on device").
5. POST to `/sync` Edge Function. On success: insert into WatermelonDB, drop from MMKV pending buffer, write to `public.readings`.
6. Anomaly engine classifies on ingest (`docs/10-anomaly-logic.md`).
7. Push to all caregivers in the family per `docs/11-push-notifications.md` daily-summary or anomaly category.

### Path B — User opens the in-app "Take a reading" sheet
This screen lives at `apps/mobile/src/screens/TakeReading/TakeReadingScreen.tsx`. The app **does not** inflate the cuff — it can't, per the hardware constraint above. Instead the sheet:

1. Reconnects to the persisted device.
2. Subscribes to `0x73` and shows instructional copy: *"Press the BP button on your watch — we'll catch the result here."*
3. When `0x73 0x02` (BP ready) arrives, the app issues `0x14 readBPHistory` with `count=1` to fetch the just-recorded reading.
4. Reading is persisted to MMKV pending buffer synchronously, classified, then best-effort POSTed to `/sync`.
5. UI lands on Reading Detail.

A secondary "Add a manual reading" affordance opens a BottomSheet for sys/dia/pulse entry (D6 US-26) — used when the watch isn't on the wrist.

Used when:
- Self-buyer wants an on-demand reading.
- Caregiver wants to test the watch is responsive.
- Parent (post-reading tap-confirm) confirms the reading is theirs.

---

## Layout — Path B (in-app)

| Element | Spec |
| --- | --- |
| Hero | Illustration of watch + arm cuff position, 240×180pt, `radius.xl` (Sprint 6 ships without the illustration; placeholder text only) |
| Headline | `type.display-m` "Press the BP button on your watch" |
| Body | `type.body-l` "Sit still while the watch inflates and takes the reading. We'll catch the result here." |
| (No primary CTA in `waiting_for_watch`) | The watch button is the trigger; the screen is informational while we wait for `0x73 0x02`. The CLAUDE.md "Take a reading CTA size" anti-pattern applies to the FAB on home (which IS the entry point), not to the in-flight screen. |
| Secondary | `button.ghost` "Add a manual reading" — opens bottom sheet with sys / dia / pulse inputs (D6 US-26 manual entry). Used when the watch isn't on the wrist. |
| Cancel | `button.ghost` "Cancel" — disconnects + dismisses |

---

## States

| State | Visual |
| --- | --- |
| `connecting` | Spinner; "Reaching the watch" headline; ~2s on a healthy connection |
| `waiting_for_watch` | Headline "Press the BP button on your watch"; cancel + manual-entry secondary; 90s timeout |
| `fetching` | Spinner; "Reading complete — saving" while the app issues `0x14` and writes the row to MMKV |
| `success` | `type.numeric-xl` showing sys/dia; tier chip from `docs/10-anomaly-logic.md`; CTA "See the full reading" routes to Reading Detail |
| `failure` | Friendly cause + fix per `docs/06-ble-protocol.md` §5.5 + `button.primary` "Try again" |

> Per CLAUDE.md anti-pattern: **Animate anomaly banners aggressively. Calm-before-clever.** State transitions on this screen use `motion.normal` (200ms) — never aggressive pulses or flashing.

---

## Parent-side tap confirm (D8 §4.13 / §3.14)

After a reading is captured:
- Parent's phone shows a full-screen confirm sheet with the reading values in `type.numeric-xl`.
- Two large buttons (parent-mode 64pt min height): **"This is me"** / **"Not me"**.
- "Not me" routes to a soft-hide flow (`hidden_reason = 'measured_someone_else'` per `docs/01-data-model.md`). Does NOT delete the reading — RLS forbids hard-delete of watch readings.

Voice (per `docs/05-voice-and-claims.md`):
- Sentence-case headline. "Was this reading yours?" — calm, not accusatory.
- Never "Confirm" alone — use "This is me".

---

## Offline behaviour

Per `docs/01-data-model.md` §"Sync strategy" + CLAUDE.md ("offline-first: every reading is saved to MMKV before any sync attempt"):

- Reading is saved to MMKV pending buffer **synchronously** before showing the success state.
- If `/sync` fails, reading remains in MMKV; retry on next connectivity event.
- After 24h of failed sync, calm reassurance banner: *"Your readings are saved. They'll sync when you're back online."*

---

## Accessibility

- `accessibilityLiveRegion="polite"` on the state copy ("Inflating cuff", "Holding still", etc.).
- Numeric reading announced verbally on success: *"128 over 82, pulse 74. Within your usual range."*
- VoiceOver / TalkBack reads the friendly-cause error verbatim.

---

## Sprint 6 acceptance criteria
- All 5 states (`connecting`, `waiting_for_watch`, `fetching`, `success`, `failure`) render with correct tokens.
- Path A and Path B both flow: watch button press → `0x73 0x02` → `0x14 readBPHistory` → MMKV write → classification → Reading Detail. The "trigger" is identical because the hardware doesn't accept a remote inflate command.
- Manual-entry sheet (D6 US-26) saves a reading without touching the watch.
- MMKV pending-buffer write is **synchronous** before UI confirmation (test with airplane mode — the success view renders even with the device offline).
- Parent-side tap-confirm bottom sheet is deferred to Sprint 7 (caregiver home + anomaly engine context).
- Voice gate passes (including success-state numeric readout).
- Component + integration tests covering happy path + manual-entry + failure path.

---

## D8a status

Per D8a §5: Watch Pairing is **UNCHANGED**, and per §6.5 the Take-a-Reading FAB lives on the **self-buyer home screen only** (caregivers don't take readings — the parent does on the watch). This screen (`take-reading.md`) is reached by:

- Self-buyer tapping the "Take a Reading" FAB on home → walks them through the BLE-triggered measurement.
- Parent receiving a watch-pushed reading → Parent-side tap-confirm full-screen sheet (still per D8 §4.13).
- Caregiver triggering a manual reading from Reading Detail (rare — only when the watch is in the caregiver's hand).

The success-state layout remains as written. D8a does not supersede this screen.
