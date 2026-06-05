# ADR-0009: Doctor report delivery — in-app preview, file share, download to phone

- **Status**: Accepted (founder-approved and device-verified during the 2026-06-05 physical-testing session)
- **Date**: 2026-06-05
- **Sprint**: ad-hoc, found during Stage 6 of `plans/PHYSICAL_TEST_PLAN_2026-06-03.md`
- **Amends**: the Sprint 16.5h share flow (`ForYourDoctorScreen` URL share); `docs/00-tech-stack.md` (four new pins)
- **Touches**: `services/doctorPdfFile.ts` (new), `screens/PdfPreview/` (new), `ForYourDoctorScreen`, `doctorPdfState`, navigation (both stacks)

## Context

The "For your doctor" flow generated the PDF server-side, uploaded it to
Storage, and handed the **signed URL as text** to `Share.share()`. Two
defects, surfaced the moment the founder physically tested it:

1. Recipients got a **link, not a document** — WhatsApp/Mail showed a URL
   to tap, not an attached report.
2. The signature **expires after 1 hour** (`createSignedUrl(path, 3600)`),
   so the link was usually dead by the time a doctor opened it. For the
   product's core hand-to-your-doctor moment, that is a broken promise.

There was also no way to *see* the generated report in the app, and no
way to keep a copy on the phone.

## Decision

1. **Download-then-deliver.** After generation the app downloads the PDF
   into its cache (`expo-file-system` v19, `File.downloadFileAsync` →
   `Paths.cache`) and all delivery paths operate on the **local file**.
   The signed URL is only an internal transfer step. Legacy URL-share
   remains solely as the fallback when the download itself fails.
2. **The document opens, not a sheet.** Generation lands on the new
   **PdfPreview** screen (`react-native-pdf`): the report renders in-app
   with page indicator, Back, Share, and Download. "Last generated ·
   re-share" re-opens the cached file; if the cache was evicted (or the
   URL expired) it falls back to a fresh generation.
3. **Share = the file.** `expo-sharing.shareAsync(uri, application/pdf)` —
   recipients receive the actual PDF (device-verified: WhatsApp attached
   and delivered "7 pages · 273 kB · PDF", byte-identical to cache).
4. **Download to phone.** Android copies the cached file into the public
   **Downloads** collection via the MediaStore
   (`react-native-blob-util.MediaCollection.copyToMediaStore` —
   scoped-storage compliant, no permission prompt; device-verified in
   `/sdcard/Download`). iOS routes to the share sheet, whose "Save to
   Files" is that platform's download. blob-util is **lazy-imported**
   inside the Android save path only (a top-level import registers a
   NativeEventEmitter that crashes jest and would load needlessly on iOS).

## New stack pins (founder-approved 2026-06-05)

| Package | Version | Why |
|---|---|---|
| expo-file-system | 19.0.x | download-to-cache (new `File`/`Paths` API) |
| expo-sharing | 14.0.x | share local file URIs with mime type |
| react-native-pdf | 7.0.x | in-app PDF rendering (PdfPreview) |
| react-native-blob-util | 0.24.x | react-native-pdf peer + MediaStore download |

**Native consequence:** these are native modules — any dev client or
release APK built before 2026-06-05 must be rebuilt (`expo run:android` /
the release pipeline) to contain them.

## Consequences

- `LastGeneratedInfo` persists `fileUri` alongside the URL; cache
  eviction is handled (existence check → regenerate).
- The share/download UX no longer depends on the URL TTL at all; the TTL
  can stay at 1 hour.
- Voice-checked copy: "Download to phone", "Saved to your phone's
  Downloads folder.", "Couldn't save just now — Share works as a backup."
- Tests: service (download/share/save incl. failure paths, MediaStore
  arguments) + PdfPreview screen states. Suite at 208/2468 green.
- Follow-up candidates (not committed): share/download for the caregiver
  path's reports, iOS-side verification once an iOS build exists.
