# Implementation Spec — BLE Foreground Service for Leiko Android

**Purpose**: Add a real Android foreground service that maintains the BLE connection to the Leiko watch while the app is backgrounded, with a persistent system notification visible to the user. Required by Play Console policy because we declared `FOREGROUND_SERVICE_CONNECTED_DEVICE`, and structurally important because Leiko's "Family Circle sees readings as they arrive" promise breaks without it.

This spec is self-contained. Hand it to a fresh Claude Code session (or implement it yourself with these snippets). Estimated effort: 3-4 hours including build + smoke test on a device.

---

## What gets built

1. **Native Android service** (`LeikoBleForegroundService.kt`) — extends `Service`, calls `startForeground()` with a persistent notification, exposes start/stop methods
2. **Native module bridge** (`LeikoBleForegroundServiceModule.kt`) — React Native NativeModule that exposes `start()` / `stop()` to JS
3. **Package registration** — add the new package to `MainApplication.kt`
4. **JS wrapper** (`apps/mobile/src/services/ble/foregroundService.ts`) — typed API + safe-on-non-Android no-op
5. **Integration points**:
   - Start the service when a watch pairs successfully (in `usePairing.confirmPair()`)
   - Stop the service when the user forgets the watch or signs out (in `usePairing.forget()` and `useAuth.signOut()`)
6. **Tests** for the JS wrapper (smoke + integration)

---

## Files to add or modify

```
apps/mobile/android/app/src/main/java/com/leiko/app/ble/
  ├── LeikoBleForegroundService.kt          (new)
  ├── LeikoBleForegroundServiceModule.kt    (new)
  └── LeikoBleForegroundServicePackage.kt   (new)

apps/mobile/android/app/src/main/java/com/leiko/app/
  └── MainApplication.kt                    (modify — register the new package)

apps/mobile/android/app/src/main/res/values/
  └── strings.xml                           (modify — add notification strings)

apps/mobile/android/app/src/main/AndroidManifest.xml   (modify — declare the service)

apps/mobile/src/services/ble/
  ├── foregroundService.ts                  (new — JS wrapper)
  └── __tests__/foregroundService.test.ts   (new — wrapper tests)

apps/mobile/src/state/
  ├── pairing.ts                            (modify — call start on pair, stop on forget)
  └── auth.ts                               (modify — call stop on signOut)
```

---

## Step 1 — The Kotlin service

Path: `apps/mobile/android/app/src/main/java/com/leiko/app/ble/LeikoBleForegroundService.kt`

```kotlin
package com.leiko.app.ble

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.leiko.app.MainActivity
import com.leiko.app.R

/**
 * Foreground service that keeps the BLE link to the Leiko watch alive
 * while the React Native app is backgrounded. The visible notification
 * is required by Google Play (FOREGROUND_SERVICE_CONNECTED_DEVICE) and
 * by Android's runtime — without it, the OS kills the service after
 * 5 seconds.
 *
 * Lifecycle:
 *   - start: called from JS when a watch successfully pairs.
 *   - stop:  called from JS when the user forgets the watch or signs out.
 *
 * The actual BLE work is owned by react-native-ble-plx in the JS layer;
 * this service exists only to keep the OS process alive and the link
 * un-throttled while the app is backgrounded.
 */
class LeikoBleForegroundService : Service() {

  companion object {
    const val CHANNEL_ID = "leiko_ble"
    const val NOTIFICATION_ID = 4242
    const val ACTION_START = "com.leiko.app.ble.START"
    const val ACTION_STOP  = "com.leiko.app.ble.STOP"

    fun start(context: Context) {
      val intent = Intent(context, LeikoBleForegroundService::class.java).apply {
        action = ACTION_START
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      val intent = Intent(context, LeikoBleForegroundService::class.java).apply {
        action = ACTION_STOP
      }
      context.startService(intent)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        return START_NOT_STICKY
      }
      else -> {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          startForeground(
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
          )
        } else {
          startForeground(NOTIFICATION_ID, notification)
        }
        return START_STICKY
      }
    }
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      getString(R.string.ble_channel_name),
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = getString(R.string.ble_channel_description)
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val tapIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val contentIntent = PendingIntent.getActivity(
      this, 0, tapIntent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    val stopIntent = Intent(this, LeikoBleForegroundService::class.java).apply {
      action = ACTION_STOP
    }
    val stopPending = PendingIntent.getService(
      this, 1, stopIntent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(getString(R.string.ble_notification_title))
      .setContentText(getString(R.string.ble_notification_text))
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setOngoing(true)
      .setSilent(true)
      .setContentIntent(contentIntent)
      .addAction(0, getString(R.string.ble_notification_stop), stopPending)
      .build()
  }
}
```

---

## Step 2 — The React Native bridge module

Path: `apps/mobile/android/app/src/main/java/com/leiko/app/ble/LeikoBleForegroundServiceModule.kt`

```kotlin
package com.leiko.app.ble

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LeikoBleForegroundServiceModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {

  override fun getName(): String = "LeikoBleForegroundService"

  @ReactMethod
  fun start(promise: Promise) {
    try {
      LeikoBleForegroundService.start(context)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ble_fg_start_failed", e.message, e)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      LeikoBleForegroundService.stop(context)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("ble_fg_stop_failed", e.message, e)
    }
  }
}
```

Path: `apps/mobile/android/app/src/main/java/com/leiko/app/ble/LeikoBleForegroundServicePackage.kt`

```kotlin
package com.leiko.app.ble

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class LeikoBleForegroundServicePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(LeikoBleForegroundServiceModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
```

---

## Step 3 — Register the package in MainApplication.kt

In `apps/mobile/android/app/src/main/java/com/leiko/app/MainApplication.kt`, find the `getPackages()` override and add the new package:

```kotlin
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
      add(com.leiko.app.ble.LeikoBleForegroundServicePackage())
    }
```

---

## Step 4 — Declare the service in AndroidManifest.xml

Inside the `<application>` block of `apps/mobile/android/app/src/main/AndroidManifest.xml`, alongside the `<activity>` declaration, add:

```xml
<service
    android:name=".ble.LeikoBleForegroundService"
    android:exported="false"
    android:foregroundServiceType="connectedDevice"
    android:stopWithTask="false" />
```

The `foregroundServiceType="connectedDevice"` value is what links the runtime to the `FOREGROUND_SERVICE_CONNECTED_DEVICE` permission you've already declared. Without this attribute, Android crashes the service on Android 14+.

---

## Step 5 — Notification strings

In `apps/mobile/android/app/src/main/res/values/strings.xml`:

```xml
<resources>
  <string name="app_name">Leiko</string>
  <string name="ble_channel_name">Watch connection</string>
  <string name="ble_channel_description">Keeps your Leiko watch connected and your readings flowing.</string>
  <string name="ble_notification_title">Leiko</string>
  <string name="ble_notification_text">Connected to your watch</string>
  <string name="ble_notification_stop">Stop</string>
</resources>
```

Voice-rule note: every string passes — calm, no fear, no medical claims.

---

## Step 6 — JS wrapper

Path: `apps/mobile/src/services/ble/foregroundService.ts`

```ts
// Foreground service wrapper. Keeps the BLE link to the Leiko watch
// alive while the app is backgrounded, with a persistent system
// notification ("Leiko · Connected to your watch") visible to the
// user. Required by Play Console policy for the
// FOREGROUND_SERVICE_CONNECTED_DEVICE permission, and structurally
// important because the Family Circle feature depends on near-
// real-time syncing while the user isn't actively in the app.
//
// On iOS this whole module is a no-op — iOS background BLE is
// handled differently (Core Bluetooth background mode + state
// preservation/restoration). The wrapper signature stays the same
// across platforms so call sites don't need Platform checks.

import { NativeModules, Platform } from 'react-native';
import { logger } from '../analytics/logger';

interface NativeApi {
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
}

const native: NativeApi | undefined =
  Platform.OS === 'android'
    ? (NativeModules.LeikoBleForegroundService as NativeApi | undefined)
    : undefined;

let running = false;

/** Idempotent — calling start() twice in a row is safe. */
export async function startBleForegroundService(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (running) return;
  if (!native) {
    logger.track('ble_fg_unavailable', { reason: 'native_module_missing' });
    return;
  }
  try {
    await native.start();
    running = true;
    logger.track('ble_fg_started');
  } catch (e) {
    logger.track('ble_fg_start_failed', {
      reason: e instanceof Error ? e.message : 'unknown',
    });
  }
}

export async function stopBleForegroundService(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!running) return;
  if (!native) return;
  try {
    await native.stop();
    running = false;
    logger.track('ble_fg_stopped');
  } catch (e) {
    logger.track('ble_fg_stop_failed', {
      reason: e instanceof Error ? e.message : 'unknown',
    });
  }
}

export function isBleForegroundServiceRunning(): boolean {
  return running;
}

/** Test surface */
export function _resetBleForegroundServiceForTests(): void {
  running = false;
}
```

---

## Step 7 — Add the new analytics events to logger.ts

In `apps/mobile/src/services/analytics/logger.ts`, extend the `AnalyticsEvent` union:

```ts
  | { name: 'ble_fg_started' }
  | { name: 'ble_fg_stopped' }
  | { name: 'ble_fg_unavailable'; props?: { reason: string } }
  | { name: 'ble_fg_start_failed'; props?: { reason: string } }
  | { name: 'ble_fg_stop_failed'; props?: { reason: string } }
```

---

## Step 8 — Integration points

### a) When a watch pairs successfully

In `apps/mobile/src/state/pairing.ts`, find the `confirmPair` action. After the pairing succeeds and the device meta is persisted, add:

```ts
import { startBleForegroundService } from '../services/ble/foregroundService';

// inside confirmPair, after successful pair + persist:
void startBleForegroundService();
```

### b) When the user forgets the watch

In the same file, inside the `forget` action:

```ts
import { stopBleForegroundService } from '../services/ble/foregroundService';

// at the start of forget(), before clearing MMKV:
void stopBleForegroundService();
```

### c) When the user signs out

In `apps/mobile/src/state/auth.ts`, inside the `signOut` action:

```ts
import { stopBleForegroundService } from '../services/ble/foregroundService';

// at the start of signOut(), before supabase.auth.signOut():
void stopBleForegroundService();
```

### d) On app boot, if a watch is already paired

In `apps/mobile/src/navigation/RootNavigator.tsx` (or wherever pairing hydration runs), after the pairing store hydrates from MMKV:

```ts
import { startBleForegroundService } from '../services/ble/foregroundService';

// in the hydrate effect:
const paired = usePairing.getState().pairedDevice;
if (paired) {
  void startBleForegroundService();
}
```

---

## Step 9 — Tests

Path: `apps/mobile/src/services/ble/__tests__/foregroundService.test.ts`

```ts
// Coverage for the JS wrapper of the BLE foreground service.

import { Platform } from 'react-native';
import {
  _resetBleForegroundServiceForTests,
  isBleForegroundServiceRunning,
  startBleForegroundService,
  stopBleForegroundService,
} from '../foregroundService';

const mockStart = jest.fn().mockResolvedValue(true);
const mockStop = jest.fn().mockResolvedValue(true);

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: {
    LeikoBleForegroundService: {
      start: mockStart,
      stop: mockStop,
    },
  },
}));

beforeEach(() => {
  _resetBleForegroundServiceForTests();
  mockStart.mockClear();
  mockStop.mockClear();
});

describe('ble foreground service wrapper', () => {
  it('starts the native service on android', async () => {
    await startBleForegroundService();
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(isBleForegroundServiceRunning()).toBe(true);
  });

  it('start is idempotent — second call does nothing', async () => {
    await startBleForegroundService();
    await startBleForegroundService();
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('stop is a no-op if not started', async () => {
    await stopBleForegroundService();
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('start then stop calls both', async () => {
    await startBleForegroundService();
    await stopBleForegroundService();
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(isBleForegroundServiceRunning()).toBe(false);
  });

  it('no-ops on iOS', async () => {
    (Platform as { OS: string }).OS = 'ios';
    await startBleForegroundService();
    expect(mockStart).not.toHaveBeenCalled();
    expect(isBleForegroundServiceRunning()).toBe(false);
    (Platform as { OS: string }).OS = 'android';
  });
});
```

---

## Verification checklist

After building vc20 and installing on a test device:

- [ ] Open Leiko fresh, pair a watch
- [ ] Swipe down from top of screen → see `Leiko · Connected to your watch` notification with a Stop action
- [ ] Lock the phone for 10 minutes
- [ ] Pull notification shade — notification is still there
- [ ] Take a reading on the watch hardware
- [ ] Open Leiko — the reading is there (proves background sync ran)
- [ ] In Leiko: Settings → Watch → Forget watch
- [ ] Pull notification shade — notification is GONE (proves stop worked)
- [ ] Re-pair the watch
- [ ] Sign out from Settings
- [ ] Notification is GONE again (proves auth-driven stop works)
- [ ] On iOS device (if available): app behaves normally, no errors in console, no notification (correct — iOS doesn't use this)

If all 10 boxes pass, record the Play Console verification video against vc20 and submit.

---

## What this implementation does NOT do

- It does NOT itself fire BLE commands — `react-native-ble-plx` continues to own the BLE work in the JS layer. The foreground service exists only to keep the OS process alive + the system notification visible.
- It does NOT handle iOS background BLE — that's a separate iOS implementation using `bluetooth-central` background mode (already declared in `app.json`) plus Core Bluetooth state preservation/restoration. Out of scope for this PR.
- It does NOT itself implement battery-optimization exclusion — Android may still throttle the app over time. A future PR could add `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` flow.

---

## Effort estimate breakdown

| Task | Time |
|---|---|
| Kotlin service + module + package (steps 1-3) | 60 min |
| Manifest + strings (steps 4-5) | 10 min |
| JS wrapper + logger events (steps 6-7) | 30 min |
| Integration points in pairing + auth + navigator (step 8) | 45 min |
| Tests (step 9) | 30 min |
| Build vc20 + install + smoke test (verification) | 30 min |
| Record + upload the Play Console video against vc20 | 20 min |
| **Total** | **3-4 hours** |

---

## Branch + PR convention

Open as a new branch off `claude/release-on-competent-goldberg`, named `claude/ble-foreground-service`. Single commit with the message:

```
feat(ble): real foreground service with persistent system notification

Adds LeikoBleForegroundService — a native Android Service that keeps the
BLE link to the Leiko watch alive while the app is backgrounded, with a
persistent "Leiko · Connected to your watch" notification visible in the
system tray.

Required by Google Play (we declared FOREGROUND_SERVICE_CONNECTED_DEVICE
but never actually started a foreground service — the manifest was a
promise we hadn't kept). Also structurally important: the Family Circle
"see readings as they arrive" promise depends on background BLE work,
which Android Doze + battery optimisation kills without a foreground
service holding the process up.

Service starts when a watch successfully pairs (state/pairing.confirmPair).
Stops on forget (state/pairing.forget), sign-out (state/auth.signOut),
or a tap on the notification's "Stop" action.

iOS unaffected — wrapper is a no-op there; iOS background BLE uses
Core Bluetooth state preservation already configured via app.json
UIBackgroundModes.

Verification video recorded against vc20 for Play Console:
<youtube link to be added after recording>
```

---

## Notes for the implementer

- The `MainActivity::class.java` reference in the notification tap-intent requires `import com.leiko.app.MainActivity` — already in the leiko app namespace.
- `R.mipmap.ic_launcher` references the existing app icon — no new image assets needed.
- `Build.VERSION_CODES.UPSIDE_DOWN_CAKE` is Android 14 (API 34). For older Android versions, the `startForeground` overload without the `foregroundServiceType` parameter is the right path — the conditional in step 1 handles both.
- The new package import statement in `MainApplication.kt` needs to land OUTSIDE of any other `add()` block — keep `PackageList(this).packages.apply { ... }` structure intact.
- After this PR, run `cd apps/mobile && npx tsc --noEmit && npx eslint . && npx jest src/services/ble` locally to confirm typecheck + lint + tests pass before pushing.

This spec is complete. The next session can pick it up cold and execute.

— End of spec —
