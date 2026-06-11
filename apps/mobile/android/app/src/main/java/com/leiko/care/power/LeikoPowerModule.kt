package com.leiko.care.power

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Battery-optimization (Doze) exemption.
 *
 * Android does NOT guarantee delivery of silent FCM data messages — the
 * remote-refresh "sync now" push — to a backgrounded app unless the app is
 * exempt from battery optimization. Leiko qualifies for the exemption under
 * Google Play policy as a companion-device app: it already declares
 * FOREGROUND_SERVICE_CONNECTED_DEVICE for the BP watch and keeps a persistent
 * BLE connection. See plans/REMOTE_REFRESH_FIX_2026-06-10.md §④.
 *
 * Exposed to JS as NativeModules.LeikoPower (see services/power/batteryOptimization.ts).
 */
class LeikoPowerModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {

  override fun getName(): String = "LeikoPower"

  /** True when the app is already exempt from battery optimization. */
  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    try {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      promise.resolve(pm.isIgnoringBatteryOptimizations(context.packageName))
    } catch (e: Exception) {
      promise.reject("battery_opt_check_failed", e.message, e)
    }
  }

  /**
   * Shows the system "Allow Leiko to ignore battery optimization?" dialog
   * (needs the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission). If the direct
   * dialog can't be launched, falls back to the battery-optimization settings
   * list (no special permission). Resolves true if already exempt; otherwise
   * resolves false — the user's choice isn't known until they return, so the
   * caller should re-check with isIgnoringBatteryOptimizations() on next focus.
   */
  @ReactMethod
  fun requestIgnoreBatteryOptimizations(promise: Promise) {
    try {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (pm.isIgnoringBatteryOptimizations(context.packageName)) {
        promise.resolve(true)
        return
      }
      val activity = currentActivity
      val direct = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:${context.packageName}")
        if (activity == null) addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      try {
        (activity ?: context).startActivity(direct)
      } catch (_: Exception) {
        val list = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
          if (activity == null) addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        (activity ?: context).startActivity(list)
      }
      promise.resolve(false)
    } catch (e: Exception) {
      promise.reject("battery_opt_request_failed", e.message, e)
    }
  }
}
