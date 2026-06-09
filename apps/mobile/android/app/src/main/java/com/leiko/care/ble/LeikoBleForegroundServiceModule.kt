package com.leiko.care.ble

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
