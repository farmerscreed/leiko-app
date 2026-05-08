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
  };
}

async function rasterize(html: string): Promise<Uint8Array> {
  const url = envOrThrow('PDF_RASTERIZER_URL');
  const token = Deno.env.get('PDF_RASTERIZER_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // POST shape mirrors Browserless's /pdf endpoint and PDFShift's API:
  // both accept { html: "..." } and respond with the PDF bytes.
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      html,
      options: {
        format: 'Letter',
        printBackground: true,
        margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`rasterizer_failed_${res.status}`);
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
    const html = renderReport(data);

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
