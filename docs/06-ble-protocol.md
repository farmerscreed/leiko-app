# 06 — BLE Protocol (Urion U16 family)

CANONICAL for Sprint 5. Sourced from D7 §5 (BLE Implementation) and D4 Block 4 (protocol reference). Anyone touching `apps/mobile/src/services/ble/` reads this in full before writing code.

---

## 1. GATT profile

| Role | UUID | Direction |
| --- | --- | --- |
| Advertising service (scan filter only) | `0000FEE7-0000-1000-8000-00805F9B34FB` (16-bit SIG short `0xFEE7`) | — |
| GATT service (post-connect) | `6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E` | — |
| Write characteristic | `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` | Phone → Watch |
| Notify characteristic | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` | Watch → Phone |

**Two UUIDs, two purposes.** The Urion firmware advertises with the 16-bit SIG short `0xFEE7` and exposes the custom `6E40FFF0…` service only after the central connects. The `U16PRO_protocol_en.pdf` (vendor reference, in `docs/_reference/`) only specifies the GATT side; the advertising UUID was confirmed empirically against U19M_013C on 2026-05-06. Scan filters that use only the GATT UUID will never match — see `apps/mobile/src/services/ble/io.ts` for the split constants.

Packets are **16 bytes fixed length**:
- `byte[0]` = command
- `bytes[1..14]` = payload
- `byte[15]` = CRC8 (`sum(bytes[0..14]) mod 256`)

CRC failures are silent: drop, request retransmit, log a `ble_crc_fail` PostHog event. Do not surface to user.

---

## 2. Connection state machine

Implemented as an **XState v5 finite-state machine** in `apps/mobile/src/services/ble/connectionMachine.ts`. **Boolean flags (`isConnected`, `isScanning`) are FORBIDDEN** — D4 Block 4.3 rationale.

### States
- `uninitialized` → `BT_READY` → `idle`
- `idle` → `SCAN` → `scanning`
- `scanning` → `CONNECT` → `connecting`
- `connecting` → `CONNECTED` → `connected`
- `connecting` → `ERROR | timeout` → `reconnecting`
- `connected` → `SYNC_START` → `syncing`
- `syncing` → `SYNC_DONE` → `connected`
- `connected | syncing` → `DISCONNECTED` → `reconnecting`
- `reconnecting` → `backoff` → `connecting`
- Any state → `BT_OFF` → `powered_off`

```
   uninitialized ──BT_READY──► idle ──SCAN──► scanning
        │                       │   ◄────CANCEL──┘
        ▼ BT_OFF                │
   powered_off ◄── BT_OFF ──────┤
        │                       │ CONNECT
        │ BT_READY              ▼
        ▼                  connecting ─CONNECTED─► connected
        idle                    │                     │ SYNC_START
                                │ ERROR/timeout       ▼
                                ▼                  syncing ─SYNC_DONE─►
                          reconnecting ◄─DISCONNECTED─── connected
                                │ backoff (5,15,30,60,300,900s)
                                └────► connecting (retry)
```

### Skeleton
```ts
import { setup, assign } from 'xstate';

type Ctx = { deviceId: string | null; retryCount: number; lastError: string | null };

export const connectionMachine = setup({
  types: { context: {} as Ctx, events: {} as
    | { type: 'BT_READY' } | { type: 'BT_OFF' }
    | { type: 'SCAN' } | { type: 'CANCEL' }
    | { type: 'CONNECT'; deviceId: string }
    | { type: 'CONNECTED' }
    | { type: 'DISCONNECTED'; reason?: string }
    | { type: 'SYNC_START' } | { type: 'SYNC_DONE' }
    | { type: 'ERROR'; message: string }
  },
  delays: {
    backoff: ({ context }) => {
      const ladder = [5_000, 15_000, 30_000, 60_000, 5*60_000, 15*60_000];
      return ladder[Math.min(context.retryCount, ladder.length - 1)];
    },
  },
}).createMachine({
  id: 'ble', initial: 'uninitialized',
  context: { deviceId: null, retryCount: 0, lastError: null },
  states: { /* see above transitions */ },
});
```

---

## 3. Command inventory

Fourteen commands wired in v1.0. Each has a TypeScript wrapper in `apps/mobile/src/services/ble/commands/`. Wrappers are pure functions; they consume a connected device handle and return a typed Promise.

| Cmd | Hex | Wrapper | Used in |
| --- | --- | --- | --- |
| Set time / language | `0x01` | `setTime(device, tz)` | D6 US-22 |
| Set goals | `0x21` | `setGoals(device, goals)` | D6 US-86 |
| Read activity (steps, calories) | `0x12` | `readActivity(device, day)` | D6 US-30 |
| Read sleep | `0x12` / `0x13` | `readSleep(device, day)` | D6 US-29 |
| Set user parameters (gender/age/h/w) | `0x0A` | `setUserParams(device, p)` | D6 US-86 |
| Set time format / metric | `0x04` | `setTimeFormat(device, fmt)` | D6 US-86 |
| Auto HR on/off | `0x16` | `setAutoHR(device, bool)` | D6 US-87 |
| Read HR history | `0x15` | `readHRHistory(device, since)` | D6 US-29 / US-31 |
| **Read BP history** | `0x14` | `readBPHistory(device, since)` | **Core sync** |
| Auto SpO2 on/off | `0x2C` | `setAutoSpO2(device, bool)` | D6 US-87 |
| Read SpO2 history | `0x2D` | `readSpO2History(device, day)` | D6 US-31 |
| Find watch (vibrate) | `0x50` | `findWatch(device)` | D6 US-84 helper |
| Watch-pushed notification | `0x73` | (subscribed via Notify char) | Live trigger (D6 §5.11) |
| Factory reset | `0xFF` | `factoryReset(device, confirm)` | D6 US-84 unpair |

### Wrapper template
All wrappers follow this shape: build packet, write, await response, validate.

```ts
import { Device } from 'react-native-ble-plx';
import { buildPacket, expectByte0, sendCommand } from '../io';

export async function setAutoHR(device: Device, enabled: boolean): Promise<void> {
  const payload = new Uint8Array(14);
  payload[0] = 0x02;                 // sub-command per protocol
  payload[1] = enabled ? 0x01 : 0x02;
  await sendCommand(device, 0x16, payload, expectByte0(0x16));
}
```

---

## 4. Reconnection strategy

The single highest-leverage piece of code in the BLE stack.

- **Exponential backoff**: 5s, 15s, 30s, 60s, 5m, 15m. Retry count resets to 0 on a successful connect.
- **Cap at 6 escalations**. After the 6th failure, return to `idle` and surface a "tap to retry" affordance. Prevents radio churn (battery drain).
- **iOS**: use the BleManager state restoration identifier (`leiko-bt`); iOS will auto-reconnect on advertise, and `willRestoreState` wakes the app to a `CONNECTED` transition. Required Info.plist: `NSBluetoothAlwaysUsageDescription` + `UIBackgroundModes: ["bluetooth-central"]` (the phone is the *central*, watch is the peripheral — earlier draft of this doc had `bluetooth-peripheral`, which was wrong and would not enable background BLE for our role).
- **Android**: a Foreground Service holds the BLE connection. `FOREGROUND_SERVICE_CONNECTED_DEVICE` service type required (Android 14+).
- **On EVERY successful reconnect**: write `0x01` (set time / sync clock to parent local TZ) **before** issuing any read. The watch clock drifts.
- **Mutex per `device_id`**: only one reconnection attempt at a time per device.

---

## 5. Failure-mode handling

| Failure | Detection | Handling | User-facing surface |
| --- | --- | --- | --- |
| Bluetooth disabled | `BleManager.state() != PoweredOn` | Transition to `powered_off`; modal asking user to enable BT | Modal: "Turn on Bluetooth to keep Mom's watch in sync" |
| Permission denied (Android) | `PermissionsAndroid.request` returned not-granted | Settings deep link with explainer | Inline explainer + button → Android settings |
| Watch out of range | `0x73` timeout > 60s after expected | Stay in `connected`; do not surface anything | Status pill: "Last sync 4h ago" |
| Watch low battery | `0x73` `0x0C` event with battery < 20% | Banner on dashboard (D6 US-32) | Calm banner; no panic |
| CRC failure on packet | `crc8(packet[0..14]) != packet[15]` | Drop, request retransmit | Silent (logged to PostHog as `ble_crc_fail`) |
| Bond lost (factory reset elsewhere) | `discoverServices` error `AUTH_FAIL` | Show repair flow (D6 US-19) | Help screen |
| Multi-watch confusion | Multiple devices match service UUID | Show last-4-of-MAC + "match this code on the watch" | D6 US-18 disambiguation modal |
| Connection drops mid-sync | Mid-sequence `DISCONNECTED` | Mark cursor at last successful packet; resume on reconnect | Silent |
| Foreground service killed (Samsung One UI) | Service `onDestroy` | Restart with foreground intent flag; if killed twice in 1h, prompt user to disable battery optimisations | Onboarding-time prime + settings deep link |
| Firmware bug returns malformed BP | `sys < 30` or `dia < 20` server-side rejection | Reject reading; PostHog `ble_invalid_reading`; surface nothing to user | Hidden (would erode trust) |

---

## 6. Web Bluetooth pairing (parent side)

**LOCK: Web Bluetooth on Android Chrome is the primary parent-pairing path; iOS native fallback.**

Reasoning: Nigeria is ~85% Android (Statcounter Nov 2025); the parent's phone in Lagos is overwhelmingly likely to be Android Chrome, where Web Bluetooth is supported. The parent receives a WhatsApp link from the caregiver, taps it, lands on a one-screen mobile web pairing flow at `https://pair.leiko.app/{url_token}`, grants Web Bluetooth permission, and the watch is paired in ≤ 2 minutes without installing an app.

iOS Safari does NOT support Web Bluetooth. On iOS, the pairing page detects this (`navigator.bluetooth === undefined`) and routes to a Universal Link: `leiko://pair?token=...` — opens the Leiko app if installed, otherwise the App Store. Once installed, the pairing context is restored on first launch.

US pre-pairing was rejected on shipping-cost grounds.

### 6.1 Web pairing tech stack
- Single Next.js page hosted on Vercel (separate repo `leiko-pair-web`; no PHI; no auth).
- `navigator.bluetooth.requestDevice({ filters: [{ services: ["6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E"] }]})`.
- Communicates with `/accept-pairing` Edge Function using the `url_token`.
- Once `/accept-pairing` returns success: device is bound to the family. Parent takes their first reading directly from the watch (D6 US-17).
- Web pairing flow does NOT do background sync; the parent is encouraged to install the native app for ongoing sync (D6 US-15 voice copy).

---

## 7. Dependencies & gating
- `react-native-ble-plx` v3.x (locked in `docs/00-tech-stack.md`)
- XState v5
- iOS `bluetooth-central` background mode + state-restoration ID
- Android 14+ `FOREGROUND_SERVICE_CONNECTED_DEVICE`
- Sprint 5 hard-blocks on a physical Urion U16 watch in the founder's hand. Founder confirmed: multiple watches available.

## 8. Testing approach
See `docs/13-testing-standard.md` for the full pyramid.

For BLE specifically:
- **Mock layer**: `tools/ble-mock/` (created Sprint 5) implements the same TypeScript interface as the production `BleManager`. Every command wrapper is unit-tested against the mock with command/response sequences captured from real watches.
- **Real-device matrix**: iOS (iPhone 12, 14, 15, 16 covering iOS 16/17/18). Android (Pixel 7/8/9, Samsung A-series + S-series, Xiaomi Redmi, Tecno + Itel for the Nigerian market).
- **Long-soak**: 48-hour and 7-day continuous-connect/disconnect cycles. State machine must not leak. Required before EVERY major release.
