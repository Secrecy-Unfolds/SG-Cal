import { query } from "@/lib/db";
import { getProductById, listVendorsForProduct } from "@/lib/procurement";
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
  carrier: string;
  tracking_reference: string;
  quantity_received: number | null;
  close_reason: string | null;
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
         po.carrier, po.tracking_reference, po.quantity_received, po.close_reason,
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

// v2 Procurement workflow Phase 2 (confirmed 2026-09-17): a status change
// to "received" used to directly create the linked Inventory item and post
// the Accounting expense. That's now decoupled — "received" just means the
// shipment physically arrived; a GRN (lib/goodsReceipts.ts) is what
// actually creates the Inventory item ("verified into stock"), and a
// Vendor Invoice (lib/vendorInvoices.ts) is what posts the expense. This
// function only ever touches status/received_at now.
export async function updatePurchaseOrderStatus(id: number, status: POStatus): Promise<PurchaseOrderRow | null> {
  const existing = await getPurchaseOrderById(id);
  if (!existing) return null;

  await query(
    `UPDATE purchase_orders
     SET status = $1, updated_at = now(),
         received_at = CASE WHEN $1 = 'received' AND received_at IS NULL THEN now() ELSE received_at END
     WHERE id = $2`,
    [status, id]
  );

  return getPurchaseOrderById(id);
}

// v2 Procurement workflow Phase 2 — Closure. Normally reachable once a GRN
// exists, an invoice exists, and that invoice is fully paid; otherwise
// only reachable via the explicit force-close path below (confirmed:
// force-close is for write-offs / disputed or abandoned orders that will
// never fully reconcile, not a way to skip the checks routinely).
export type CloseEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

export async function checkCloseEligibility(id: number): Promise<CloseEligibility> {
  // Imported lazily to avoid a module-load cycle (goodsReceipts.ts and
  // vendorInvoices.ts both import from this file).
  const { listGoodsReceiptsForPO } = await import("@/lib/goodsReceipts");
  const { listVendorInvoicesForPO } = await import("@/lib/vendorInvoices");

  const [receipts, invoices] = await Promise.all([listGoodsReceiptsForPO(id), listVendorInvoicesForPO(id)]);
  if (receipts.length === 0) return { eligible: false, reason: "No GRN logged yet" };
  if (invoices.length === 0) return { eligible: false, reason: "No invoice logged yet" };
  const unpaid = invoices.filter((inv) => inv.outstanding_balance > 0);
  if (unpaid.length > 0) return { eligible: false, reason: "One or more invoices aren't fully paid yet" };
  return { eligible: true };
}

export async function closePurchaseOrder(id: number): Promise<PurchaseOrderRow | null> {
  const eligibility = await checkCloseEligibility(id);
  if (!eligibility.eligible) throw new Error(eligibility.reason);
  await query(`UPDATE purchase_orders SET status = 'closed', close_reason = NULL, updated_at = now() WHERE id = $1`, [id]);
  return getPurchaseOrderById(id);
}

// The explicit override — always allowed regardless of eligibility, but
// always requires a reason (surfaced in the UI, kept for audit).
export async function forceClosePurchaseOrder(id: number, reason: string): Promise<PurchaseOrderRow | null> {
  await query(`UPDATE purchase_orders SET status = 'closed', close_reason = $1, updated_at = now() WHERE id = $2`, [
    reason,
    id,
  ]);
  return getPurchaseOrderById(id);
}

// Delivery-tracking fields, independent of status transitions — a carrier/
// tracking reference and how much actually arrived vs. was ordered.
// Deliberately doesn't touch status, expected_arrival, or received_at
// (those are updatePurchaseOrderStatus()'s concern) or re-trigger the
// Inventory/Accounting auto-postings.
export async function updatePurchaseOrderDelivery(
  id: number,
  input: { carrier: string; trackingReference: string; quantityReceived: number | null; expectedArrival: string | null }
): Promise<PurchaseOrderRow | null> {
  await query(
    `UPDATE purchase_orders
     SET carrier = $1, tracking_reference = $2, quantity_received = $3, expected_arrival = $4, updated_at = now()
     WHERE id = $5`,
    [input.carrier, input.trackingReference, input.quantityReceived, input.expectedArrival, id]
  );
  return getPurchaseOrderById(id);
}
