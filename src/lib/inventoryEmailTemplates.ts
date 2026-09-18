import type { InventoryItemRow } from "@/lib/inventory";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import { escapeHtml, introText, wrap } from "@/lib/emailShell";
import { formatMoney, formatDateOnly } from "@/lib/procurementDisplay";
import { ASSET_TYPE_LABELS } from "@/lib/inventoryDisplay";

const ITEM_COLOR = "#0f766e";

function itemCard(item: InventoryItemRow): string {
  const details = [
    `Type: <strong>${escapeHtml(ASSET_TYPE_LABELS[item.asset_type])}</strong>`,
    `Quantity: <strong>${item.quantity} ${escapeHtml(item.quantity_unit)}</strong>`,
    `Value: <strong>${formatMoney(item.current_value, item.currency)}</strong>`,
    item.purchase_date ? `Purchased: <strong>${formatDateOnly(item.purchase_date)}</strong>` : null,
    item.location ? `Location: <strong>${escapeHtml(item.location)}</strong>` : null,
  ]
    .filter(Boolean)
    .join(" &middot; ");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:4px; background:${ITEM_COLOR}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(item.name)}</div>
          <div style="font-size:12px; color:#6b7280; margin-top:4px; line-height:1.6;">${details}</div>
        </td>
      </tr>
    </table>`;
}

export function inventoryItemCreatedEmail(item: InventoryItemRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `New inventory item: ${item.name}`,
    html: wrap(
      `${whoSafe} added "${item.name}" to Inventory`,
      "Inventory item added",
      introText(`${whoSafe} added a new item to Inventory:`) + itemCard(item)
    ),
  };
}

export function inventoryItemUpdatedEmail(item: InventoryItemRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `Updated inventory item: ${item.name}`,
    html: wrap(
      `${whoSafe} updated "${item.name}"`,
      "Inventory item updated",
      introText(`${whoSafe} made changes to this item. Here are the current details:`) + itemCard(item)
    ),
  };
}

export function inventoryItemDeletedEmail(item: InventoryItemRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `Removed inventory item: ${item.name}`,
    html: wrap(
      `${whoSafe} removed "${item.name}" from Inventory`,
      "Inventory item removed",
      introText(`${whoSafe} removed this item from Inventory. It was:`) + itemCard(item)
    ),
  };
}

// Sent when a GRN (Goods Receipt Note) auto-creates its linked Inventory
// item — v2 Procurement workflow Phase 2 decoupled this from the PO's own
// status (see lib/goodsReceipts.ts) — distinct wording from the manual-
// entry email above, since no one filled out an Inventory form here, they
// logged a GRN against a PO.
export function inventoryItemFromGrnEmail(
  item: InventoryItemRow,
  po: PurchaseOrderRow,
  who: string
): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `Inventory item created from GRN on PO #${po.id}: ${item.name}`,
    html: wrap(
      `Logging a GRN on PO #${po.id} created a new Inventory item`,
      "Inventory item auto-created",
      introText(
        `${whoSafe} logged a Goods Receipt Note against Purchase Order #${po.id} (${escapeHtml(po.vendor_name)}), which automatically created this Inventory item:`
      ) + itemCard(item)
    ),
  };
}
