import { query } from "@/lib/db";
import { createProduct } from "@/lib/procurement";

export type { RequisitionStatus } from "@/lib/purchaseRequisitionsDisplay";
export { isRequisitionStatus } from "@/lib/purchaseRequisitionsDisplay";
import type { RequisitionStatus } from "@/lib/purchaseRequisitionsDisplay";

export type PurchaseRequisitionRow = {
  id: number;
  product_name: string;
  description: string;
  quantity_needed: number;
  quantity_unit: string;
  justification: string;
  status: RequisitionStatus;
  requested_by: number | null;
  requested_by_username: string | null;
  decided_by: number | null;
  decided_by_username: string | null;
  decided_at: Date | null;
  product_id: number | null;
  created_at: Date;
};

const SELECT = `
  SELECT r.id, r.product_name, r.description, r.quantity_needed, r.quantity_unit, r.justification,
         r.status, r.requested_by, ru.username AS requested_by_username,
         r.decided_by, du.username AS decided_by_username, r.decided_at, r.product_id, r.created_at
  FROM purchase_requisitions r
  LEFT JOIN users ru ON ru.id = r.requested_by
  LEFT JOIN users du ON du.id = r.decided_by
`;

export async function listRequisitions(): Promise<PurchaseRequisitionRow[]> {
  const res = await query<PurchaseRequisitionRow>(`${SELECT} ORDER BY r.created_at DESC`);
  return res.rows;
}

export async function getRequisitionById(id: number): Promise<PurchaseRequisitionRow | null> {
  const res = await query<PurchaseRequisitionRow>(`${SELECT} WHERE r.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function createRequisition(input: {
  productName: string;
  description: string;
  quantityNeeded: number;
  quantityUnit: string;
  justification: string;
  requestedBy: number;
}): Promise<PurchaseRequisitionRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO purchase_requisitions (product_name, description, quantity_needed, quantity_unit, justification, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [input.productName, input.description, input.quantityNeeded, input.quantityUnit, input.justification, input.requestedBy]
  );
  const created = await getRequisitionById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created requisition");
  return created;
}

export async function deleteRequisition(id: number): Promise<void> {
  await query(`DELETE FROM purchase_requisitions WHERE id = $1`, [id]);
}

// Approving is what actually creates the real Planning product — a
// requisition is "a stage before Planning itself," not a parallel record.
// Confirmed: any Admin-level can decide (not Super-Admin-only), matching
// the rest of Procurement's Admin/Super-Admin-equal treatment.
export async function decideRequisition(
  id: number,
  input: { status: "approved" | "rejected"; decidedBy: number }
): Promise<PurchaseRequisitionRow | null> {
  const existing = await getRequisitionById(id);
  if (!existing) return null;

  let productId: number | null = null;
  if (input.status === "approved") {
    const product = await createProduct({
      name: existing.product_name,
      pictureUrl: null,
      description: existing.description,
      requiredFor: "",
      requiredBy: null,
      quantityNeeded: existing.quantity_needed,
      quantityUnit: existing.quantity_unit,
      customsNotes: "",
      unitPrice: null,
      shippingCost: null,
      customsCost: null,
      currency: "OMR",
      purchaseDateExpected: null,
      expectedArrival: null,
      status: "planning",
      preferenceRemarks: existing.justification
        ? `From Purchase Requisition #${existing.id}: ${existing.justification}`
        : `From Purchase Requisition #${existing.id}`,
      notificationsMuted: false,
      createdBy: input.decidedBy,
    });
    productId = product.id;
  }

  await query(
    `UPDATE purchase_requisitions SET status = $1, decided_by = $2, decided_at = now(), product_id = $3 WHERE id = $4`,
    [input.status, input.decidedBy, productId, id]
  );
  return getRequisitionById(id);
}
