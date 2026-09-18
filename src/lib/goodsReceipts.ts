import { query } from "@/lib/db";
import { getPurchaseOrderById } from "@/lib/purchaseOrders";
import { createInventoryItem, getInventoryItemById } from "@/lib/inventory";
import type { InventoryItemRow } from "@/lib/inventory";
import { computeCapitalNeeded } from "@/lib/procurementDisplay";

// v2 Procurement workflow Phase 2 — GRN (Goods Receipt Note). Now the
// actual trigger for creating the linked Inventory item, replacing the old
// direct Received-status-triggers-Inventory-item link — "goods arrived"
// (the PO's own status) is decoupled from "verified and accepted into
// stock" (this).

export type GoodsReceiptRow = {
  id: number;
  purchase_order_id: number;
  date_received: string; // "YYYY-MM-DD"
  quantity_received: number;
  condition_notes: string;
  received_by: number | null;
  received_by_username: string | null;
  inventory_item_id: number | null;
  created_at: Date;
};

const SELECT = `
  SELECT g.id, g.purchase_order_id, g.date_received, g.quantity_received, g.condition_notes,
         g.received_by, u.username AS received_by_username, g.inventory_item_id, g.created_at
  FROM goods_receipts g
  LEFT JOIN users u ON u.id = g.received_by
`;

export async function listGoodsReceiptsForPO(poId: number): Promise<GoodsReceiptRow[]> {
  const res = await query<GoodsReceiptRow>(`${SELECT} WHERE g.purchase_order_id = $1 ORDER BY g.created_at ASC`, [poId]);
  return res.rows;
}

export async function getGoodsReceiptById(id: number): Promise<GoodsReceiptRow | null> {
  const res = await query<GoodsReceiptRow>(`${SELECT} WHERE g.id = $1`, [id]);
  return res.rows[0] ?? null;
}

// Uses the GRN's own quantity_received (what actually arrived), not the
// PO's ordered quantity — so a partial shipment's Inventory item reflects
// reality, not the original order. Defaults to "consumable", same as the
// old direct link did (an Admin can retag it afterward from Inventory).
export async function createGoodsReceipt(input: {
  purchaseOrderId: number;
  dateReceived: string;
  quantityReceived: number;
  conditionNotes: string;
  receivedBy: number;
}): Promise<{ receipt: GoodsReceiptRow; inventoryItem: InventoryItemRow }> {
  const po = await getPurchaseOrderById(input.purchaseOrderId);
  if (!po) throw new Error("Purchase order not found");

  const cost = computeCapitalNeeded({
    unitPrice: po.unit_price,
    quantityNeeded: input.quantityReceived,
    shippingCost: po.shipping_cost,
    customsCost: po.customs_cost,
  });
  const item = await createInventoryItem({
    name: po.product_name,
    assetType: "consumable",
    quantity: input.quantityReceived,
    quantityUnit: po.quantity_unit,
    purchaseCost: cost,
    currency: po.currency,
    purchaseDate: input.dateReceived,
    currentValue: cost,
    usefulLifeMonths: null,
    location: "",
    notes: `Received from Purchase Order #${po.id} (GRN)`,
  });
  await query(`UPDATE inventory_items SET purchase_order_id = $1 WHERE id = $2`, [po.id, item.id]);
  const linkedItem = await getInventoryItemById(item.id);
  if (!linkedItem) throw new Error("Failed to load inventory item after linking");

  const res = await query<{ id: number }>(
    `INSERT INTO goods_receipts (purchase_order_id, date_received, quantity_received, condition_notes, received_by, inventory_item_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [input.purchaseOrderId, input.dateReceived, input.quantityReceived, input.conditionNotes, input.receivedBy, linkedItem.id]
  );
  const receipt = await getGoodsReceiptById(res.rows[0].id);
  if (!receipt) throw new Error("Failed to load created goods receipt");
  return { receipt, inventoryItem: linkedItem };
}

// Doesn't delete the linked Inventory item — an Admin who wants that gone
// too deletes it explicitly from Inventory, same "one action doesn't
// silently cascade-delete a different module's record" caution used
// elsewhere (e.g. removing a vendor link never deletes the vendor itself).
export async function deleteGoodsReceipt(id: number): Promise<void> {
  await query(`DELETE FROM goods_receipts WHERE id = $1`, [id]);
}
