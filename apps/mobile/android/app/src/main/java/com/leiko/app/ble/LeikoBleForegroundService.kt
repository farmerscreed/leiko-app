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
