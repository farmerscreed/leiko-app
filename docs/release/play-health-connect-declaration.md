# Play Console — Health Connect permissions declaration (Leiko, com.leiko.care)

Play Console → **App content → Health apps** (and, when Play asks for it,
**Policy → App content → Health Connect permissions**). Google reviews
every Health Connect permission the app requests; each needs a purpose
that matches a feature a reviewer can see. Paste the text below. Keep the
answers factual — Leiko describes readings, it does not diagnose.

Prepared 2026-11-02 for the build that ships the Health Connect fixes
(PR "Health Connect: upsert, history copy, hybrid users, permission
delegate").

## App category / description of health features

> Leiko pairs with the Leiko blood-pressure watch (a wrist monitor with an
> inflating cuff). It records blood pressure, heart rate, blood oxygen,
> sleep and activity from the watch, shows trends, lets the wearer share
> readings with family members they choose, and produces a report to take
> to their doctor. Health Connect is optional and off by default: when the
> user turns it on in Settings → Health Connect, Leiko writes the readings
> from the user's own watch to Health Connect and reads weight, height and
> blood glucose from it.

## Permissions and purpose

| Permission | Access | Purpose (paste) |
|---|---|---|
| WRITE_BLOOD_PRESSURE | Write | Save blood-pressure readings taken on the user's Leiko watch to Health Connect so they appear alongside the user's other health data. |
| WRITE_HEART_RATE | Write | Save heart-rate readings recorded by the user's Leiko watch to Health Connect. |
| WRITE_OXYGEN_SATURATION | Write | Save blood-oxygen (SpO2) readings recorded by the user's Leiko watch to Health Connect. |
| WRITE_SLEEP | Write | Save sleep sessions (with sleep stages) recorded by the user's Leiko watch to Health Connect. |
| WRITE_STEPS | Write | Save the daily step count recorded by the user's Leiko watch to Health Connect. |
| WRITE_ACTIVE_CALORIES_BURNED | Write | Save daily active calories estimated by the user's Leiko watch to Health Connect. |
| READ_WEIGHT | Read | Show the user's weight next to their blood-pressure trends and include it in the doctor report, when the user turns on "Read weight". |
| READ_HEIGHT | Read | Used with weight for context in trends and the doctor report, when the user turns on "Read height". |
| READ_BLOOD_GLUCOSE | Read | Show blood-glucose entries the user already keeps in another app next to their blood-pressure trends, when the user turns on "Read blood glucose". |

Not requested: background read, history read, any exercise/nutrition
permissions. Leiko does not read its own records back (reads filter out
`com.leiko.care` as the data origin).

## Data handling answers

- **Is Health Connect data shared with third parties?** No. Readings the
  user chooses to share are visible only to family members the user
  invites in the app. Nothing from Health Connect is sold or used for
  advertising.
- **Is it used for advertising or credit/insurance decisions?** No.
- **Analytics:** event counts only (e.g. "N records written"); never
  health values (CLAUDE.md data rule; `services/analytics/logger.ts`).
- **Privacy policy URL:** https://leiko.health/privacy — must mention
  Health Connect data (what is read/written, that it stays on the user's
  device and Leiko's servers, how to revoke). **VERIFY the page says this
  before submitting.**
- **Rationale screen:** Health Connect's "privacy policy" link opens
  `HealthPermissionsRationaleActivity`, which opens the privacy policy
  (Android 13: `ACTION_SHOW_PERMISSIONS_RATIONALE`; Android 14+:
  `VIEW_PERMISSION_USAGE` activity-alias).

## Reviewer instructions (if asked)

1. Sign in with the review account; Settings → Health Connect → turn on
   "Connect to your phone's health app" → grant in the Health Connect
   screen.
2. "Copy past readings" sends the account's existing readings.
3. Open the Health Connect app → Data → Blood pressure: entries show
   Leiko as the source.

## Native setup this depends on (do not lose on a prebuild)

`apps/mobile/android` is committed (bare workflow). Two pieces are
hand-written there, not produced by the `react-native-health-connect`
config plugin — re-apply them if `expo prebuild --clean` is ever run:
- `MainActivity.onCreate` → `HealthConnectPermissionDelegate.setPermissionDelegate(this)`
- `AndroidManifest.xml` → `HealthPermissionsRationaleActivity` + the
  `ViewPermissionUsageActivity` alias.
