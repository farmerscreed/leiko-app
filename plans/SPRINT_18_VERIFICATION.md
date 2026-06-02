# Sprint 18 — Day 5 Bench Verification

**Date:** 2026-05-20
**Devices:**
- Phone 1: Pixel 8 (`43230DLJH001YY`) — self-buyer `biebele@gmail.com`
- Phone 2: OnePlus Nord N30 (`8fae80bc`) — caregiver `bokpokiri@gmail.com`

---

## Test 1 — FUN-7: applyDeviceConfig pushes to watch

**What we're testing:** Settings → Profile height/weight/age values
actually reach the watch hardware via the `setUserParams` BLE command.

**Procedure:**
1. Open Leiko on Phone 1 (has Watch 1 paired)
2. Go to Settings → Profile
3. Note the current height/weight/age values
4. Change height to a clearly different value (e.g., if 170cm → 175cm)
5. Go back to Home. Wait for the next sync or tap "Take a reading" to
   force a `applyDeviceConfig(force: true)` call
6. On the watch: long-press → settings menu → verify the new height
   value is reflected
7. Change height back to the original value and repeat to confirm
   bi-directional reliability

**What to watch for:**
- `BLE_TRACE` logs in Metro terminal should show:
  `[applyDeviceConfig] start reason=force` followed by
  `[setUserParams] ok` with the new values
- If the watch shows old values, the BLE command may be silently failing

**Result:** `[ ] PASS` / `[ ] FAIL`
**Notes:**

---

## Test 2 — FUN-8: Background fetch fires

**What we're testing:** The app syncs data from the watch in the
background without user interaction.

**Procedure:**
1. Open Leiko on Phone 1, note the current "Last sync" timestamp in
   Settings → About (or the DaySpine on Home)
2. Ensure the watch is nearby and has Bluetooth on
3. Force-close the app (swipe away from recents)
4. Wait **30 minutes** (set a timer)
5. Re-open the app
6. Check "Last sync" timestamp — it should have moved forward
7. Check Metro logs for `background_sync_fired` analytics event
   (if Metro was running during the background period)

**What to watch for:**
- Android Doze may suppress background fetch if the phone is stationary
  and screen-off for too long. Plugging in USB may help keep it awake.
- If the timestamp did NOT move, check:
  - Settings → Apps → Leiko → Battery → "Unrestricted" is enabled
  - The `expo-background-fetch` task registered (`background_sync_registered`
    in the startup analytics)

**Result:** `[ ] PASS` / `[ ] FAIL`
**Notes:**

---

## Test 3 — QUA-1: BP value mismatch race

**What we're testing:** The 200ms settling delay after `0x73 0x02`
prevents stale/partial BP values from showing in History.

**Procedure:**
1. Open Leiko on Phone 1
2. Start a BP reading on the watch
3. **Immediately** after the reading completes (watch beeps), tap
   the History tab on the phone
4. Compare the value shown on the phone with the value shown on the
   watch screen
5. Repeat 5 times in rapid succession

**What to watch for:**
- Mismatched systolic/diastolic between phone and watch display
- `BLE_TRACE` logs in Metro showing raw payload bytes from
  `parseBPReading` — compare the decoded dia/sys/pulse
- The 200ms delay is intentionally invisible to the user (modal
  animation masks it)

**Result:** `[ ] PASS` / `[ ] FAIL`
**Notes:** (record any mismatches with exact values)

---

## Test 4 — QUA-2: HR interval reads correctly (no fallback)

**What we're testing:** The 30-min hardcoded HR fallback is gone and
the watch's real 5-min interval is read from the index packet.

**Procedure:**
1. On Phone 1, ensure the watch has been worn for at least 30 minutes
   (so it has HR history)
2. Open Leiko → trigger a sync (take a reading or wait for auto-sync)
3. Watch Metro `BLE_TRACE` logs for the HR sync step
4. Confirm `intervalSec` shows as 300 (5 min), NOT 1800 (30 min)
5. Check Heart Rate detail screen — verify sample timestamps are
   spaced ~5 min apart, not 30 min

**What to watch for:**
- If `intervalSec` shows 0 and samples > 0, the guard at
  `syncMultiVitals.ts:305` should log a BLE_TRACE warning and skip
  that day. This would be a firmware-level issue.

**Result:** `[ ] PASS` / `[ ] FAIL`
**Notes:**

---

## Test 5 — QUA-3: Android 14+ BLE foreground service survives Doze

**What we're testing:** BLE connection isn't killed by Android 14+
Doze/power management during a sync.

**⚠️ KNOWN GAP:** The AndroidManifest.xml has
`FOREGROUND_SERVICE_CONNECTED_DEVICE` **permission** but no `<service>`
tag with `android:foregroundServiceType="connectedDevice"`. This may
cause the OS to terminate the BLE service under Doze on Android 14+.

**Procedure (on Phone 2 — OnePlus Nord N30 / Android 14):**
1. Open Leiko, sign in as caregiver
2. Start a BP reading (this starts the BLE foreground service)
3. Mid-reading (while watch is inflating), **lock the phone screen**
4. Wait for the reading to complete (~60 seconds)
5. Unlock the phone — check if the reading was captured successfully
6. If PASS: repeat but wait **5 minutes** with screen locked after
   the reading, then trigger a sync — check if BLE reconnects

**What to watch for:**
- `SecurityException` or service-killed logs in Metro
- If the reading fails when the screen is locked, we need to add a
  `<service>` declaration with `foregroundServiceType="connectedDevice"`
  to the Expo config plugin or `AndroidManifest.xml`

**Result:** `[ ] PASS` / `[ ] FAIL`
**Notes:**

---

## Summary

| Test | Item | Result |
|------|------|--------|
| 1 | FUN-7 — applyDeviceConfig push | `[ ]` |
| 2 | FUN-8 — Background fetch fires | `[ ]` |
| 3 | QUA-1 — BP value mismatch race | `[ ]` |
| 4 | QUA-2 — HR interval (no fallback) | `[ ]` |
| 5 | QUA-3 — Android 14+ BLE Doze | `[ ]` |

**Sprint 18 acceptance:** ≥4/5 PASS. One FAIL is acceptable if it has a
follow-up commit.
