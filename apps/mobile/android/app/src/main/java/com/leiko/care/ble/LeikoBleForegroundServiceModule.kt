package com.leiko.care.ble

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext

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

  // Wall-clock delay that fires even when React Native's TimingModule is
  // paused. An OS-woken headless process has never had a resumed activity,
  // so setTimeout callbacks are queued but never dispatched — which
  // silently disarmed every BLE/upload timeout during background sync
  // (2026-08-15: runs hung 20+ minutes on a 5 s command timeout). A
  // Handler on the main looper is driven by the OS, not the RN lifecycle.
  @ReactMethod
  fun delay(ms: Double, promise: Promise) {
    try {
      android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(
        { promise.resolve(true) },
        ms.toLong().coerceAtLeast(0L),
      )
    } catch (e: Exception) {
      promise.reject("ble_fg_delay_failed", e.message, e)
    }
  }

  // ── JS-timer keep-alive (2026-10-27/29) ──────────────────────────────
  //
  // React Native pauses ALL JS timers (setTimeout / setInterval) when the
  // activity pauses, unless a headless JS task is active
  // (JavaTimerManager: isPaused && !isRunningTasks → no frames). Leiko's
  // process stays alive in the background (this foreground service), so
  // background syncs DO run — but anything awaiting a timer never
  // resolves. On the founder's Pixel 8 that froze supabase-js's token
  // refresh retry (helpers.sleep → setTimeout) while it held the auth
  // lock, so every background upload waited 30 s and gave up; no request
  // reached the server for hours. Holding one no-op headless task for as
  // long as the BLE service runs keeps the JS timer pump alive.
  //
  // The JS side registers the task (KEEP_TIMERS_TASK in
  // services/tasks/registerHeadlessTasks); its promise never settles,
  // and releaseJsTimers() finishes it from here.

  private var keepAliveTaskId: Int? = null

  @ReactMethod
  fun holdJsTimers(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val existing = keepAliveTaskId
        val ctx = HeadlessJsTaskContext.getInstance(context)
        if (existing != null && ctx.isTaskRunning(existing)) {
          promise.resolve(existing)
          return@runOnUiThread
        }
        val id = ctx.startTask(
          HeadlessJsTaskConfig(
            KEEP_TIMERS_TASK,
            Arguments.createMap(),
            0L, // no timeout — released explicitly
            true, // allowed while the app is in the foreground
          ),
        )
        keepAliveTaskId = id
        promise.resolve(id)
      } catch (e: Exception) {
        promise.reject("ble_fg_hold_timers_failed", e.message, e)
      }
    }
  }

  @ReactMethod
  fun releaseJsTimers(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      try {
        val id = keepAliveTaskId
        if (id != null) {
          val ctx = HeadlessJsTaskContext.getInstance(context)
          if (ctx.isTaskRunning(id)) ctx.finishTask(id)
        }
        keepAliveTaskId = null
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("ble_fg_release_timers_failed", e.message, e)
      }
    }
  }

  companion object {
    /** Must match KEEP_TIMERS_TASK in src/services/tasks/taskNames.ts. */
    const val KEEP_TIMERS_TASK = "leiko.keepJsTimersAlive"
  }
}
