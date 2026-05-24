// Rasterizer vendor adapter tests — Sprint 19 Block 10 follow-up.
//
// Run from supabase/functions:
//   deno test --no-check generate-doctor-pdf/rasterizer.test.ts

import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  buildRasterizerRequest,
  detectRasterizerVendor,
} from './rasterizer.ts';

// ── detectRasterizerVendor ────────────────────────────────────────

Deno.test('detectRasterizerVendor — PDFShift hostnames', () => {
  assertEquals(
    detectRasterizerVendor('https://api.pdfshift.io/v3/convert/pdf'),
    'pdfshift',
  );
  assertEquals(
    detectRasterizerVendor('https://API.PDFSHIFT.IO/v3/convert/pdf'),
    'pdfshift',
  );
});

Deno.test('detectRasterizerVendor — Browserless hostnames', () => {
  assertEquals(
    detectRasterizerVendor('https://chrome.browserless.io/pdf'),
    'browserless',
  );
  assertEquals(
    detectRasterizerVendor('https://production-sfo.browserless.io/pdf'),
    'browserless',
  );
});

Deno.test('detectRasterizerVendor — generic / self-hosted falls through', () => {
  assertEquals(
    detectRasterizerVendor('http://host.docker.internal:3000/pdf'),
    'generic',
  );
  assertEquals(
    detectRasterizerVendor('https://my-internal-puppeteer.example.com/render'),
    'generic',
  );
});

// ── buildRasterizerRequest — PDFShift ─────────────────────────────

Deno.test('buildRasterizerRequest pdfshift — legacy api_sk_ key uses Basic auth only', () => {
  const { headers } = buildRasterizerRequest({
    vendor: 'pdfshift',
    html: '<p>hi</p>',
    token: 'api_sk_test123',
  });
  // btoa("api_sk_test123:") = YXBpX3NrX3Rlc3QxMjM6
  assertEquals(headers['Authorization'], 'Basic YXBpX3NrX3Rlc3QxMjM6');
  // Must NOT also send X-API-Key — PDFShift 401s when both headers
  // present (checks Authorization first, fails, never falls through).
  assertEquals(headers['X-API-Key'], undefined);
});

Deno.test('buildRasterizerRequest pdfshift — current sk_ key uses X-API-Key only', () => {
  const { headers } = buildRasterizerRequest({
    vendor: 'pdfshift',
    html: '<p>hi</p>',
    token: 'sk_f6d2569a9a6ee1693420741c4050ff1474d89068',
  });
  assertEquals(headers['X-API-Key'], 'sk_f6d2569a9a6ee1693420741c4050ff1474d89068');
  // Must NOT also send Basic auth — see above.
  assertEquals(headers['Authorization'], undefined);
});

Deno.test('buildRasterizerRequest pdfshift — body uses `source` + top-level fields', () => {
  const { body } = buildRasterizerRequest({
    vendor: 'pdfshift',
    html: '<p>hi</p>',
    token: 'api_sk_x',
  });
  const parsed = JSON.parse(body);
  assertEquals(parsed.source, '<p>hi</p>');
  assertEquals(parsed.format, 'Letter');
  assertEquals(parsed.margin, '18mm');
  assertEquals(parsed.use_print, false);
  assertEquals(parsed.sandbox, false);
  // PDFShift's shape: no nested `options` object.
  assertEquals(parsed.options, undefined);
  // PDFShift's shape: no `html` field at the top level.
  assertEquals(parsed.html, undefined);
});

Deno.test('buildRasterizerRequest pdfshift — token omitted means no auth headers at all', () => {
  const { headers } = buildRasterizerRequest({
    vendor: 'pdfshift',
    html: '<p>hi</p>',
    token: undefined,
  });
  assertEquals(headers['Authorization'], undefined);
  assertEquals(headers['X-API-Key'], undefined);
});

// ── buildRasterizerRequest — Browserless / generic ────────────────

Deno.test('buildRasterizerRequest browserless — uses Bearer auth', () => {
  const { headers } = buildRasterizerRequest({
    vendor: 'browserless',
    html: '<p>hi</p>',
    token: 'sk_browserless_x',
  });
  assertEquals(headers['Authorization'], 'Bearer sk_browserless_x');
});

Deno.test('buildRasterizerRequest browserless — body uses {html, options}', () => {
  const { body } = buildRasterizerRequest({
    vendor: 'browserless',
    html: '<p>hi</p>',
    token: 'x',
  });
  const parsed = JSON.parse(body);
  assertEquals(parsed.html, '<p>hi</p>');
  assertEquals(parsed.options.format, 'Letter');
  assertEquals(parsed.options.printBackground, true);
  assertEquals(parsed.options.margin.top, '18mm');
});

Deno.test('buildRasterizerRequest generic — same shape as browserless (Puppeteer-faithful default)', () => {
  const { headers, body } = buildRasterizerRequest({
    vendor: 'generic',
    html: '<p>hi</p>',
    token: 'tok',
  });
  assertEquals(headers['Authorization'], 'Bearer tok');
  const parsed = JSON.parse(body);
  assertEquals(parsed.html, '<p>hi</p>');
  assertStringIncludes(JSON.stringify(parsed.options), 'Letter');
});
