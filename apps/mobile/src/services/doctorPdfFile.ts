// services/doctorPdfFile — download the generated doctor PDF to local
// cache and share the FILE, not the link (founder direction, 2026-06-05
// physical testing).
//
// Why: the screen used to Share.share() the signed Storage URL as TEXT —
// the doctor received a link instead of a document, and the signature
// expires after 1 hour (generate-doctor-pdf signs with a 3600s TTL), so
// the link died before most doctors would open it. Downloading to cache
// and sharing the local file attaches the actual PDF (no expiry, opens
// inline) and powers the in-app PdfPreview screen.
//
// Files land in Paths.cache — the OS may evict them; callers fall back
// to re-download (fresh generation) when the cached file is gone.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { DoctorPdfRange } from './doctorPdf';

/** Cache filename — unique per generation so re-generations never
 *  collide with a file the share sheet may still be reading. */
export function doctorPdfFileName(
  range: DoctorPdfRange,
  nowMs: number = Date.now(),
): string {
  return `leiko_report_${range}_${nowMs}.pdf`;
}

export type DownloadPdfResult =
  | { status: 'ok'; uri: string }
  | { status: 'error'; reason: string };

/** Download the signed-URL PDF into the app cache. Never throws. */
export async function downloadDoctorPdf(
  url: string,
  range: DoctorPdfRange,
): Promise<DownloadPdfResult> {
  try {
    const destination = new File(Paths.cache, doctorPdfFileName(range));
    const file = await File.downloadFileAsync(url, destination);
    return { status: 'ok', uri: file.uri };
  } catch (e) {
    return {
      status: 'error',
      reason: e instanceof Error ? e.message : 'download_failed',
    };
  }
}

/** Does a previously-downloaded report still exist in cache? */
export function pdfFileExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/**
 * Open the OS share sheet with the local PDF file. Returns false when
 * file-sharing isn't available on the platform (caller falls back to the
 * legacy URL share). User dismissing the sheet is not an error.
 */
export async function sharePdfFile(uri: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share your Leiko report',
    UTI: 'com.adobe.pdf',
  });
  return true;
}
