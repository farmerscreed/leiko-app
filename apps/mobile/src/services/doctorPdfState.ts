// services/doctorPdfState — Sprint 16.5h.
//
// MMKV-backed persistence for the "For your doctor" screen:
//   - the user's draft cover note (so it survives nav away + back)
//   - the most recent successful generation (url + timestamp + range +
//     bytes), so the screen can show a "Last generated: 2h ago · Tap
//     to re-share" line without a history view (out of scope per the
//     spec).
//
// Per CLAUDE.md: no `localStorage` / `sessionStorage` — MMKV only.
// Values stay on-device; nothing here syncs to the server.

import { mmkv } from './storage';
import type { DoctorPdfRange } from './doctorPdf';

const NOTE_KEY = 'fyd:coverNote';
const LAST_GENERATED_KEY = 'fyd:lastGenerated';
// Sprint 19 PDF v2 — structured clinical-context fields. Each lives
// in its own MMKV slot so a partial fill doesn't get reset when
// another field is edited. Capped per-field so a runaway paste
// doesn't bloat MMKV.
const MEDICATIONS_KEY = 'fyd:medications';
const SYMPTOMS_KEY = 'fyd:symptoms';
const TARGET_BP_KEY = 'fyd:targetBp';

const MEDICATIONS_CAP = 500;
const SYMPTOMS_CAP = 500;
const TARGET_BP_CAP = 60;

export interface LastGeneratedInfo {
  /** Signed Supabase Storage URL — may be expired by the time the user
   *  taps "re-share". Caller should re-generate on expiry. */
  url: string;
  /** Range the PDF covered. */
  range: DoctorPdfRange;
  /** Unix ms timestamp. */
  generatedAtMs: number;
  /** Bytes of the PDF, when known. */
  bytes: number;
  /** Local cache URI of the downloaded PDF (2026-06-05 file-share fix).
   *  The OS may evict cache files — callers must check existence and
   *  fall back to a fresh generate. Absent on pre-fix records. */
  fileUri?: string;
}

export function readCoverNote(): string {
  return mmkv.getString(NOTE_KEY) ?? '';
}

export function writeCoverNote(value: string): void {
  if (value.length === 0) {
    mmkv.remove(NOTE_KEY);
    return;
  }
  // Cap at 500 chars — the cover-page slot is one line, no need to
  // persist a novel.
  mmkv.set(NOTE_KEY, value.slice(0, 500));
}

export function readLastGenerated(): LastGeneratedInfo | null {
  const raw = mmkv.getString(LAST_GENERATED_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.url === 'string' &&
      typeof parsed?.range === 'string' &&
      typeof parsed?.generatedAtMs === 'number'
    ) {
      return parsed as LastGeneratedInfo;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeLastGenerated(info: LastGeneratedInfo): void {
  mmkv.set(LAST_GENERATED_KEY, JSON.stringify(info));
}

// ── Sprint 19 PDF v2 — clinical-context fields ────────────────────

export function readMedications(): string {
  return mmkv.getString(MEDICATIONS_KEY) ?? '';
}

export function writeMedications(value: string): void {
  if (value.length === 0) {
    mmkv.remove(MEDICATIONS_KEY);
    return;
  }
  mmkv.set(MEDICATIONS_KEY, value.slice(0, MEDICATIONS_CAP));
}

export function readSymptoms(): string {
  return mmkv.getString(SYMPTOMS_KEY) ?? '';
}

export function writeSymptoms(value: string): void {
  if (value.length === 0) {
    mmkv.remove(SYMPTOMS_KEY);
    return;
  }
  mmkv.set(SYMPTOMS_KEY, value.slice(0, SYMPTOMS_CAP));
}

export function readTargetBp(): string {
  return mmkv.getString(TARGET_BP_KEY) ?? '';
}

export function writeTargetBp(value: string): void {
  if (value.length === 0) {
    mmkv.remove(TARGET_BP_KEY);
    return;
  }
  mmkv.set(TARGET_BP_KEY, value.slice(0, TARGET_BP_CAP));
}

/** Format the "Last generated: 2h ago" caption. Pure helper. */
export function formatLastGenerated(
  info: LastGeneratedInfo | null,
  nowMs: number = Date.now(),
): string | null {
  if (!info) return null;
  const ageMs = Math.max(0, nowMs - info.generatedAtMs);
  const m = Math.round(ageMs / 60_000);
  if (m < 1) return 'Last generated · just now';
  if (m < 60) return `Last generated · ${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Last generated · ${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `Last generated · ${d}d ago`;
  return 'Last generated · over a week ago';
}
