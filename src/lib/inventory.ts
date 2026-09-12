import { query } from "@/lib/db";
import type { AssetType } from "@/lib/inventoryDisplay";
import { computeCapitalNeeded } from "@/lib/procurementDisplay";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";

export type { AssetType } from "@/lib/inventoryDisplay";
export { ASSET_TYPES, ASSET_TYPE_LABELS, isAssetType } from "@/lib/inventoryDisplay";

export type InventoryItemRow = {
  id: number;
  name: string;
  asset_type: AssetType;
  quantity: number;
  quantity_unit: string;
  purchase_cost: string | null; // numeric comes back as a string from pg
  currency: string;
  purchase_date: string | null; // "YYYY-MM-DD"
  current_value: string | null;
  location: string;
  notes: string;
  purchase_order_id: number | null;
  created_at: Date;
  updated_at: Date;
};

const ITEM_SELECT = `
  SELECT id, name, asset_type, quantity, quantity_unit, purchase_cost, currency,
         purchase_date, current_value, location, notes, purchase_order_id, created_at, updated_at
  FROM inventory_items
`;

export async function listInventoryItems(): Promise<InventoryItemRow[]> {
  const res = await query<InventoryItemRow>(`${ITEM_SELECT} ORDER BY created_at DESC`);
  return res.rows;
}

export async function getInventoryItemById(id: number): Promise<InventoryItemRow | null> {
  const res = await query<InventoryItemRow>(`${ITEM_SELECT} WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

export type InventoryItemInput = {
  name: string;
  assetType: AssetType;
  quantity: number;
  quantityUnit: string;
  purchaseCost: number | null;
  currency: string;
  purchaseDate: string | null;
  currentValue: number | null;
  location: string;
  notes: string;
};

export async function createInventoryItem(input: InventoryItemInput): Promise<InventoryItemRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO inventory_items
       (name, asset_type, quantity, quantity_unit, purchase_cost, currency, purchase_date, current_value, location, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      input.name,
      input.assetType,
      input.quantity,
      input.quantityUnit,
      input.purchaseCost,
      input.currency,
      input.purchaseDate,
      input.currentValue,
      input.location,
      input.notes,
    ]
  );
  const created = await getInventoryItemById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created inventory item");
  return created;
}

export async function updateInventoryItem(id: number, input: InventoryItemInput): Promise<InventoryItemRow | null> {
  await query(
    `UPDATE inventory_items
     SET name = $1, asset_type = $2, quantity = $3, quantity_unit = $4, purchase_cost = $5,
         currency = $6, purchase_date = $7, current_value = $8, location = $9, notes = $10, updated_at = now()
     WHERE id = $11`,
    [
      input.name,
      input.assetType,
      input.quantity,
      input.quantityUnit,
      input.purchaseCost,
      input.currency,
      input.purchaseDate,
      input.currentValue,
      input.location,
      input.notes,
      id,
    ]
  );
  return getInventoryItemById(id);
}

export async function deleteInventoryItem(id: number): Promise<void> {
  await query(`DELETE FROM inventory_items WHERE id = $1`, [id]);
}

// Called when a Purchase Order transitions to "received" — creates the
// corresponding inventory row, defaulting to "consumable" (an Admin can
// retag it fixed/depreciating and adjust current_value afterward).
export async function createInventoryItemFromPurchaseOrder(po: PurchaseOrderRow): Promise<InventoryItemRow> {
  const cost = computeCapitalNeeded({
    unitPrice: po.unit_price,
    quantityNeeded: po.quantity,
    shippingCost: po.shipping_cost,
    customsCost: po.customs_cost,
  });
  const item = await createInventoryItem({
    name: po.product_name,
    assetType: "consumable",
    quantity: po.quantity,
    quantityUnit: po.quantity_unit,
    purchaseCost: cost,
    currency: po.currency,
    purchaseDate: po.received_at ? po.received_at.toISOString().slice(0, 10) : null,
    currentValue: cost,
    location: "",
    notes: `Received from Purchase Order #${po.id}`,
  });
  await query(`UPDATE inventory_items SET purchase_order_id = $1 WHERE id = $2`, [po.id, item.id]);
  const linked = await getInventoryItemById(item.id);
  if (!linked) throw new Error("Failed to load inventory item after linking");
  return linked;
}
