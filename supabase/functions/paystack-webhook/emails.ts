// Email copy builders for /paystack-webhook — pure, no I/O.
// Colocated tests: emails.test.ts (includes a voice-rule pass via
// _shared/voice-lint-push.ts on every template).
//
// Voice rules (docs/05-voice-and-claims.md): warm, calm, dignified.
// Lead with the answer. No forbidden words, no fear language, no
// regulatory claims (never "FDA" anything in these emails). The device
// is referred to only by its product name (LEIKO Watch / LEIKO Watch Pro).

import { formatNaira } from './helpers.ts';

/** Untrusted strings (names, addresses) must pass through this before HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailContent {
  subject: string;
  html: string;
}

const WRAPPER_OPEN =
  '<div style="font-family: Georgia, \'Times New Roman\', serif; max-width: 560px; ' +
  'margin: 0 auto; padding: 24px; color: #2B2722; line-height: 1.6;">';
const WRAPPER_CLOSE = '</div>';

function detailRow(label: string, value: string): string {
  return (
    `<tr><td style="padding: 6px 12px 6px 0; color: #857F7A; white-space: nowrap; ` +
    `vertical-align: top;">${label}</td>` +
    `<td style="padding: 6px 0;">${value}</td></tr>`
  );
}

function detailTable(rows: string[]): string {
  return (
    '<table style="border-collapse: collapse; margin: 16px 0; font-size: 15px;">' +
    rows.join('') +
    '</table>'
  );
}

const SIGN_OFF =
  '<p style="margin-top: 24px;">Warm regards,<br/>The LEIKO team</p>';

export interface BuyerEmailInput {
  orderType: 'full' | 'reservation';
  skuName: string;
  amountPaidNaira: number;
  reference: string;
  customerName: string | null;
  deliveryAddress: string | null;
  /** Known for decided reservations; null when the model is still open. */
  balanceDueNaira: number | null;
  /**
   * Link to /reserve/complete for this reservation. When present, the
   * reservation email carries the Founder Edition invitation block.
   */
  completeUrl?: string | null;
}

/**
 * Buyer confirmation. Only ever sent for a fully verified, amount-matched
 * payment — never for flagged orders.
 */
export function buyerConfirmationEmail(input: BuyerEmailInput): EmailContent {
  const isReservation = input.orderType === 'reservation';
  const subject = isReservation
    ? 'Your LEIKO reservation is confirmed'
    : 'Your LEIKO order is confirmed';

  const name = input.customerName ? escapeHtml(input.customerName) : null;
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const product = escapeHtml(input.skuName);
  const lead = isReservation
    ? `Your ${product} reservation is confirmed — thank you.`
    : `Your ${product} order is confirmed — thank you.`;

  const rows = [
    detailRow('Product', product),
    detailRow(
      isReservation ? 'Deposit paid' : 'Amount paid',
      formatNaira(input.amountPaidNaira),
    ),
    detailRow('Order reference', escapeHtml(input.reference)),
  ];
  if (input.deliveryAddress) {
    rows.push(detailRow('Delivery address', escapeHtml(input.deliveryAddress)));
  }

  const balanceLine =
    input.balanceDueNaira != null
      ? `The remaining balance of ${formatNaira(input.balanceDueNaira)} is due when your watch ships. `
      : 'The remaining balance depends on which watch you choose, and is due when your watch ships. ';
  const reservationTerms = isReservation
    ? `<p>Your ${formatNaira(DEPOSIT_DISPLAY_NAIRA)} deposit counts toward the total. ` +
      balanceLine +
      `If you change your mind before your unit ships, your deposit is fully refundable.</p>`
    : '';

  // Founder Edition invitation — the deposit-ladder step 2. Only on
  // reservations, only when the caller built a completion link.
  const founderBlock =
    isReservation && input.completeUrl
      ? `<div style="margin: 20px 0; padding: 16px 18px; border: 1px solid #E0D8CC; border-radius: 12px;">` +
        `<p style="margin: 0 0 8px;"><strong>Want yours sooner?</strong></p>` +
        `<p style="margin: 0 0 14px;">The Founder Edition batch is in stock now. Choose your watch and settle the balance, and yours ships within days.</p>` +
        `<a href="${escapeHtml(input.completeUrl)}" style="display: inline-block; background: #E8A063; color: #2B2722; padding: 12px 20px; border-radius: 10px; font-weight: bold; text-decoration: none;">Choose your watch &rarr;</a>` +
        `<p style="margin: 14px 0 0; font-size: 13px; color: #857F7A;">Prefer to wait for the next batch? Nothing to do &mdash; your deposit already holds your place.</p>` +
        `</div>`
      : '';

  const nextStep = isReservation
    ? '<p>We will email you with progress updates as your watch gets closer to shipping.</p>'
    : '<p>We will email you as soon as your watch ships. If anything about your delivery details changes, just reply to this email.</p>';

  const html =
    WRAPPER_OPEN +
    `<p>${greeting}</p>` +
    `<p style="font-size: 17px;"><strong>${lead}</strong></p>` +
    detailTable(rows) +
    reservationTerms +
    founderBlock +
    nextStep +
    SIGN_OFF +
    WRAPPER_CLOSE;

  return { subject, html };
}

// Display constant for buyer copy — kept separate from helpers.DEPOSIT_NAIRA
// import to make the email module's output fully determined by its inputs
// plus this one visible constant.
const DEPOSIT_DISPLAY_NAIRA = 50_000;

export interface InternalAlertInput {
  orderType: string;
  sku: string;
  skuName: string | null;
  reference: string;
  status: string;
  amountPaidNaira: number;
  balanceDueNaira: number | null;
  customerName: string | null;
  email: string;
  phone: string | null;
  deliveryAddress: string | null;
  flagged: boolean;
  flagReason: string | null;
}

/** Internal "new order" alert to ORDER_ALERT_EMAIL. Sent for every saved order. */
export function internalAlertEmail(input: InternalAlertInput): EmailContent {
  const skuLabel = input.skuName ?? input.sku;
  const subject = input.flagged
    ? `FLAGGED — review: LEIKO ${input.orderType}: ${skuLabel} — ${input.reference}`
    : `New LEIKO ${input.orderType}: ${skuLabel} — ${input.reference}`;

  const dash = '—';
  const rows = [
    detailRow('Status', escapeHtml(input.status)),
    detailRow('Name', input.customerName ? escapeHtml(input.customerName) : dash),
    detailRow('Email', escapeHtml(input.email || dash)),
    detailRow('Phone', input.phone ? escapeHtml(input.phone) : dash),
    detailRow(
      'Delivery address',
      input.deliveryAddress ? escapeHtml(input.deliveryAddress) : dash,
    ),
    detailRow('SKU', escapeHtml(input.sku)),
    detailRow('Product', escapeHtml(skuLabel)),
    detailRow('Order type', escapeHtml(input.orderType)),
    detailRow('Amount paid', formatNaira(input.amountPaidNaira)),
    detailRow(
      'Balance due',
      input.balanceDueNaira != null ? formatNaira(input.balanceDueNaira) : dash,
    ),
    detailRow('Reference', escapeHtml(input.reference)),
  ];

  const flagBlock = input.flagged
    ? `<p style="font-size: 16px;"><strong>This order needs review before fulfilment.</strong><br/>` +
      `Reason: ${escapeHtml(input.flagReason ?? 'validation failed')}</p>` +
      '<p>No buyer confirmation was sent.</p>'
    : '';

  const html =
    WRAPPER_OPEN +
    `<p style="font-size: 17px;"><strong>${input.flagged ? 'Flagged payment received' : 'New order received'}</strong></p>` +
    flagBlock +
    detailTable(rows) +
    WRAPPER_CLOSE;

  return { subject, html };
}

export interface BalanceEmailInput {
  skuName: string;
  balancePaidNaira: number;
  totalNaira: number | null;
  reference: string;
  customerName: string | null;
  deliveryAddress: string | null;
}

/**
 * Buyer confirmation for a balance payment — the reservation is now a
 * complete order. Only ever sent for a fully verified, amount-matched
 * balance against an existing reservation.
 */
export function buyerBalanceEmail(input: BalanceEmailInput): EmailContent {
  const subject = 'Your LEIKO order is confirmed';
  const name = input.customerName ? escapeHtml(input.customerName) : null;
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const product = escapeHtml(input.skuName);

  const rows = [
    detailRow('Product', product),
    detailRow('Balance paid', formatNaira(input.balancePaidNaira)),
    detailRow('Deposit credited', formatNaira(DEPOSIT_DISPLAY_NAIRA)),
  ];
  if (input.totalNaira != null) {
    rows.push(detailRow('Total', formatNaira(input.totalNaira)));
  }
  rows.push(detailRow('Order reference', escapeHtml(input.reference)));
  if (input.deliveryAddress) {
    rows.push(detailRow('Delivery address', escapeHtml(input.deliveryAddress)));
  }

  const html =
    WRAPPER_OPEN +
    `<p>${greeting}</p>` +
    `<p style="font-size: 17px;"><strong>Your ${product} order is complete &mdash; thank you.</strong></p>` +
    detailTable(rows) +
    '<p>Your deposit and balance are both settled. We will email you as soon as your watch ships. ' +
    'If anything about your delivery details changes, just reply to this email.</p>' +
    SIGN_OFF +
    WRAPPER_CLOSE;

  return { subject, html };
}

export interface RefundEmailInput {
  skuName: string;
  reference: string;
  customerName: string | null;
}

/** Buyer notice when Paystack reports a refund as processed. */
export function buyerRefundEmail(input: RefundEmailInput): EmailContent {
  const subject = 'Your LEIKO refund is on its way';
  const name = input.customerName ? escapeHtml(input.customerName) : null;
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const html =
    WRAPPER_OPEN +
    `<p>${greeting}</p>` +
    `<p style="font-size: 17px;"><strong>Your refund has been processed.</strong></p>` +
    detailTable([
      detailRow('Product', escapeHtml(input.skuName)),
      detailRow('Order reference', escapeHtml(input.reference)),
    ]) +
    '<p>The full amount is on its way back to your original payment method. ' +
    'Depending on your bank, it can take a few business days to appear.</p>' +
    '<p>Thank you for considering LEIKO — you are welcome back any time.</p>' +
    SIGN_OFF +
    WRAPPER_CLOSE;
  return { subject, html };
}

/** Crude tag-stripper so tests can voice-lint the visible text of a template. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|tr|table|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}
