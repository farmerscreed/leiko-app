// Rasterizer vendor adapter — Sprint 19 Block 10 follow-up.
//
// Two hosted Puppeteer-compatible services have different auth schemes
// AND different request body shapes:
//   PDFShift     X-API-Key header (sk_xxx)        { source, format, ... }
//   Browserless  Bearer auth                       { html, options: {...} }
//
// PDFShift auth history (2026-05-24 incident):
//   The legacy `api_sk_*` keys used HTTP Basic auth (key as username,
//   empty password). The current `sk_*` keys (issued from the v3
//   dashboard) require `X-API-Key` header. Empirically PDFShift
//   short-circuits on the FIRST auth header it sees — if you send
//   both, the wrong one is checked first and the whole request 401s
//   even when the right header is also present. So we pick exactly
//   one based on key prefix.
//
// We auto-detect by URL hostname so the same Edge Function works with
// either vendor. Self-hosted or generic Puppeteer endpoints get the
// Browserless shape by default (it's the closer fit to a raw Puppeteer
// `page.pdf()` call).

export type RasterizerVendor = 'pdfshift' | 'browserless' | 'generic';

export function detectRasterizerVendor(url: string): RasterizerVendor {
  const lower = url.toLowerCase();
  if (lower.includes('pdfshift.io')) return 'pdfshift';
  if (lower.includes('browserless') || lower.includes('chrome.browserless')) {
    return 'browserless';
  }
  return 'generic';
}

export interface BuildRasterizerRequestArgs {
  vendor: RasterizerVendor;
  html: string;
  token: string | undefined;
}

export interface BuildRasterizerRequestResult {
  headers: Record<string, string>;
  body: string;
}

export function buildRasterizerRequest(
  args: BuildRasterizerRequestArgs,
): BuildRasterizerRequestResult {
  const { vendor, html, token } = args;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: string;

  if (vendor === 'pdfshift') {
    // PDFShift v3 API:
    //   - Auth: pick ONE header by key prefix. `api_sk_*` (legacy) →
    //     HTTP Basic. Everything else (current `sk_*` keys + any
    //     future format) → X-API-Key. Sending both 401s the request
    //     because PDFShift checks Authorization first and never
    //     falls through.
    //   - Body: top-level fields. NOT a nested options object.
    //   Reference: https://docs.pdfshift.io/
    if (token) {
      if (token.startsWith('api_sk_')) {
        headers['Authorization'] = `Basic ${btoa(`${token}:`)}`;
      } else {
        headers['X-API-Key'] = token;
      }
    }
    body = JSON.stringify({
      source: html,
      format: 'Letter',
      margin: '18mm',
      // Keep CSS backgrounds visible (chart cards, distribution bar,
      // section accents). PDFShift's default `use_print: false` opts
      // out of @media print squashing colours.
      use_print: false,
      sandbox: false,
    });
  } else {
    // Browserless `/pdf` + generic Puppeteer-faithful services.
    if (token) headers['Authorization'] = `Bearer ${token}`;
    body = JSON.stringify({
      html,
      options: {
        format: 'Letter',
        printBackground: true,
        margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' },
      },
    });
  }

  return { headers, body };
}
