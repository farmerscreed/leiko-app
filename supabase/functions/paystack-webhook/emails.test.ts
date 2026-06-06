// Deno tests for the /paystack-webhook email builders. Run with:
//   deno test supabase/functions/paystack-webhook/emails.test.ts
//
// Every template's visible text is voice-linted with the shared
// docs/05-voice-and-claims.md pattern set — order emails follow the same
// rules as every other user-visible string.

import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { lintPushText } from '../_shared/voice-lint-push.ts';
import {
  buyerBalanceEmail,
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

// ── Deposit-ladder: Founder Edition CTA + undecided model ──

const COMPLETE_URL = 'https://leiko.health/reserve/complete?ref=LK-TEST-002&e=YW1ha2E';

Deno.test('reservation with completeUrl carries the Founder Edition invitation', () => {
  const { html } = buyerConfirmationEmail({ ...RESERVATION_INPUT, completeUrl: COMPLETE_URL });
  assertStringIncludes(html, 'Founder Edition');
  // The href is HTML-escaped by the builder (& → &amp;).
  assertStringIncludes(html, escapeHtml(COMPLETE_URL));
  assertStringIncludes(html, 'Choose your watch');
  assertStringIncludes(html, 'your deposit already holds your place');
});

Deno.test('reservation without completeUrl has no Founder block', () => {
  const { html } = buyerConfirmationEmail(RESERVATION_INPUT);
  assertEquals(html.includes('Founder Edition'), false);
});

Deno.test('full payment never carries the Founder block', () => {
  const { html } = buyerConfirmationEmail({ ...FULL_INPUT, completeUrl: COMPLETE_URL });
  assertEquals(html.includes('Founder Edition'), false);
});

Deno.test('undecided reservation: terms still present, balance line adapts', () => {
  const { html } = buyerConfirmationEmail({
    ...RESERVATION_INPUT,
    skuName: 'LEIKO Watch — model to be chosen',
    balanceDueNaira: null,
  });
  assertStringIncludes(html, 'counts toward the total');
  assertStringIncludes(html, 'depends on which watch you choose');
  assertStringIncludes(html, 'fully refundable');
});

// ── Balance completion email ──

const BALANCE_INPUT = {
  skuName: 'LEIKO Watch',
  balancePaidNaira: 200_000,
  totalNaira: 250_000,
  reference: 'LK-BAL-001',
  customerName: 'Amaka O.',
  deliveryAddress: '12 Awolowo Rd, Ikoyi, Lagos',
};

Deno.test('balance email: subject + body essentials', () => {
  const mail = buyerBalanceEmail(BALANCE_INPUT);
  assertEquals(mail.subject, 'Your LEIKO order is confirmed');
  assertStringIncludes(mail.html, 'LEIKO Watch');
  assertStringIncludes(mail.html, '₦200,000'); // balance paid
  assertStringIncludes(mail.html, '₦50,000'); // deposit credited
  assertStringIncludes(mail.html, '₦250,000'); // total
  assertStringIncludes(mail.html, 'LK-BAL-001');
  assertStringIncludes(mail.html, '12 Awolowo Rd, Ikoyi, Lagos');
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
  [
    'reservation with founder CTA',
    buyerConfirmationEmail({
      orderType: 'reservation',
      skuName: 'LEIKO Watch — model to be chosen',
      amountPaidNaira: 50_000,
      reference: 'r2',
      customerName: null,
      deliveryAddress: null,
      balanceDueNaira: null,
      completeUrl: 'https://leiko.health/reserve/complete?ref=r2&e=x',
    }).html,
  ],
  [
    'balance confirmation',
    buyerBalanceEmail({
      skuName: 'LEIKO Watch Pro',
      balancePaidNaira: 250_000,
      totalNaira: 300_000,
      reference: 'r3',
      customerName: null,
      deliveryAddress: null,
    }).html,
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
