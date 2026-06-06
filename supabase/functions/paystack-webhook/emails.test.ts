// Deno tests for the /paystack-webhook email builders. Run with:
//   deno test supabase/functions/paystack-webhook/emails.test.ts
//
// Every template's visible text is voice-linted with the shared
// docs/05-voice-and-claims.md pattern set — order emails follow the same
// rules as every other user-visible string.

import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { lintPushText } from '../_shared/voice-lint-push.ts';
import {
  buyerConfirmationEmail,
  buyerRefundEmail,
  escapeHtml,
  htmlToText,
  internalAlertEmail,
  type InternalAlertInput,
} from './emails.ts';

const FULL_INPUT = {
  orderType: 'full' as const,
  skuName: 'LEIKO Watch',
  amountPaidNaira: 250_000,
  reference: 'LK-TEST-001',
  customerName: 'Amaka O.',
  deliveryAddress: '12 Awolowo Rd, Ikoyi, Lagos',
  balanceDueNaira: 0,
};

const RESERVATION_INPUT = {
  orderType: 'reservation' as const,
  skuName: 'LEIKO Watch Pro',
  amountPaidNaira: 50_000,
  reference: 'LK-TEST-002',
  customerName: null,
  deliveryAddress: null,
  balanceDueNaira: 250_000,
};

const ALERT_INPUT: InternalAlertInput = {
  orderType: 'full',
  sku: 'u16h',
  skuName: 'LEIKO Watch',
  reference: 'LK-TEST-001',
  status: 'paid',
  amountPaidNaira: 250_000,
  balanceDueNaira: 0,
  customerName: 'Amaka O.',
  email: 'amaka@example.com',
  phone: '+2348012345678',
  deliveryAddress: '12 Awolowo Rd, Ikoyi, Lagos',
  flagged: false,
  flagReason: null,
};

// ── Buyer confirmation: full payment ──

Deno.test('full payment: exact subject per brief', () => {
  assertEquals(buyerConfirmationEmail(FULL_INPUT).subject, 'Your LEIKO order is confirmed');
});

Deno.test('full payment body: product, amount, reference, address, thanks', () => {
  const { html } = buyerConfirmationEmail(FULL_INPUT);
  assertStringIncludes(html, 'LEIKO Watch');
  assertStringIncludes(html, '₦250,000');
  assertStringIncludes(html, 'LK-TEST-001');
  assertStringIncludes(html, '12 Awolowo Rd, Ikoyi, Lagos');
  assertStringIncludes(html, 'thank you');
});

Deno.test('full payment body: no reservation terms', () => {
  const { html } = buyerConfirmationEmail(FULL_INPUT);
  assertEquals(html.includes('deposit'), false);
  assertEquals(html.includes('refundable'), false);
});

// ── Buyer confirmation: reservation ──

Deno.test('reservation: exact subject per brief', () => {
  assertEquals(
    buyerConfirmationEmail(RESERVATION_INPUT).subject,
    'Your LEIKO reservation is confirmed',
  );
});

Deno.test('reservation body: deposit-counts, balance due, refundable-before-ship', () => {
  const { html } = buyerConfirmationEmail(RESERVATION_INPUT);
  assertStringIncludes(html, '₦50,000');
  assertStringIncludes(html, 'counts toward the total');
  assertStringIncludes(html, '₦250,000'); // balance due
  assertStringIncludes(html, 'fully refundable');
  assertStringIncludes(html, 'before your unit ships');
});

Deno.test('null customer name falls back to a neutral greeting', () => {
  const { html } = buyerConfirmationEmail(RESERVATION_INPUT);
  assertStringIncludes(html, 'Hello,');
});

// ── Internal alert ──

Deno.test('internal alert subject per brief', () => {
  assertEquals(
    internalAlertEmail(ALERT_INPUT).subject,
    'New LEIKO full: LEIKO Watch — LK-TEST-001',
  );
});

Deno.test('internal alert body carries all order fields', () => {
  const { html } = internalAlertEmail(ALERT_INPUT);
  for (const expected of [
    'Amaka O.',
    'amaka@example.com',
    '+2348012345678',
    '12 Awolowo Rd, Ikoyi, Lagos',
    'u16h',
    'LEIKO Watch',
    '₦250,000',
    '₦0',
    'paid',
    'LK-TEST-001',
  ]) {
    assertStringIncludes(html, expected);
  }
});

Deno.test('flagged alert subject clearly says FLAGGED — review', () => {
  const flagged = internalAlertEmail({
    ...ALERT_INPUT,
    status: 'flagged',
    flagged: true,
    flagReason: 'amount 100 kobo does not match expected 25000000 kobo for full u16h',
  });
  assertStringIncludes(flagged.subject, 'FLAGGED — review');
  assertStringIncludes(flagged.html, 'needs review');
  assertStringIncludes(flagged.html, 'No buyer confirmation was sent');
});

// ── Refund notice ──

Deno.test('refund email: subject + body essentials', () => {
  const mail = buyerRefundEmail({
    skuName: 'LEIKO Watch Pro',
    reference: 'LK-TEST-002',
    customerName: 'Amaka O.',
  });
  assertEquals(mail.subject, 'Your LEIKO refund is on its way');
  assertStringIncludes(mail.html, 'LEIKO Watch Pro');
  assertStringIncludes(mail.html, 'LK-TEST-002');
  assertStringIncludes(mail.html, 'original payment method');
});

// ── Escaping ──

Deno.test('untrusted fields are HTML-escaped', () => {
  const { html } = buyerConfirmationEmail({
    ...FULL_INPUT,
    customerName: '<script>alert(1)</script>',
    deliveryAddress: 'Flat 2 & 3, "The Mews"',
  });
  assertEquals(html.includes('<script>'), false);
  assertStringIncludes(html, '&lt;script&gt;');
  assertStringIncludes(html, '&amp;');
  assertStringIncludes(html, '&quot;The Mews&quot;');
});

Deno.test('escapeHtml covers the five specials', () => {
  assertEquals(escapeHtml(`<a href="x" id='y'>&</a>`), '&lt;a href=&quot;x&quot; id=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
});

// ── Voice rules: every template passes docs/05 hard patterns ──

const ALL_TEMPLATES: Array<[string, string]> = [
  ['buyer full', buyerConfirmationEmail(FULL_INPUT).html],
  ['buyer full subject', buyerConfirmationEmail(FULL_INPUT).subject],
  ['buyer reservation', buyerConfirmationEmail(RESERVATION_INPUT).html],
  ['buyer reservation subject', buyerConfirmationEmail(RESERVATION_INPUT).subject],
  ['internal alert', internalAlertEmail(ALERT_INPUT).html],
  [
    'flagged alert',
    internalAlertEmail({ ...ALERT_INPUT, flagged: true, flagReason: 'amount mismatch' }).html,
  ],
  [
    'refund',
    buyerRefundEmail({ skuName: 'LEIKO Watch', reference: 'r', customerName: null }).html,
  ],
];

for (const [label, html] of ALL_TEMPLATES) {
  Deno.test(`voice lint passes: ${label}`, () => {
    const result = lintPushText(htmlToText(html));
    assertEquals(
      result.hardHits.map((h) => h.match),
      [],
      `voice hard-fail in ${label}`,
    );
  });
}

// ── Claims guard: no regulatory language in any template ──

for (const [label, html] of ALL_TEMPLATES) {
  Deno.test(`no regulatory claims: ${label}`, () => {
    const text = htmlToText(html).toLowerCase();
    for (const banned of ['fda', 'cleared', 'approved', 'registered', 'mdr', 'class ii']) {
      assertEquals(text.includes(banned), false, `"${banned}" found in ${label}`);
    }
  });
}
