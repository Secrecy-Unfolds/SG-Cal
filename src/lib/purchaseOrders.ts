import { query } from "@/lib/db";
import { getProductById, listVendorsForProduct } from "@/lib/procurement";
import { createInventoryItemFromPurchaseOrder } from "@/lib/inventory";
import { postExpenseForPurchaseOrder } from "@/lib/accounting";
import type { POStatus } from "@/lib/purchaseOrdersDisplay";

export type { POStatus } from "@/lib/purchaseOrdersDisplay";
export { PO_STATUSES, PO_STATUS_LABELS, isPOStatus } from "@/lib/purchaseOrdersDisplay";

export type PurchaseOrderRow = {
  id: number;
  product_id: number | null;
  product_name: string;
  vendor_id: number | null;
  vendor_name: string;
  quantity: number;
  quantity_unit: string;
  unit_price: string | null; // numeric comes back as a string from pg
  shipping_cost: string | null;
  customs_cost: string | null;
  currency: string;
  pricing: string;
  payment_terms: string;
  delivery_period: string;
  warranty: string;
  status: POStatus;
  order_date: string; // "YYYY-MM-DD"
  expected_arrival: string | null;
  received_at: Date | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
  updated_at: Date;
};

const PO_SELECT = `
  SELECT po.id, po.product_id, po.product_name, po.vendor_id, po.vendor_name,
         po.quantity, po.quantity_unit, po.unit_price, po.shipping_cost, po.customs_cost, po.currency,
         po.pricing, po.payment_terms, po.delivery_period, po.warranty, po.status,
         po.order_date, po.expected_arrival, po.received_at,
         po.created_by, u.username AS created_by_username, po.created_at, po.updated_at
  FROM purchase_orders po
  LEFT JOIN users u ON u.id = po.created_by
`;

export async function listPurchaseOrders(): Promise<PurchaseOrderRow[]> {
  const res = await query<PurchaseOrderRow>(`${PO_SELECT} ORDER BY po.created_at DESC`);
  return res.rows;
}

export async function getPurchaseOrderById(id: number): Promise<PurchaseOrderRow | null> {
  const res = await query<PurchaseOrderRow>(`${PO_SELECT} WHERE po.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export type CreatePurchaseOrderResult =
  | { ok: true; po: PurchaseOrderRow }
  | { ok: false; error: string };

// Snapshots the Planning product's own numeric cost fields plus the chosen
// preferred vendor's offering (free-text pricing/terms) at this moment —
// both stay correct even if the Planning product or vendor link changes
// later. A product can be sent more than once (confirmed: no one-PO-per-
// product limit), each call creates a separate PO.
export async function createPurchaseOrderFromProduct(
  productId: number,
  actorId: number
): Promise<CreatePurchaseOrderResult> {
  const product = await getProductById(productId);
  if (!product) return { ok: false, error: "Product not found" };
  if (!product.preferred_vendor_id) {
    return { ok: false, error: "Set a preferred vendor on this product before sending it to Procurement" };
  }

  const vendorLinks = await listVendorsForProduct(productId);
  const offering = vendorLinks.find((v) => v.vendor_id === product.preferred_vendor_id);
  if (!offering) return { ok: false, error: "Preferred vendor's offering not found" };

  const res = await query<{ id: number }>(
    `INSERT INTO purchase_orders
       (product_id, product_name, vendor_id, vendor_name, quantity, quantity_unit,
        unit_price, shipping_cost, customs_cost, currency, pricing, payment_terms,
        delivery_period, warranty, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id`,
    [
      product.id,
      product.name,
      offering.vendor_id,
      offering.name,
      product.quantity_needed,
      product.quantity_unit,
      product.unit_price,
      product.shipping_cost,
      product.customs_cost,
      product.currency,
      offering.pricing,
      offering.payment_terms,
      offering.delivery_period,
      offering.warranty,
      actorId,
    ]
  );
  const created = await getPurchaseOrderById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created purchase order");
  return { ok: true, po: created };
}

// Transitioning into "received" (from anything else) is what triggers the
// Inventory item + Accounting expense — both created in this same call so
// they can never happen without a status change causing them.
export async function updatePurchaseOrderStatus(id: number, status: POStatus): Promise<PurchaseOrderRow | null> {
  const existing = await getPurchaseOrderById(id);
  if (!existing) return null;
  const becomingReceived = status === "received" && existing.status !== "received";

  await query(
    `UPDATE purchase_orders
     SET status = $1, updated_at = now(),
         received_at = CASE WHEN $1 = 'received' AND received_at IS NULL THEN now() ELSE received_at END
     WHERE id = $2`,
    [status, id]
  );

  const updated = await getPurchaseOrderById(id);
  if (!updated) return null;

  if (becomingReceived) {
    await createInventoryItemFromPurchaseOrder(updated);
    await postExpenseForPurchaseOrder(updated);
  }

  return updated;
}
