import type { CustomerRow } from "@/lib/customers";
import type { InvoiceLineItemRow, IssuedInvoiceRow } from "@/lib/invoices";
import { escapeHtml, introText, wrap } from "@/lib/emailShell";
import { formatMoney } from "@/lib/procurementDisplay";
import { getAppBaseUrl } from "@/lib/url";

const ACCENT = "#0d1b2a";

function invoiceCard(invoice: IssuedInvoiceRow, lineItems: InvoiceLineItemRow[]): string {
  const total = lineItems.reduce((sum, li) => sum + parseFloat(li.line_amount), 0);
  const rows = lineItems
    .map(
      (li) => `
        <tr>
          <td style="padding:6px 0; font-size:13px; color:#111827;">${escapeHtml(li.description || "—")}</td>
          <td style="padding:6px 0; font-size:13px; color:#4b5563; text-align:right;">${escapeHtml(li.quantity)} × ${escapeHtml(
        formatMoney(li.unit_price, invoice.currency)
      )}</td>
          <td style="padding:6px 0; font-size:13px; color:#111827; text-align:right;">${escapeHtml(
            formatMoney(li.line_amount, invoice.currency)
          )}</td>
        </tr>`
    )
    .join("");

  const downloadUrl = `${getAppBaseUrl()}/api/invoices/${invoice.id}/pdf?token=${invoice.access_token}`;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
      <tr>
        <td style="width:4px; background:${ACCENT}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(invoice.invoice_number)}</div>
          <div style="font-size:13px; color:#6b7280; margin-top:2px;">
            ${escapeHtml(invoice.date)}${invoice.due_date ? ` &middot; due ${escapeHtml(invoice.due_date)}` : ""}
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px; border-top:1px solid #eef0f2;">
            ${rows}
            <tr>
              <td colspan="2" style="padding-top:8px; font-size:13px; font-weight:700; color:#111827; text-align:right;">Total</td>
              <td style="padding-top:8px; font-size:13px; font-weight:700; color:#111827; text-align:right;">
                ${escapeHtml(formatMoney(total, invoice.currency))}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 18px;">
      <a href="${downloadUrl}" style="display:inline-block; background:${ACCENT}; color:#ffffff; font-size:13px; font-weight:600; text-decoration:none; padding:10px 18px; border-radius:8px;">
        View / download invoice
      </a>
    </p>`;
}

// Sent when an Admin-level account emails an invoice to its customer. The
// PDF is attached when the mail relay supports it (see EmailAttachment in
// lib/mailer.ts); the "View / download invoice" link above works either
// way, via the public token-gated PDF route.
export function invoiceEmail(invoice: IssuedInvoiceRow, lineItems: InvoiceLineItemRow[], customer: CustomerRow): { subject: string; html: string } {
  return {
    subject: `Invoice ${invoice.invoice_number}`,
    html: wrap(
      `Invoice ${invoice.invoice_number} from us`,
      "Invoice",
      introText(`Dear ${escapeHtml(customer.name)}, please find your invoice below.`) + invoiceCard(invoice, lineItems)
    ),
  };
}
