package com.leiko.care.health

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/**
 * Health Connect opens this when the user taps "Read privacy policy" /
 * "Why does Leiko need this?" on its permission screen
 * (ACTION_SHOW_PERMISSIONS_RATIONALE, and VIEW_PERMISSION_USAGE on
 * Android 14+ via the manifest activity-alias). Google requires it to
 * show the app's privacy policy; we open it in the browser and close.
 * Kept out of MainActivity so these intents never start React Native.
 */
class HealthPermissionsRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    try {
      startActivity(
        Intent(Intent.ACTION_VIEW, Uri.parse(PRIVACY_URL))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    } catch (e: ActivityNotFoundException) {
      // No browser — nothing else to show.
    }
    finish()
  }

  private companion object {
    const val PRIVACY_URL = "https://leiko.health/privacy"
  }
}
