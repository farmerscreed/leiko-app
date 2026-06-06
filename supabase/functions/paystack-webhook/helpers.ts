// Pure helpers for /paystack-webhook — no I/O, no Deno.serve.
// Colocated tests: helpers.test.ts (run with `deno test`).
//
// Price source of truth (2026-06-06 finance kickoff, NGN-only phase):
//   full + u16h (LEIKO Watch)     → ₦250,000 = 25,000,000 kobo
//   full + u19m (LEIKO Watch Pro) → ₦300,000 = 30,000,000 kobo
//   reservation (either SKU)      → ₦50,000  =  5,000,000 kobo
// USD/Stripe is a later phase; this module is NGN/Paystack only.

export const PRICE_NAIRA: Record<string, number> = {
  u16h: 250_000, // LEIKO Watch
  u19m: 300_000, // LEIKO Watch Pro
};

export const DEPOSIT_NAIRA = 50_000;

export const SKU_NAMES: Record<string, string> = {
  u16h: 'LEIKO Watch',
  u19m: 'LEIKO Watch Pro',
};

/**
 * Expected charge amount in kobo for an order_type + sku combination,
 * or null when the combination isn't recognized (→ flagged).
 */
export function expectedAmountKobo(orderType: string, sku: string): number | null {
  if (orderType === 'full') {
    const price = PRICE_NAIRA[sku];
    return price ? price * 100 : null;
  }
  if (orderType === 'reservation') {
    return DEPOSIT_NAIRA * 100;
  }
  return null;
}

/**
 * Balance still owed at ship, in naira. 0 for full payments; price minus
 * deposit for reservations; null when the sku isn't recognized.
 */
export function balanceDueNaira(orderType: string, sku: string): number | null {
  if (orderType === 'full') return 0;
  if (orderType === 'reservation') {
    const price = PRICE_NAIRA[sku];
    return price ? price - DEPOSIT_NAIRA : null;
  }
  return null;
}

/** HMAC-SHA512 of `payload` keyed by `secret`, hex-encoded lowercase. */
export async function hmacSha512Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison. Length mismatch returns false
 * immediately — digest length is public knowledge, not a secret.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/**
 * True when `signatureHeader` is the HMAC-SHA512 hex of the RAW request
 * body keyed by the Paystack secret key. The caller must pass the body
 * exactly as received — re-serializing parsed JSON breaks the HMAC.
 */
export async function verifyPaystackSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const expected = await hmacSha512Hex(secret, rawBody);
  return constantTimeEqual(expected, signatureHeader.toLowerCase());
}

export interface TransactionCheck {
  ok: boolean;
  reason?: string;
}

/**
 * The mandatory post-verify validation: status, currency, and the exact
 * kobo amount for the claimed order_type + sku. Any failure → the order
 * is saved as 'flagged' and the buyer confirmation is withheld.
 */
export function validateTransaction(input: {
  status: string | undefined;
  currency: string | undefined;
  amountKobo: number | undefined;
  orderType: string;
  sku: string;
}): TransactionCheck {
  if (input.status !== 'success') {
    return { ok: false, reason: `verify status is "${input.status}", expected "success"` };
  }
  if (input.currency !== 'NGN') {
    return { ok: false, reason: `currency is "${input.currency}", expected "NGN"` };
  }
  const expected = expectedAmountKobo(input.orderType, input.sku);
  if (expected == null) {
    return {
      ok: false,
      reason: `unrecognized order_type/sku: "${input.orderType}" / "${input.sku}"`,
    };
  }
  if (input.amountKobo !== expected) {
    return {
      ok: false,
      reason:
        `amount ${input.amountKobo} kobo does not match expected ${expected} kobo ` +
        `for ${input.orderType} ${input.sku}`,
    };
  }
  return { ok: true };
}

/** "₦250,000" — deterministic manual grouping, no locale dependency. */
export function formatNaira(naira: number): string {
  const sign = naira < 0 ? '-' : '';
  const grouped = Math.round(Math.abs(naira))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}₦${grouped}`;
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

/**
 * Pulls a value out of Paystack metadata.custom_fields (array of
 * { display_name, variable_name, value }). Candidates are normalized
 * snake_case keys, matched against both variable_name and display_name,
 * exact match first, then substring.
 */
export function extractCustomField(
  metadata: Record<string, unknown> | null | undefined,
  candidates: string[],
): string | null {
  const fields = (metadata as { custom_fields?: unknown })?.custom_fields;
  if (!Array.isArray(fields)) return null;
  const norm = (s: unknown) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  const value = (f: Record<string, unknown>): string | null => {
    const v = f?.value;
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };
  // Exact matches across all candidates first, then substring fallbacks —
  // prevents "phone" substring-matching a "full_name_and_phone" style field
  // before an exact "phone" field is considered.
  for (const c of candidates) {
    for (const f of fields as Record<string, unknown>[]) {
      if (norm(f?.variable_name) === c || norm(f?.display_name) === c) {
        const v = value(f);
        if (v) return v;
      }
    }
  }
  for (const c of candidates) {
    for (const f of fields as Record<string, unknown>[]) {
      if (norm(f?.variable_name).includes(c) || norm(f?.display_name).includes(c)) {
        const v = value(f);
        if (v) return v;
      }
    }
  }
  return null;
}
