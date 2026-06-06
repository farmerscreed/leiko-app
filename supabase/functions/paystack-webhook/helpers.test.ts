// Deno tests for the pure /paystack-webhook helpers. Run with:
//   deno test supabase/functions/paystack-webhook/helpers.test.ts
//
// index.ts is not imported (it calls Deno.serve at module load); the
// HTTP handler is exercised via Paystack test mode per the operator
// runbook's acceptance walkthrough.

import { assertEquals } from 'jsr:@std/assert@1';
import {
  balanceDueNaira,
  constantTimeEqual,
  expectedAmountKobo,
  extractCustomField,
  formatNaira,
  hmacSha512Hex,
  koboToNaira,
  validateTransaction,
  verifyPaystackSignature,
} from './helpers.ts';

// ── HMAC-SHA512 — RFC 4231 test case 2 (known vector) ──

const RFC4231_KEY = 'Jefe';
const RFC4231_DATA = 'what do ya want for nothing?';
const RFC4231_HMAC =
  '164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea250554' +
  '9758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737';

Deno.test('hmacSha512Hex matches RFC 4231 test case 2', async () => {
  assertEquals(await hmacSha512Hex(RFC4231_KEY, RFC4231_DATA), RFC4231_HMAC);
});

Deno.test('verifyPaystackSignature accepts the correct signature', async () => {
  assertEquals(
    await verifyPaystackSignature(RFC4231_DATA, RFC4231_HMAC, RFC4231_KEY),
    true,
  );
});

Deno.test('verifyPaystackSignature accepts an uppercase signature header', async () => {
  assertEquals(
    await verifyPaystackSignature(RFC4231_DATA, RFC4231_HMAC.toUpperCase(), RFC4231_KEY),
    true,
  );
});

Deno.test('verifyPaystackSignature rejects a tampered body', async () => {
  assertEquals(
    await verifyPaystackSignature(RFC4231_DATA + ' ', RFC4231_HMAC, RFC4231_KEY),
    false,
  );
});

Deno.test('verifyPaystackSignature rejects a tampered signature', async () => {
  const tampered = (RFC4231_HMAC[0] === 'a' ? 'b' : 'a') + RFC4231_HMAC.slice(1);
  assertEquals(await verifyPaystackSignature(RFC4231_DATA, tampered, RFC4231_KEY), false);
});

Deno.test('verifyPaystackSignature rejects a missing header', async () => {
  assertEquals(await verifyPaystackSignature(RFC4231_DATA, null, RFC4231_KEY), false);
});

// ── constantTimeEqual ──

Deno.test('constantTimeEqual: equal, unequal, different length', () => {
  assertEquals(constantTimeEqual('abc123', 'abc123'), true);
  assertEquals(constantTimeEqual('abc123', 'abc124'), false);
  assertEquals(constantTimeEqual('abc123', 'abc12'), false);
  assertEquals(constantTimeEqual('', ''), true);
});

// ── Amount rules (the money matrix) ──

Deno.test('expectedAmountKobo: full u16h → ₦250,000', () => {
  assertEquals(expectedAmountKobo('full', 'u16h'), 25_000_000);
});

Deno.test('expectedAmountKobo: full u19m → ₦300,000', () => {
  assertEquals(expectedAmountKobo('full', 'u19m'), 30_000_000);
});

Deno.test('expectedAmountKobo: reservation → ₦50,000 for either SKU', () => {
  assertEquals(expectedAmountKobo('reservation', 'u16h'), 5_000_000);
  assertEquals(expectedAmountKobo('reservation', 'u19m'), 5_000_000);
});

Deno.test('expectedAmountKobo: balance → price minus ₦50,000 deposit', () => {
  assertEquals(expectedAmountKobo('balance', 'u16h'), 20_000_000); // ₦200,000
  assertEquals(expectedAmountKobo('balance', 'u19m'), 25_000_000); // ₦250,000
});

Deno.test('expectedAmountKobo: balance with unknown sku → null', () => {
  assertEquals(expectedAmountKobo('balance', 'undecided'), null);
  assertEquals(expectedAmountKobo('balance', 'u99x'), null);
});

Deno.test('expectedAmountKobo: reservation passes with undecided sku', () => {
  assertEquals(expectedAmountKobo('reservation', 'undecided'), 5_000_000);
});

Deno.test('expectedAmountKobo: unknown combinations → null', () => {
  assertEquals(expectedAmountKobo('full', 'u99x'), null);
  assertEquals(expectedAmountKobo('subscription', 'u16h'), null);
  assertEquals(expectedAmountKobo('unknown', 'unknown'), null);
});

Deno.test('balanceDueNaira: full → 0, reservation → price minus deposit', () => {
  assertEquals(balanceDueNaira('full', 'u16h'), 0);
  assertEquals(balanceDueNaira('full', 'u19m'), 0);
  assertEquals(balanceDueNaira('reservation', 'u16h'), 200_000);
  assertEquals(balanceDueNaira('reservation', 'u19m'), 250_000);
  assertEquals(balanceDueNaira('reservation', 'u99x'), null);
  assertEquals(balanceDueNaira('unknown', 'u16h'), null);
});

// ── validateTransaction ──

const GOOD = {
  status: 'success',
  currency: 'NGN',
  amountKobo: 25_000_000,
  orderType: 'full',
  sku: 'u16h',
};

Deno.test('validateTransaction: clean full payment passes', () => {
  assertEquals(validateTransaction(GOOD).ok, true);
});

Deno.test('validateTransaction: clean reservation passes', () => {
  assertEquals(
    validateTransaction({
      ...GOOD,
      orderType: 'reservation',
      amountKobo: 5_000_000,
    }).ok,
    true,
  );
});

Deno.test('validateTransaction: non-success status fails', () => {
  const r = validateTransaction({ ...GOOD, status: 'failed' });
  assertEquals(r.ok, false);
  assertEquals(r.reason?.includes('status'), true);
});

Deno.test('validateTransaction: wrong currency fails', () => {
  const r = validateTransaction({ ...GOOD, currency: 'USD' });
  assertEquals(r.ok, false);
  assertEquals(r.reason?.includes('currency'), true);
});

Deno.test('validateTransaction: wrong amount fails', () => {
  const r = validateTransaction({ ...GOOD, amountKobo: 24_999_900 });
  assertEquals(r.ok, false);
  assertEquals(r.reason?.includes('amount'), true);
});

Deno.test('validateTransaction: undefined amount fails', () => {
  const r = validateTransaction({ ...GOOD, amountKobo: undefined });
  assertEquals(r.ok, false);
});

Deno.test('validateTransaction: unknown sku fails', () => {
  const r = validateTransaction({ ...GOOD, sku: 'u99x' });
  assertEquals(r.ok, false);
  assertEquals(r.reason?.includes('unrecognized'), true);
});

Deno.test('validateTransaction: clean balance payment passes', () => {
  assertEquals(
    validateTransaction({ ...GOOD, orderType: 'balance', amountKobo: 20_000_000 }).ok,
    true,
  );
  assertEquals(
    validateTransaction({ ...GOOD, orderType: 'balance', sku: 'u19m', amountKobo: 25_000_000 }).ok,
    true,
  );
});

Deno.test('validateTransaction: balance with deposit-sized amount fails', () => {
  const r = validateTransaction({ ...GOOD, orderType: 'balance', amountKobo: 5_000_000 });
  assertEquals(r.ok, false);
  assertEquals(r.reason?.includes('amount'), true);
});

Deno.test('validateTransaction: balance with undecided sku fails', () => {
  const r = validateTransaction({
    ...GOOD,
    orderType: 'balance',
    sku: 'undecided',
    amountKobo: 20_000_000,
  });
  assertEquals(r.ok, false);
  assertEquals(r.reason?.includes('unrecognized'), true);
});

// ── Formatting ──

Deno.test('formatNaira groups thousands', () => {
  assertEquals(formatNaira(250_000), '₦250,000');
  assertEquals(formatNaira(50_000), '₦50,000');
  assertEquals(formatNaira(1_000_000), '₦1,000,000');
  assertEquals(formatNaira(0), '₦0');
  assertEquals(formatNaira(999), '₦999');
});

Deno.test('koboToNaira', () => {
  assertEquals(koboToNaira(25_000_000), 250_000);
  assertEquals(koboToNaira(5_000_000), 50_000);
});

// ── extractCustomField ──

const METADATA = {
  order_type: 'reservation',
  sku: 'u16h',
  custom_fields: [
    { display_name: 'Full Name', variable_name: 'full_name', value: 'Amaka O.' },
    { display_name: 'Phone', variable_name: 'phone', value: '+2348012345678' },
    {
      display_name: 'Delivery Address',
      variable_name: 'delivery_address',
      value: '12 Awolowo Rd, Ikoyi, Lagos',
    },
  ],
};

Deno.test('extractCustomField finds by variable_name', () => {
  assertEquals(extractCustomField(METADATA, ['full_name', 'name']), 'Amaka O.');
  assertEquals(extractCustomField(METADATA, ['phone', 'phone_number']), '+2348012345678');
  assertEquals(
    extractCustomField(METADATA, ['delivery_address', 'address']),
    '12 Awolowo Rd, Ikoyi, Lagos',
  );
});

Deno.test('extractCustomField falls back to display_name match', () => {
  const md = {
    custom_fields: [{ display_name: 'Delivery Address', variable_name: 'field_3', value: 'X' }],
  };
  assertEquals(extractCustomField(md, ['delivery_address', 'address']), 'X');
});

Deno.test('extractCustomField prefers exact match over substring', () => {
  const md = {
    custom_fields: [
      { display_name: 'Name and phone', variable_name: 'name_and_phone', value: 'wrong' },
      { display_name: 'Phone', variable_name: 'phone', value: 'right' },
    ],
  };
  assertEquals(extractCustomField(md, ['phone']), 'right');
});

Deno.test('extractCustomField handles missing/empty metadata', () => {
  assertEquals(extractCustomField(null, ['phone']), null);
  assertEquals(extractCustomField({}, ['phone']), null);
  assertEquals(extractCustomField({ custom_fields: 'nope' } as never, ['phone']), null);
  assertEquals(
    extractCustomField({ custom_fields: [{ variable_name: 'phone', value: '  ' }] }, ['phone']),
    null,
  );
});
