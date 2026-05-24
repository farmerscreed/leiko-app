// /generate-doctor-pdf — Sprint 9 / D13 §10.2.
//
// POST endpoint. Authenticates the caller, scopes the report to a
// (familyId, userId) the caller is a member of (RLS-enforced via the
// caller's JWT), builds the seven-section HTML template, POSTs it to
// the configured PDF rasterizer, uploads the resulting PDF to Supabase
// Storage, and returns a signed URL.
//
// Environment:
//   SUPABASE_URL                    — local + prod
//   SUPABASE_ANON_KEY              — for caller JWT validation
//   SUPABASE_SERVICE_ROLE_KEY      — bypasses RLS for the data fetch
//                                      (we already validated membership
//                                      above) and for storage uploads
//   PDF_RASTERIZER_URL             — HTML-to-PDF service. Production:
//                                      a hosted service (PDFShift /
//                                      Browserless) or a self-hosted
//                                      Puppeteer endpoint. Local dev:
//                                      `docker run -p 3000:3000 browserless/chrome`
//                                      then PDF_RASTERIZER_URL=
//                                      http://host.docker.internal:3000/pdf
//   PDF_RASTERIZER_TOKEN            — optional bearer token for the
//                                      rasterizer (for hosted services)
//   PDF_REPORTS_BUCKET              — Storage bucket name (default 'reports')
//
// Sprint 9 test seam: when PDF_RASTERIZER_URL === '__MOCK__', the
// function skips the rasterizer round-trip and returns the HTML body
// directly in the response. Lets integration tests assert the seven-
// section structure without depending on a running rasterizer.
//
// Per CLAUDE.md data rule: no PHI in logs. The response carries a
// signed URL + counts only. Errors include codes + non-PHI metadata.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { fetchReportData } from './data.ts';
import { renderReport } from './template.ts';
import {
  buildRasterizerRequest,
  detectRasterizerVendor,
} from './rasterizer.ts';
import type { PdfRequest, Range } from './types.ts';

const VALID_RANGES: Range[] = ['7d', '30d', '90d', '1y'];
const DEFAULT_BUCKET = 'reports';
const PDF_FILENAME_PREFIX = 'leiko_report';

interface SuccessResponse {
  url: string;
  bytes: number;
  /** Filename inside the bucket. */
  storagePath: string;
}

interface MockResponse {
  mode: 'mock';
  htmlBytes: number;
  html: string;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function envOrThrow(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing env ${name}`);
  return value;
}

async function validateAuthenticatedCaller(
  req: Request,
): Promise<{ userId: string }> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('missing_authorization');
  }
  const token = authHeader.slice('Bearer '.length);
  const callerClient = createClient(
    envOrThrow('SUPABASE_URL'),
    envOrThrow('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data, error } = await callerClient.auth.getUser();
  if (error || !data?.user) throw new Error('invalid_jwt');
  return { userId: data.user.id };
}

async function validateMembership(
  supabase: SupabaseClient,
  callerId: string,
  familyId: string,
  targetUserId: string,
): Promise<void> {
  // The caller must be a member of the family. The targetUserId must
  // ALSO be a member (so we don't accidentally generate a PDF for a
  // user who isn't part of the requested family).
  const { data, error } = await supabase
    .from('family_members')
    .select('user_id')
    .eq('family_id', familyId)
    .is('removed_at', null);
  if (error) throw error;
  const memberIds = new Set((data ?? []).map((r) => (r as { user_id: string }).user_id));
  if (!memberIds.has(callerId)) throw new Error('caller_not_in_family');
  if (!memberIds.has(targetUserId)) throw new Error('target_not_in_family');
}

function parseBody(body: unknown): PdfRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('body_required');
  }
  const b = body as Record<string, unknown>;
  if (typeof b.familyId !== 'string') throw new Error('familyId_required');
  if (typeof b.userId !== 'string') throw new Error('userId_required');
  if (typeof b.range !== 'string' || !VALID_RANGES.includes(b.range as Range)) {
    throw new Error('range_invalid');
  }
  return {
    familyId: b.familyId,
    userId: b.userId,
    range: b.range as Range,
    includeNotes: b.includeNotes !== false,
    includeComments: b.includeComments !== false,
    // Sprint 16.5h — opaque cover-note string. Capped at 300 chars on
    // the server side as a defensive guard; the screen also caps it.
    coverNote:
      typeof b.coverNote === 'string' && b.coverNote.trim().length > 0
        ? b.coverNote.slice(0, 300)
        : undefined,
  };
}

/** Sprint 18 / FUN-5 — call generate-doctor-prep-ai with the caller's
 *  JWT so its plus-tier gate + RLS run against the same identity. The
 *  prep-ai function handles paywall (free tier) by returning
 *  `status: paywall_required` — we treat that as "no AI sections,
 *  fall through" rather than a hard error. Any other failure also
 *  cascades to no-AI rendering; the deterministic content always
 *  ships. Per Sprint 16 cascade pattern.
 *
 *  Returns `{ cover: null, observations: null }` on any failure so
 *  the renderReport can branch on presence/absence in one place. */
async function fetchAiSections(
  callerJwt: string,
  range: Range,
): Promise<{ cover: string | null; observations: string | null }> {
  try {
    const supabaseUrl = envOrThrow('SUPABASE_URL');
    const { startDate, endDate } = rangeToDates(range);
    const exportId = crypto.randomUUID();
    const res = await fetch(
      `${supabaseUrl}/functions/v1/generate-doctor-prep-ai`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${callerJwt}`,
        },
        body: JSON.stringify({ exportId, startDate, endDate }),
      },
    );
    if (!res.ok) {
      // 503 = no Anthropic key, 401 = bad jwt, 500 = scrub/internal.
      // Any of these → ship without AI. Log so we can attribute.
      console.warn('generate-doctor-pdf: prep-ai non-ok', res.status);
      return { cover: null, observations: null };
    }
    const payload = (await res.json()) as Record<string, unknown>;
    if (payload.status === 'paywall_required') {
      // Free tier — expected. No telemetry warning.
      return { cover: null, observations: null };
    }
    if (payload.status !== 'ok') {
      console.warn('generate-doctor-pdf: prep-ai status', payload.status);
      return { cover: null, observations: null };
    }
    return {
      cover: typeof payload.cover === 'string' ? payload.cover : null,
      observations:
        typeof payload.observations === 'string' ? payload.observations : null,
    };
  } catch (err) {
    console.warn('generate-doctor-pdf: prep-ai fetch failed', err);
    return { cover: null, observations: null };
  }
}

function rangeToDates(range: Range): { startDate: string; endDate: string } {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date): string => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

async function rasterize(html: string): Promise<Uint8Array> {
  const url = envOrThrow('PDF_RASTERIZER_URL');
  const token = Deno.env.get('PDF_RASTERIZER_TOKEN');
  const vendor = detectRasterizerVendor(url);
  const { headers, body } = buildRasterizerRequest({ vendor, html, token });

  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    // Surface a snippet of the response body when we can — PDFShift
    // returns JSON with a useful error message; Browserless returns
    // plain text. Capped to 200 chars so logs stay tidy.
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      // ignore
    }
    throw new Error(`rasterizer_failed_${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function uploadAndSign(
  supabase: SupabaseClient,
  pdf: Uint8Array,
  request: PdfRequest,
): Promise<SuccessResponse> {
  const bucket = Deno.env.get('PDF_REPORTS_BUCKET') ?? DEFAULT_BUCKET;
  const storagePath = `${request.familyId}/${PDF_FILENAME_PREFIX}_${request.range}_${Date.now()}.pdf`;
  const upload = await supabase.storage
    .from(bucket)
    .upload(storagePath, pdf, {
      contentType: 'application/pdf',
      upsert: false,
    });
  if (upload.error) throw upload.error;
  const signed = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60); // 1 hour TTL
  if (signed.error) throw signed.error;
  return {
    url: signed.data.signedUrl,
    bytes: pdf.byteLength,
    storagePath,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    const { userId: callerId } = await validateAuthenticatedCaller(req);
    const body = parseBody(await req.json().catch(() => null));

    const serviceClient = createClient(
      envOrThrow('SUPABASE_URL'),
      envOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    );

    await validateMembership(serviceClient, callerId, body.familyId, body.userId);

    const data = await fetchReportData(serviceClient, body);

    // Sprint 18 / FUN-5 — run AI prep + PDF rasterize in parallel where
    // possible. The AI call needs the caller's JWT (plus-tier gate runs
    // against their subscription). Result threads into renderReport;
    // both `cover` and `observations` are nullable so the template
    // cascades to deterministic content when AI is unavailable.
    const authHeader = req.headers.get('authorization') ?? '';
    const callerJwt = authHeader.slice('Bearer '.length);
    const aiSections = await fetchAiSections(callerJwt, body.range);

    const enrichedData = {
      ...data,
      coverNote: body.coverNote,
      aiSections,
    };
    const html = renderReport(enrichedData);

    // Sprint 9 test seam — bypass the rasterizer when explicitly mocked.
    const rasterizerUrl = Deno.env.get('PDF_RASTERIZER_URL') ?? '';
    if (rasterizerUrl === '__MOCK__') {
      const mockResp: MockResponse = {
        mode: 'mock',
        htmlBytes: new TextEncoder().encode(html).length,
        html,
      };
      return json(mockResp, 200);
    }

    const pdf = await rasterize(html);
    const result = await uploadAndSign(serviceClient, pdf, body);
    return json(result, 200);
  } catch (e) {
    console.error('generate-doctor-pdf error', e);
    const message = e instanceof Error ? e.message : 'unknown';
    const status = message.includes('not_in_family') || message.includes('jwt') || message.includes('authorization') ? 403 : 500;
    return json({ error: message }, status);
  }
});
