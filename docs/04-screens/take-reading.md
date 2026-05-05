# Screen — Take Reading

Triggered when the caregiver or self-buyer wants to capture a fresh BP reading via the watch. Sourced from D8 §4.13 (Parent-Side Tap Confirm) + D6 US-21 / US-22 / US-23 (manual + watch-pushed reading flow).

---

## Audience
- Caregiver (when watch is in caregiver's hand — rare; usually parent wears it)
- Self-buyer (default user for this screen)
- Parent (post-reading tap-confirm — see "Parent-side flow" below)

---

## Two paths

### Path A — Parent takes a reading on the watch (most common)
1. Parent presses the BP button on the watch.
2. Watch inflates cuff (~45s), reads sys/dia/pulse, pushes via `0x73` notify packet.
3. App receives reading via the BLE notify subscription (`docs/06-ble-protocol.md` §3 cmd `0x73`).
4. Reading is saved to MMKV pending buffer **before** any UI confirmation (`docs/01-data-model.md` §"Local storage on device").
5. POST to `/sync` Edge Function. On success: insert into WatermelonDB, drop from MMKV pending buffer, write to `public.readings`.
6. Anomaly engine classifies on ingest (`docs/10-anomaly-logic.md`).
7. Push to all caregivers in the family per `docs/11-push-notifications.md` daily-summary or anomaly category.

### Path B — User taps "Take a reading now" in the app
This screen lives at `apps/mobile/src/screens/TakeReading.tsx`. Used when:
- Self-buyer wants an on-demand reading.
- Caregiver wants to test the watch is responsive.
- Parent (post-reading tap-confirm) confirms the reading is theirs.

---

## Layout — Path B (in-app)

| Element | Spec |
| --- | --- |
| Hero | Illustration of watch + arm cuff position, 240×180pt, `radius.xl` |
| Headline | `type.display-m` "Take a reading" |
| Body | `type.body-l` "Sit still for about 45 seconds. The watch will inflate the cuff, take the reading, and tell you when it's done." |
| Primary CTA | `button.accent` **"Start reading"** — full-width — large per CLAUDE.md anti-pattern: *"Don't make the 'Take a reading' CTA smaller than the spec says"* |
| Secondary | `button.ghost` "Add a manual reading" — opens bottom sheet with sys / dia / pulse inputs (D6 US-26 manual entry) |

---

## States

| State | Visual |
| --- | --- |
| `idle` | Default — Start CTA enabled |
| `inflating` | Progress ring around watch illustration; `type.body-m` "Inflating cuff…" (~10s) |
| `measuring` | Progress ring continues; `type.body-m` "Holding still…" (~25s) |
| `analysing` | Spinner; `type.body-m` "Reading complete. Saving…" |
| `success` | `type.numeric-xl` showing sys/dia/pulse; `chip.success` showing in-range tier; CTA "Done" routes to Reading Detail |
| `anomaly` | Same layout as success, but with calm-concerned copy from `docs/10-anomaly-logic.md` |
| `failure` | Friendly cause + fix per `docs/06-ble-protocol.md` §5.5 ("We couldn't get a clean reading. Bring the phone closer to the watch and try again.") + `button.primary` "Try again" |

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
- All 6 states render with correct tokens.
- Path A (watch-pushed reading) wires through to anomaly classification + push.
- Path B (in-app start) issues the right BLE command sequence to inflate cuff.
- MMKV pending-buffer write is **synchronous** before UI confirmation (test with airplane mode).
- Parent-side tap-confirm bottom sheet works.
- Voice gate passes (including success-state numeric readout).
- Component + integration tests covering happy path + airplane-mode + failure path.

---

## D8a status

Per D8a §5: Watch Pairing is **UNCHANGED**, and per §6.5 the Take-a-Reading FAB lives on the **self-buyer home screen only** (caregivers don't take readings — the parent does on the watch). This screen (`take-reading.md`) is reached by:

- Self-buyer tapping the "Take a Reading" FAB on home → walks them through the BLE-triggered measurement.
- Parent receiving a watch-pushed reading → Parent-side tap-confirm full-screen sheet (still per D8 §4.13).
- Caregiver triggering a manual reading from Reading Detail (rare — only when the watch is in the caregiver's hand).

The success-state layout remains as written. D8a does not supersede this screen.
