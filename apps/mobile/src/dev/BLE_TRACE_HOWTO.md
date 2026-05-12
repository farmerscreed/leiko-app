# BLE_TRACE — How to (re-)introduce forensic capture instrumentation

This is the dev-only byte-level tracing pattern used when we need to see exactly what the watch firmware is doing. Introduced in Sprint 16.5a Phase A. Reintroduce whenever a new BLE bug needs trace evidence — the pattern below is deliberately consistent so a future session can wire it up in a single pass without re-thinking site placement.

**Hard rule:** `BLE_TRACE` must never reach a release build. Always strip the call sites in a separate commit before merging to a release branch. The `typeof __DEV__ !== 'undefined' && __DEV__` guard is a safety net, not a license to ship.

---

## The 8 instrumentation sites

Each site uses the same flag declaration near the top of its file. Cheap boolean short-circuit at every call site — zero cost in production:

```ts
// BLE_TRACE — forensic-capture instrumentation. See
// apps/mobile/src/services/ble/UrionDevice.ts for the convention.
const BLE_TRACE = typeof __DEV__ !== 'undefined' && __DEV__;
```

### Site 1 — `apps/mobile/src/services/ble/UrionDevice.ts` (notify firehose)

Inside `startNotify`'s monitor callback, immediately after `parsePacket` succeeds:

```ts
if (BLE_TRACE) {
  const p = packet.payload;
  console.log(
    `[ble-trace] notify cmd=0x${hex2(packet.command)} ` +
      `payload[0..3]=${hex2(p[0] ?? 0)} ${hex2(p[1] ?? 0)} ` +
      `${hex2(p[2] ?? 0)} ${hex2(p[3] ?? 0)} ` +
      `listeners=${this.listeners.size}`,
  );
}
```

Helper at file scope: `function hex2(n: number): string { return (n & 0xff).toString(16).padStart(2, '0'); }`.

### Site 2 — `UrionDevice.ts` (CRC fail)

Inside the `CrcError` branch:

```ts
if (BLE_TRACE) console.log(`[ble-trace] CRC fail deviceId=${this.id}`);
```

### Site 3 — `apps/mobile/src/services/ble/notify.ts` (0x73 byte tally)

Inside `subscribeToNotifications`'s callback, after `classifyNotification(packet)`:

```ts
if (BLE_TRACE) {
  const raw = packet.payload[0];
  console.log(
    `[ble-trace] 0x73 kindByte=0x${raw.toString(16).padStart(2, '0')} ` +
      `classified=${kind ?? 'null'}`,
  );
  useCaptureStats.getState().recordNotifyKind(raw);
}
```

Import: `import { useCaptureStats } from '../../dev/captureStats';`. The `recordNotifyKind` call feeds the Capture Status panel's byte tally.

### Site 4 — `apps/mobile/src/services/sync/syncBacklog.ts` (BP cursor flow)

Three sites in `syncBacklog()`:

```ts
// Site 4a — at entry, immediately after lastSync is read:
if (BLE_TRACE) {
  console.log(
    `[ble-trace] syncBacklog enter deviceBleId=${deviceBleId} lastSync=${lastSync} (raw watch sec)`,
  );
}

// Site 4b — immediately after readBPHistory resolves:
if (BLE_TRACE) {
  console.log(
    `[ble-trace] syncBacklog readBPHistory returned ${readings.length} packet(s); ` +
      `first.ts=${readings[0]?.timestampSec ?? 'n/a'} ` +
      `last.ts=${readings[readings.length - 1]?.timestampSec ?? 'n/a'}`,
  );
}

// Site 4c — at exit, after the filter + cursor advance:
if (BLE_TRACE) {
  console.log(
    `[ble-trace] syncBacklog exit pulled=${fresh.length} ` +
      `(filtered from ${readings.length}); cursor ${lastSync} → ${newest}`,
  );
}
```

### Site 5 — `apps/mobile/src/services/sync/applyDeviceConfig.ts` (config bundle)

Per-step run + skip logging. The silent-skip case for `setUserParams` is the load-bearing visibility win — pre-Phase A this failed silently when profile demographics were missing, costing us a full sprint of bench time.

```ts
// At the dirty-gate skip:
if (BLE_TRACE) {
  console.log('[ble-trace] applyDeviceConfig skipped — dirty=false force=false');
}

// At start, after the gate passes:
if (BLE_TRACE) {
  console.log(
    `[ble-trace] applyDeviceConfig start — force=${opts.force ?? false} dirty=${setup.dirty} ` +
      `autoHR=${setup.autoHrEnabled} autoSpO2=${setup.autoSpo2Enabled} ` +
      `hasDemographics=${profile ? hasDemographics(profile) : false}`,
  );
}

// After each step's success:
if (BLE_TRACE) console.log('[ble-trace] applyDeviceConfig step=<stepName> ok');

// At the setUserParams demographics-missing branch:
if (BLE_TRACE) {
  console.log(
    `[ble-trace] applyDeviceConfig step=userParams SKIPPED ` +
      `(profile=${profile ? 'present' : 'null'}, hasDemographics=false). ` +
      'Watch will not receive demographics this cycle.',
  );
}

// At end:
if (BLE_TRACE) {
  console.log(
    `[ble-trace] applyDeviceConfig done — steps=${steps.length} [${steps.join(',')}]`,
  );
}
```

### Site 6 — `apps/mobile/src/services/sync/syncMultiVitals.ts` (per-vital steps)

Enter / per-day / exit for each of `syncHRStep`, `syncSpO2Step`, `syncDayInfoStep`:

```ts
// Enter:
if (BLE_TRACE) {
  console.log(`[ble-trace] syncMultiVitals.<vital> enter cursor=<cursor> days=[<list>]`);
}
// Per-day (after each read*History returns):
if (BLE_TRACE) {
  console.log(`[ble-trace] syncMultiVitals.<vital> day=<d> returned <n> samples`);
}
// Exit:
if (BLE_TRACE) {
  console.log(`[ble-trace] syncMultiVitals.<vital> exit totalPulled=<n>`);
}
```

### Site 7 — `apps/mobile/src/services/ble/commands/readHRHistory.ts` (sample cadence)

Inside the index-packet branch (`seq === 0x00`):

```ts
if (BLE_TRACE) {
  console.log(
    `[ble-trace] readHRHistory index totalPackets=${totalPackets} ` +
      `intervalMinutes=${intervalMinutes} (assumed 30 in slice config)`,
  );
}
```

Mirror in `readSpO2History.ts` with `assumed 60`.

### Site 8 — `apps/mobile/src/services/ble/commands/readDayInfo.ts` (full payload dump)

Inside the `onNotify` for `0x07` packets — every packet's full 14-byte payload logged as hex. This is the highest-value site for spotting un-parsed byte regions (REM, awake counts, transitions that the spec might expose but we're not reading):

```ts
function payloadHex(payload: Uint8Array): string {
  return Array.from(payload, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

if (BLE_TRACE) {
  console.log(
    `[ble-trace] readDayInfo packet idx=0x${index.toString(16).padStart(2, '0')} ` +
      `daysAgo=${options.daysAgo} payload=${payloadHex(packet.payload)}`,
  );
}
```

---

## Capture commands

### Windows / PowerShell

```powershell
# Clear buffer, then stream with grep + tee to a file.
adb logcat -c
adb logcat -v time | Select-String -Pattern 'ble-trace|take-reading|sync-backlog|sync-mv|applyDeviceConfig|device_config|ble_cursor_reset|ble_crc_fail' | Tee-Object -FilePath capture-<scenario>.log
```

### Bash (MSYS / WSL / mac / Linux)

```bash
adb logcat -c
adb logcat -v time | grep --line-buffered -E '\[ble-trace\]|\[take-reading\]|\[sync-backlog\]|\[sync-mv\]|applyDeviceConfig|device_config|ble_cursor_reset|ble_crc_fail' | tee capture-<scenario>.log
```

### Save full logcat for later filtering

If you'd rather catch everything and grep offline:

```bash
adb logcat -c
adb logcat -v time > capture-<scenario>-full.log
# Ctrl+C when done, then:
grep -E '\[ble-trace\]|...' capture-<scenario>-full.log > capture-<scenario>.log
```

Useful when you suspect we're missing a notification kind — the full logcat catches anything our `[ble-trace]` filter would have dropped.

---

## Capture Status panel

Mounted in `apps/mobile/src/dev/VitalsDebugPanel.tsx` — open via the DebugLauncher (`__DEV__` only). Shows live, on-device:

- **Profile completeness** — yob / gender / height / weight all set?
- **`vitalSetup.dirty`** — `true` means next sync will flush; `false` means orchestrator skips `applyDeviceConfig` (unless force-called from take-reading)
- **auto-HR / auto-SpO2** — what the app *thinks* the watch is set to
- **cursor.bp / hr / spo2 / sleep / activity ages** — humanised "Nd ago" per vital
- **0x73 bytes seen** — count per kind byte this session. Anything outside `0x01, 0x02, 0x03, 0x04, 0x07, 0x09, 0x0c, 0x10` is un-mapped → high-value trace finding.

The "Tap to clear byte tally" affordance at the bottom resets the byte counter without restarting the app — useful between scenarios.

---

## Strip checklist (before merging to any release branch)

1. `grep -rE "BLE_TRACE\\s*=" apps/mobile/src` → expect 0 matches.
2. `grep -rE "\[ble-trace\]" apps/mobile/src` → expect 0 matches (the bracketed log prefix).
3. The new helper `hex2` in `UrionDevice.ts` and `payloadHex` in `readDayInfo.ts` go with the trace sites — strip them too.
4. The Capture Status panel section in `VitalsDebugPanel.tsx` stays. It's read-only, dev-only, and shows useful context even when traces aren't being captured.
5. The `apps/mobile/src/dev/captureStats.ts` module stays for future re-introduction.
6. Run typecheck + the touched-file test suite (`applyDeviceConfig`, `syncBacklog`, `syncBacklogToCompletion`, `syncMultiVitals`, `notify`, `UrionDevice`, `readHRHistory`, `readSpO2History`, `readDayInfo`, `readBPHistory`) — must all pass.

---

## Memory cross-references

- `memory/ble_saga_master_log.md` — the canonical end-to-end of the 2026-05-11/12 BLE investigation. Read first for context.
- `memory/urion_dir1_protocol_semantics.md` — the DIR=1 trap. Load-bearing when interpreting `syncBacklog` traces.
- `memory/watch_timestamp_quirk.md` — the UTC+8 offset. Load-bearing when interpreting any timestamp in a trace.
- `memory/running_on_phone.md` — adb + USB + reverse setup. Load-bearing for the bench session itself.
