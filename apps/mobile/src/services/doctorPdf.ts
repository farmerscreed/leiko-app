// services/doctorPdf — Trends v2 follow-up: For Your Doctor screen.
//
// Thin mobile-side client for the `generate-doctor-pdf` Edge Function.
// The function does the heavy lifting (data fetch, HTML render, PDF
// rasterize, storage upload, signed URL). The client's job is to
// fan the user's screen state into a request, classify the response,
// and surface errors as a discriminated union — never throw.
//
// Per CLAUDE.md data rule: PHI never appears in analytics. The
// telemetry events emitted here carry counts + outcomes only.
//
// Note (Trends v2 follow-up): the personal cover-page note field on
// the screen is collected but NOT YET threaded into the Edge Function
// request — the function's `PdfRequest` shape doesn't accept a note
// in v1.0. Wiring lands when the server-side template gains the slot.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from './supabase';
import type { Database } from '../types/database';
import type { TrendsRange } from '../utils/trends-aggregate';

// Server contract — kept in sync with
// supabase/functions/generate-doctor-pdf/types.ts.
export type DoctorPdfRange = '7d' | '30d' | '90d' | '1y';

export const DOCTOR_PDF_RANGES: readonly DoctorPdfRange[] = [
  '7d',
  '30d',
  '90d',
  '1y',
];

export interface GenerateDoctorPdfInput {
  familyId: string;
  userId: string;
  range: DoctorPdfRange;
  includeNotes?: boolean;
  includeComments?: boolean;
}

export interface DoctorPdfOk {
  status: 'ok';
  /** Signed Supabase Storage URL. Pass to the OS share sheet. */
  url: string;
  bytes: number;
  /** Storage path inside the bucket. */
  storagePath: string;
}

export interface DoctorPdfMock {
  status: 'mock';
  htmlBytes: number;
  html: string;
}

export interface DoctorPdfError {
  status: 'error';
  /** Server- or transport-side reason code; not user-facing. */
  reason: string;
  detail?: string;
}

export type DoctorPdfResult = DoctorPdfOk | DoctorPdfMock | DoctorPdfError;

const HARD_CLIENT_TIMEOUT_MS = 30_000;

function timeoutAfter(ms: number): Promise<never> {
  return new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('client_timeout')), ms),
  );
}

/**
 * Map a Trends range to the doctor-PDF range space. `all_time` has
 * no direct PDF analogue — the function only accepts 7d/30d/90d/1y.
 * Per the design brief, range defaults to the carried Trends range
 * when the user arrives via the inline link; falls back to a sane
 * default otherwise.
 */
export function pdfRangeFromTrendsRange(
  range: TrendsRange | null | undefined,
  fallback: DoctorPdfRange = '7d',
): DoctorPdfRange {
  if (range === '7d' || range === '30d' || range === '90d' || range === '1y') {
    return range;
  }
  // 'all_time' isn't a PDF range. Use the fallback (caller decides
  // between '7d' (free) and '30d' (Plus)).
  return fallback;
}

/**
 * Fire the generate-doctor-pdf request. Never throws. The
 * discriminated result tells the caller whether to open the share
 * sheet, fall through to an error state, or render the mock HTML
 * in dev.
 */
export async function generateDoctorPdf(
  input: GenerateDoctorPdfInput,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<DoctorPdfResult> {
  try {
    const res = await Promise.race([
      client.functions.invoke('generate-doctor-pdf', {
        body: {
          familyId: input.familyId,
          userId: input.userId,
          range: input.range,
          includeNotes: input.includeNotes ?? true,
          includeComments: input.includeComments ?? true,
        },
      }),
      timeoutAfter(HARD_CLIENT_TIMEOUT_MS),
    ]);
    if (res.error) {
      return {
        status: 'error',
        reason: 'invoke_failed',
        detail: res.error.message ?? '',
      };
    }
    const data = (res.data ?? {}) as Record<string, unknown>;
    if (typeof data.url === 'string' && typeof data.storagePath === 'string') {
      return {
        status: 'ok',
        url: data.url,
        bytes: typeof data.bytes === 'number' ? data.bytes : 0,
        storagePath: data.storagePath,
      };
    }
    if (data.mode === 'mock' && typeof data.html === 'string') {
      return {
        status: 'mock',
        htmlBytes:
          typeof data.htmlBytes === 'number' ? data.htmlBytes : data.html.length,
        html: data.html,
      };
    }
    return { status: 'error', reason: 'invalid_response' };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'unknown';
    return { status: 'error', reason };
  }
}
