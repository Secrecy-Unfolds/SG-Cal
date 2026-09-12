import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import { escapeHtml, introText, wrap } from "@/lib/emailShell";
import { computeCapitalNeeded, formatMoney } from "@/lib/procurementDisplay";
import { PO_STATUS_LABELS } from "@/lib/purchaseOrdersDisplay";

const PO_COLOR = "#3b5bdb";

function poCard(po: PurchaseOrderRow): string {
  const capital = computeCapitalNeeded({
    unitPrice: po.unit_price,
    quantityNeeded: po.quantity,
    shippingCost: po.shipping_cost,
    customsCost: po.customs_cost,
  });
  const details = [
    `Status: <strong>${escapeHtml(PO_STATUS_LABELS[po.status])}</strong>`,
    `Vendor: <strong>${escapeHtml(po.vendor_name)}</strong>`,
    `Quantity: <strong>${po.quantity} ${escapeHtml(po.quantity_unit)}</strong>`,
    `Total: <strong>${formatMoney(capital, po.currency)}</strong>`,
  ].join(" &middot; ");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:4px; background:${PO_COLOR}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(po.product_name)} (PO #${po.id})</div>
          <div style="font-size:12px; color:#6b7280; margin-top:4px; line-height:1.6;">${details}</div>
        </td>
      </tr>
    </table>`;
}

export function purchaseOrderCreatedEmail(po: PurchaseOrderRow): { subject: string; html: string } {
  const who = po.created_by_username ? escapeHtml(po.created_by_username) : "Someone";
  return {
    subject: `New purchase order: ${po.product_name}`,
    html: wrap(
      `${who} sent "${po.product_name}" to Procurement`,
      "New purchase order",
      introText(`${who} created a new purchase order:`) + poCard(po)
    ),
  };
}

export function purchaseOrderStatusChangedEmail(po: PurchaseOrderRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  const label = PO_STATUS_LABELS[po.status];
  return {
    subject: `PO #${po.id} ${label}: ${po.product_name}`,
    html: wrap(
      `${whoSafe} marked PO #${po.id} as ${label}`,
      "Purchase order updated",
      introText(`${whoSafe} updated this purchase order's status:`) + poCard(po)
    ),
  };
}
