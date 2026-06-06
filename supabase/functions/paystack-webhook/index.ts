// /paystack-webhook — Finance Sprint, Paystack phase (2026-06-06).
//
// The source of truth for LEIKO web payments. The leiko.health frontend
// collects payment with Paystack Inline v2, but its onSuccess callback is
// NOT trusted — no order exists until this function has:
//
//   1. Verified the x-paystack-signature header: HMAC-SHA512 of the RAW
//      request body keyed by PAYSTACK_SECRET_KEY, constant-time compare.
//      Mismatch → 401, nothing else happens.
//   2. Parsed the event. Only charge.success is processed
//      (refund.processed gets a minimal status-update path; everything
//      else → 200 ignored so Paystack stops retrying).
//   3. Independently re-verified the transaction via
//      GET /transaction/verify/{reference} — the webhook payload's
//      amount/status are never trusted on their own.
//   4. Validated status === success, currency === NGN, and the exact
//      kobo amount for the claimed order_type + sku (helpers.ts).
//      Any mismatch → row saved with status='flagged', internal alert
//      only, no buyer confirmation, 200.
//   5. Inserted into public.orders idempotently (UNIQUE paystack_reference,
//      ignoreDuplicates) — duplicate webhook delivery → 200, no second
//      row, no second email.
//   6. Sent buyer confirmation + internal alert via Resend. Email is
//      secondary to the order record: a failed send is logged and the
//      function still returns 200. A verified order is never lost or
//      rolled back because Resend hiccuped.
//
// Response codes:
//   401 — signature verification failed (the only "genuine" rejection).
//   503 — secrets not configured, or the Paystack verify API was
//         unreachable/5xx. Deliberate deviation from "non-200 only for
//         bad signatures": a transient verify outage must trigger a
//         Paystack retry, otherwise the order is lost forever.
//   500 — orders insert failed (DB hiccup → let Paystack retry).
//   200 — everything else, including ignored events, flagged orders,
//         duplicates, and email failures.
//
// Secrets (Deno.env, never logged, never echoed):
//   PAYSTACK_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   RESEND_API_KEY, RESEND_FROM_EMAIL, ORDER_ALERT_EMAIL.
//
// Logs carry the reference + an error code only — no amounts, no
// customer fields, no secrets.
//
// Deploy with verify_jwt = false (Paystack sends no Supabase JWT) —
// pinned in supabase/config.toml and required on every deploy.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  balanceDueNaira,
  extractCustomField,
  koboToNaira,
  PRICE_NAIRA,
  SKU_NAMES,
  validateTransaction,
  verifyPaystackSignature,
} from './helpers.ts';
import {
  buyerBalanceEmail,
  buyerConfirmationEmail,
  buyerRefundEmail,
  internalAlertEmail,
} from './emails.ts';

// Where /reserve/complete lives. Override per environment if the site
// ever moves; never carries secrets.
const SITE_BASE_URL = Deno.env.get('SITE_BASE_URL') ?? 'https://leiko.health';

function buildCompleteUrl(reference: string, email: string): string {
  // e is a urlsafe-base64 of the buyer email; /api/reservation requires
  // ref AND matching email so a bare reference can't be replayed to
  // read someone else's name.
  const e = btoa(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${SITE_BASE_URL}/reserve/complete?ref=${encodeURIComponent(reference)}&e=${e}`;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (!paystackSecret) {
    // Fail closed — processing events without signature verification
    // would let anyone who knows the URL fabricate paid orders.
    console.error('[paystack-webhook] secret_not_configured');
    return json({ error: 'webhook_not_configured' }, 503);
  }

  // RAW body first — the HMAC is computed over the bytes Paystack sent.
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');
  const signatureOk = await verifyPaystackSignature(rawBody, signature, paystackSecret);
  if (!signatureOk) {
    return json({ error: 'invalid_signature' }, 401);
  }

  // Only after the signature passes do we parse.
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Signed but unparseable — don't invite a retry storm.
    console.error('[paystack-webhook] signed_body_not_json');
    return json({ ok: true, ignored: 'invalid_json' }, 200);
  }

  const event: string = typeof payload?.event === 'string' ? payload.event : '';

  if (event === 'refund.processed') {
    return await handleRefundProcessed(payload);
  }
  if (event !== 'charge.success') {
    return json({ ok: true, ignored: event || 'unknown_event' }, 200);
  }

  const reference: string | undefined = payload?.data?.reference;
  if (!reference || typeof reference !== 'string') {
    console.error('[paystack-webhook] charge_success_without_reference');
    return json({ ok: true, ignored: 'missing_reference' }, 200);
  }

  // ── Independent verification — never trust the webhook payload alone ──
  let verifyData: any;
  try {
    const resp = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecret}` } },
    );
    if (!resp.ok) {
      console.error(`[paystack-webhook] verify_api_http_${resp.status} ref=${reference}`);
      // Transient verify failure → non-200 so Paystack redelivers later.
      return json({ error: 'verify_unavailable' }, 503);
    }
    const verifyJson = await resp.json();
    if (verifyJson?.status !== true || !verifyJson?.data) {
      console.error(`[paystack-webhook] verify_api_rejected ref=${reference}`);
      return json({ error: 'verify_unavailable' }, 503);
    }
    verifyData = verifyJson.data;
  } catch (e) {
    console.error(`[paystack-webhook] verify_api_error ref=${reference}`, (e as Error)?.message);
    return json({ error: 'verify_unavailable' }, 503);
  }

  const metadata: Record<string, unknown> =
    (verifyData?.metadata && typeof verifyData.metadata === 'object'
      ? verifyData.metadata
      : payload?.data?.metadata) ?? {};

  const orderType = String((metadata as any)?.order_type ?? 'unknown');
  const sku = String((metadata as any)?.sku ?? 'unknown');
  const skuName: string | null =
    typeof (metadata as any)?.sku_name === 'string' && (metadata as any).sku_name.trim()
      ? (metadata as any).sku_name.trim()
      : SKU_NAMES[sku] ?? null;

  // Deposit-ladder step 2: a balance payment completes an existing
  // reservation instead of creating a new order.
  if (orderType === 'balance') {
    return await handleBalancePayment({ verifyData, metadata, reference });
  }

  const check = validateTransaction({
    status: verifyData?.status,
    currency: verifyData?.currency,
    amountKobo: typeof verifyData?.amount === 'number' ? verifyData.amount : undefined,
    orderType,
    sku,
  });

  const buyerEmail: string =
    (typeof verifyData?.customer?.email === 'string' && verifyData.customer.email) ||
    (typeof payload?.data?.customer?.email === 'string' && payload.data.customer.email) ||
    extractCustomField(metadata, ['email', 'email_address']) ||
    '';

  const customerName = extractCustomField(metadata, ['full_name', 'name', 'customer_name']);
  const customerPhone = extractCustomField(metadata, ['phone', 'phone_number', 'mobile']);
  const deliveryAddress = extractCustomField(metadata, [
    'delivery_address',
    'address',
    'shipping_address',
  ]);

  const amountKobo: number = typeof verifyData?.amount === 'number' ? verifyData.amount : 0;
  const status = check.ok ? (orderType === 'reservation' ? 'reserved' : 'paid') : 'flagged';
  const balanceDue = check.ok ? balanceDueNaira(orderType, sku) : null;

  const row = {
    paystack_reference: reference,
    email: buyerEmail,
    sku,
    sku_name: skuName,
    order_type: orderType,
    amount_paid_kobo: amountKobo,
    full_price_naira: PRICE_NAIRA[sku] ?? null,
    balance_due_naira: balanceDue,
    refundable: check.ok && orderType === 'reservation',
    customer_name: customerName,
    customer_phone: customerPhone,
    delivery_address: deliveryAddress,
    status,
    raw_metadata: {
      metadata,
      verification: {
        amount: verifyData?.amount ?? null,
        currency: verifyData?.currency ?? null,
        status: verifyData?.status ?? null,
        paid_at: verifyData?.paid_at ?? null,
        channel: verifyData?.channel ?? null,
      },
      flag_reason: check.ok ? null : check.reason,
    },
  };

  // ── Idempotent insert — UNIQUE(paystack_reference) is the lock ──
  const serviceClient = getServiceClient();
  const insert = await serviceClient
    .from('orders')
    .upsert(row, { onConflict: 'paystack_reference', ignoreDuplicates: true })
    .select('id');
  if (insert.error) {
    console.error(`[paystack-webhook] insert_failed ref=${reference}`, insert.error.code);
    return json({ error: 'order_insert_failed' }, 500);
  }
  if (!insert.data || insert.data.length === 0) {
    // Already processed on a previous delivery — no row, no email.
    return json({ ok: true, reference, duplicate: true }, 200);
  }

  // ── Emails — best-effort, never roll back the order ──
  const amountPaidNaira = koboToNaira(amountKobo);
  if (check.ok) {
    if (buyerEmail) {
      const buyer = buyerConfirmationEmail({
        orderType: orderType as 'full' | 'reservation',
        // Reservations may not have a model yet — show a friendly label,
        // never the raw 'undecided' token.
        skuName: skuName ?? (orderType === 'reservation' ? 'LEIKO Watch — model to be chosen' : sku),
        amountPaidNaira,
        reference,
        customerName,
        deliveryAddress,
        balanceDueNaira: balanceDue,
        completeUrl:
          orderType === 'reservation' ? buildCompleteUrl(reference, buyerEmail) : null,
      });
      await sendResendEmail(buyerEmail, buyer.subject, buyer.html, reference);
    } else {
      console.error(`[paystack-webhook] no_buyer_email ref=${reference}`);
    }
  }

  const alertTo = Deno.env.get('ORDER_ALERT_EMAIL');
  if (alertTo) {
    const alert = internalAlertEmail({
      orderType,
      sku,
      skuName,
      reference,
      status,
      amountPaidNaira,
      balanceDueNaira: balanceDue,
      customerName,
      email: buyerEmail,
      phone: customerPhone,
      deliveryAddress,
      flagged: !check.ok,
      flagReason: check.ok ? null : check.reason ?? null,
    });
    await sendResendEmail(alertTo, alert.subject, alert.html, reference);
  } else {
    console.error(`[paystack-webhook] alert_email_not_configured ref=${reference}`);
  }

  return json({ ok: true, reference, status, duplicate: false }, 200);
});

/**
 * Deposit-ladder step 2 — order_type='balance'. The buyer already paid
 * the ₦50,000 deposit; this transaction settles the remaining balance
 * for the watch they chose on /reserve/complete. It UPDATES the original
 * reservation row (never inserts a fresh order); orphan or invalid
 * balance payments are preserved as their own flagged rows for review.
 *
 * Idempotency: balance_reference is UNIQUE and the update is conditional
 * on balance_reference IS NULL + status='reserved' — a redelivered event
 * matches zero rows and exits as a duplicate.
 */
async function handleBalancePayment(args: {
  verifyData: any;
  metadata: Record<string, unknown>;
  reference: string;
}): Promise<Response> {
  const { verifyData, metadata, reference } = args;
  const serviceClient = getServiceClient();

  const sku = String((metadata as any)?.sku ?? 'unknown');
  const skuName = SKU_NAMES[sku] ?? null;
  const reservationRef =
    typeof (metadata as any)?.reservation_reference === 'string'
      ? ((metadata as any).reservation_reference as string)
      : null;

  const amountKobo: number = typeof verifyData?.amount === 'number' ? verifyData.amount : 0;
  const amountPaidNaira = koboToNaira(amountKobo);
  const buyerEmailFromVerify: string =
    (typeof verifyData?.customer?.email === 'string' && verifyData.customer.email) || '';
  const customerName = extractCustomField(metadata, ['full_name', 'name', 'customer_name']);
  const customerPhone = extractCustomField(metadata, ['phone', 'phone_number', 'mobile']);
  const deliveryAddress = extractCustomField(metadata, [
    'delivery_address',
    'address',
    'shipping_address',
  ]);

  const check = validateTransaction({
    status: verifyData?.status,
    currency: verifyData?.currency,
    amountKobo: typeof verifyData?.amount === 'number' ? verifyData.amount : undefined,
    orderType: 'balance',
    sku,
  });

  // Saves the payment as its own flagged row + internal alert, 200.
  // Never silently drops a real payment, never emails the buyer.
  const flagAndRespond = async (reason: string): Promise<Response> => {
    const row = {
      paystack_reference: reference,
      email: buyerEmailFromVerify,
      sku,
      sku_name: skuName,
      order_type: 'balance',
      amount_paid_kobo: amountKobo,
      full_price_naira: PRICE_NAIRA[sku] ?? null,
      balance_due_naira: null,
      refundable: false,
      customer_name: customerName,
      customer_phone: customerPhone,
      delivery_address: deliveryAddress,
      status: 'flagged',
      raw_metadata: {
        metadata,
        verification: {
          amount: verifyData?.amount ?? null,
          currency: verifyData?.currency ?? null,
          status: verifyData?.status ?? null,
          paid_at: verifyData?.paid_at ?? null,
          channel: verifyData?.channel ?? null,
        },
        flag_reason: reason,
        reservation_reference: reservationRef,
      },
    };
    const ins = await serviceClient
      .from('orders')
      .upsert(row, { onConflict: 'paystack_reference', ignoreDuplicates: true })
      .select('id');
    if (ins.error) {
      console.error(`[paystack-webhook] balance_flag_insert_failed ref=${reference}`, ins.error.code);
      return json({ error: 'order_insert_failed' }, 500);
    }
    if (!ins.data || ins.data.length === 0) {
      return json({ ok: true, reference, duplicate: true }, 200);
    }
    const alertTo = Deno.env.get('ORDER_ALERT_EMAIL');
    if (alertTo) {
      const alert = internalAlertEmail({
        orderType: 'balance',
        sku,
        skuName,
        reference,
        status: 'flagged',
        amountPaidNaira,
        balanceDueNaira: null,
        customerName,
        email: buyerEmailFromVerify,
        phone: customerPhone,
        deliveryAddress,
        flagged: true,
        flagReason: reason,
      });
      await sendResendEmail(alertTo, alert.subject, alert.html, reference);
    }
    return json({ ok: true, reference, status: 'flagged', duplicate: false }, 200);
  };

  if (!reservationRef) {
    return await flagAndRespond('balance payment without reservation_reference in metadata');
  }
  if (!check.ok) {
    return await flagAndRespond(check.reason ?? 'balance validation failed');
  }

  // Load the reservation this balance claims to complete.
  const found = await serviceClient
    .from('orders')
    .select('id, status, balance_reference, amount_paid_kobo, email, customer_name, customer_phone, raw_metadata')
    .eq('paystack_reference', reservationRef)
    .maybeSingle();
  if (found.error) {
    console.error(`[paystack-webhook] balance_lookup_failed ref=${reference}`, found.error.code);
    return json({ error: 'order_lookup_failed' }, 500);
  }
  const reservation = found.data;
  if (!reservation) {
    return await flagAndRespond(`no reservation found for reference "${reservationRef}"`);
  }
  if (reservation.balance_reference === reference) {
    // Redelivered event for an already-applied balance — done.
    return json({ ok: true, reference, duplicate: true }, 200);
  }
  if (reservation.status !== 'reserved' || reservation.balance_reference != null) {
    return await flagAndRespond(
      `reservation "${reservationRef}" is not open for a balance payment (status=${reservation.status})`,
    );
  }

  const priceNaira = PRICE_NAIRA[sku];
  const mergedMetadata = {
    ...(reservation.raw_metadata && typeof reservation.raw_metadata === 'object'
      ? (reservation.raw_metadata as Record<string, unknown>)
      : {}),
    balance: {
      metadata,
      verification: {
        amount: verifyData?.amount ?? null,
        currency: verifyData?.currency ?? null,
        status: verifyData?.status ?? null,
        paid_at: verifyData?.paid_at ?? null,
        channel: verifyData?.channel ?? null,
      },
    },
  };

  const upd = await serviceClient
    .from('orders')
    .update({
      status: 'paid',
      sku,
      sku_name: skuName,
      full_price_naira: priceNaira,
      balance_due_naira: 0,
      refundable: false,
      balance_reference: reference,
      balance_paid_at: new Date().toISOString(),
      amount_paid_kobo: (Number(reservation.amount_paid_kobo) || 0) + amountKobo,
      customer_name: customerName ?? reservation.customer_name ?? null,
      customer_phone: customerPhone ?? reservation.customer_phone ?? null,
      delivery_address: deliveryAddress,
      raw_metadata: mergedMetadata,
    })
    .eq('paystack_reference', reservationRef)
    .eq('status', 'reserved')
    .is('balance_reference', null)
    .select('id');
  if (upd.error) {
    console.error(`[paystack-webhook] balance_update_failed ref=${reference}`, upd.error.code);
    return json({ error: 'order_update_failed' }, 500);
  }
  if (!upd.data || upd.data.length === 0) {
    // Lost a race with a concurrent delivery — check who won.
    const recheck = await serviceClient
      .from('orders')
      .select('balance_reference')
      .eq('paystack_reference', reservationRef)
      .maybeSingle();
    if (recheck.data?.balance_reference === reference) {
      return json({ ok: true, reference, duplicate: true }, 200);
    }
    return await flagAndRespond(
      `reservation "${reservationRef}" was completed by a different payment`,
    );
  }

  // ── Emails — best-effort, never roll back the completed order ──
  const buyerEmail = (reservation.email as string) || buyerEmailFromVerify;
  if (buyerEmail) {
    const mail = buyerBalanceEmail({
      skuName: skuName ?? sku,
      balancePaidNaira: amountPaidNaira,
      totalNaira: priceNaira ?? null,
      reference,
      customerName: customerName ?? (reservation.customer_name as string) ?? null,
      deliveryAddress,
    });
    await sendResendEmail(buyerEmail, mail.subject, mail.html, reference);
  } else {
    console.error(`[paystack-webhook] no_buyer_email ref=${reference}`);
  }

  const alertTo = Deno.env.get('ORDER_ALERT_EMAIL');
  if (alertTo) {
    const alert = internalAlertEmail({
      orderType: 'balance',
      sku,
      skuName,
      reference,
      status: 'paid',
      amountPaidNaira,
      balanceDueNaira: 0,
      customerName: customerName ?? (reservation.customer_name as string) ?? null,
      email: buyerEmail,
      phone: customerPhone ?? (reservation.customer_phone as string) ?? null,
      deliveryAddress,
      flagged: false,
      flagReason: null,
    });
    await sendResendEmail(alertTo, alert.subject, alert.html, reference);
  } else {
    console.error(`[paystack-webhook] alert_email_not_configured ref=${reference}`);
  }

  return json({ ok: true, reference, status: 'paid', completed: true, duplicate: false }, 200);
}

/**
 * refund.processed (optional path per the build brief): mark the order
 * refunded and tell the buyer. Refund INITIATION is out of scope — it
 * happens in the Paystack dashboard or a future server-side task.
 * Idempotent: only a row that actually transitions to 'refunded' emails.
 */
async function handleRefundProcessed(payload: any): Promise<Response> {
  const reference: string | undefined =
    payload?.data?.transaction_reference ?? payload?.data?.transaction?.reference;
  if (!reference || typeof reference !== 'string') {
    console.error('[paystack-webhook] refund_without_reference');
    return json({ ok: true, ignored: 'refund_missing_reference' }, 200);
  }

  const serviceClient = getServiceClient();
  // A refund can land against either transaction of the deposit-ladder —
  // match the deposit reference or the balance reference.
  const upd = await serviceClient
    .from('orders')
    .update({ status: 'refunded' })
    .or(`paystack_reference.eq.${reference},balance_reference.eq.${reference}`)
    .neq('status', 'refunded')
    .select('email, sku_name, sku, customer_name');
  if (upd.error) {
    console.error(`[paystack-webhook] refund_update_failed ref=${reference}`, upd.error.code);
    return json({ error: 'refund_update_failed' }, 500);
  }
  const order = upd.data?.[0];
  if (!order) {
    // Unknown reference or already refunded — nothing to do.
    return json({ ok: true, reference, refunded: false }, 200);
  }

  if (order.email) {
    const mail = buyerRefundEmail({
      skuName: (order.sku_name as string) ?? (order.sku as string) ?? 'LEIKO Watch',
      reference,
      customerName: (order.customer_name as string) ?? null,
    });
    await sendResendEmail(order.email as string, mail.subject, mail.html, reference);
  }
  return json({ ok: true, reference, refunded: true }, 200);
}

function getServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceKey);
}

/**
 * Resend send, best-effort. Returns false on any failure; the failure is
 * logged with the reference + status code only — never the API key,
 * never the email body.
 */
async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  reference: string,
): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');
  if (!apiKey || !from) {
    console.error(`[paystack-webhook] resend_not_configured ref=${reference}`);
    return false;
  }
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!resp.ok) {
      console.error(`[paystack-webhook] resend_failed status=${resp.status} ref=${reference}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[paystack-webhook] resend_error ref=${reference}`, (e as Error)?.message);
    return false;
  }
}
