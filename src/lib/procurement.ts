import { query } from "@/lib/db";
import type { ProcurementStatus } from "@/lib/procurementDisplay";

// Single source of truth lives in procurementDisplay.ts (client-safe — no
// server-only imports), so client components can use it directly without
// pulling in `pg`.
export type { ProcurementStatus } from "@/lib/procurementDisplay";
export {
  PROCUREMENT_STATUSES,
  PROCUREMENT_STATUS_LABELS,
  isProcurementStatus,
} from "@/lib/procurementDisplay";

export type VendorRow = {
  id: number;
  product_id: number;
  name: string;
  niche: string;
  country: string;
  pricing: string;
  payment_terms: string;
  quality_rating: number | null;
  delivery_period: string;
  warranty: string;
  created_at: Date;
};

export type ProductRow = {
  id: number;
  name: string;
  picture_url: string | null;
  description: string;
  required_for: string;
  required_by: string | null; // "YYYY-MM-DD"
  quantity_needed: number;
  quantity_unit: string;
  customs_notes: string;
  unit_price: string | null; // numeric comes back as a string from pg
  shipping_cost: string | null;
  customs_cost: string | null;
  currency: string;
  purchase_date_expected: string | null; // "YYYY-MM-DD"
  expected_arrival: string | null; // "YYYY-MM-DD"
  status: ProcurementStatus;
  preferred_vendor_id: number | null;
  preference_remarks: string;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
  updated_at: Date;
};

const PRODUCT_SELECT = `
  SELECT p.id, p.name, p.picture_url, p.description, p.required_for, p.required_by,
         p.quantity_needed, p.quantity_unit, p.customs_notes,
         p.unit_price, p.shipping_cost, p.customs_cost, p.currency,
         p.purchase_date_expected, p.expected_arrival, p.status,
         p.preferred_vendor_id, p.preference_remarks,
         p.created_by, u.username AS created_by_username, p.created_at, p.updated_at
  FROM procurement_products p
  LEFT JOIN users u ON u.id = p.created_by
`;

export async function listProducts(): Promise<ProductRow[]> {
  const res = await query<ProductRow>(`${PRODUCT_SELECT} ORDER BY p.created_at DESC`);
  return res.rows;
}

export async function getProductById(id: number): Promise<ProductRow | null> {
  const res = await query<ProductRow>(`${PRODUCT_SELECT} WHERE p.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function listVendorsForProduct(productId: number): Promise<VendorRow[]> {
  const res = await query<VendorRow>(
    `SELECT id, product_id, name, niche, country, pricing, payment_terms,
            quality_rating, delivery_period, warranty, created_at
     FROM procurement_vendors WHERE product_id = $1 ORDER BY created_at ASC`,
    [productId]
  );
  return res.rows;
}

export async function getVendorById(id: number): Promise<VendorRow | null> {
  const res = await query<VendorRow>(
    `SELECT id, product_id, name, niche, country, pricing, payment_terms,
            quality_rating, delivery_period, warranty, created_at
     FROM procurement_vendors WHERE id = $1`,
    [id]
  );
  return res.rows[0] ?? null;
}

export type ProductInput = {
  name: string;
  pictureUrl: string | null;
  description: string;
  requiredFor: string;
  requiredBy: string | null; // "YYYY-MM-DD"
  quantityNeeded: number;
  quantityUnit: string;
  customsNotes: string;
  unitPrice: number | null;
  shippingCost: number | null;
  customsCost: number | null;
  currency: string;
  purchaseDateExpected: string | null; // "YYYY-MM-DD"
  expectedArrival: string | null; // "YYYY-MM-DD"
  status: ProcurementStatus;
  preferenceRemarks: string;
};

export async function createProduct(
  input: ProductInput & { createdBy: number }
): Promise<ProductRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO procurement_products
       (name, picture_url, description, required_for, required_by, quantity_needed, quantity_unit,
        customs_notes, unit_price, shipping_cost, customs_cost, currency, purchase_date_expected,
        expected_arrival, status, preference_remarks, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id`,
    [
      input.name,
      input.pictureUrl,
      input.description,
      input.requiredFor,
      input.requiredBy,
      input.quantityNeeded,
      input.quantityUnit,
      input.customsNotes,
      input.unitPrice,
      input.shippingCost,
      input.customsCost,
      input.currency,
      input.purchaseDateExpected,
      input.expectedArrival,
      input.status,
      input.preferenceRemarks,
      input.createdBy,
    ]
  );
  const created = await getProductById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created product");
  return created;
}

export async function updateProduct(
  id: number,
  input: ProductInput & { preferredVendorId: number | null }
): Promise<ProductRow | null> {
  await query(
    `UPDATE procurement_products
     SET name = $1, picture_url = $2, description = $3, required_for = $4, required_by = $5,
         quantity_needed = $6, quantity_unit = $7, customs_notes = $8, unit_price = $9,
         shipping_cost = $10, customs_cost = $11, currency = $12, purchase_date_expected = $13,
         expected_arrival = $14, status = $15, preference_remarks = $16, preferred_vendor_id = $17,
         updated_at = now()
     WHERE id = $18`,
    [
      input.name,
      input.pictureUrl,
      input.description,
      input.requiredFor,
      input.requiredBy,
      input.quantityNeeded,
      input.quantityUnit,
      input.customsNotes,
      input.unitPrice,
      input.shippingCost,
      input.customsCost,
      input.currency,
      input.purchaseDateExpected,
      input.expectedArrival,
      input.status,
      input.preferenceRemarks,
      input.preferredVendorId,
      id,
    ]
  );
  return getProductById(id);
}

export async function deleteProduct(id: number): Promise<void> {
  await query(`DELETE FROM procurement_products WHERE id = $1`, [id]);
}

export type VendorInput = {
  name: string;
  niche: string;
  country: string;
  pricing: string;
  paymentTerms: string;
  qualityRating: number | null;
  deliveryPeriod: string;
  warranty: string;
};

export async function createVendor(productId: number, input: VendorInput): Promise<VendorRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO procurement_vendors
       (product_id, name, niche, country, pricing, payment_terms, quality_rating, delivery_period, warranty)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      productId,
      input.name,
      input.niche,
      input.country,
      input.pricing,
      input.paymentTerms,
      input.qualityRating,
      input.deliveryPeriod,
      input.warranty,
    ]
  );
  const created = await getVendorById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created vendor");
  return created;
}

export async function updateVendor(id: number, input: VendorInput): Promise<VendorRow | null> {
  await query(
    `UPDATE procurement_vendors
     SET name = $1, niche = $2, country = $3, pricing = $4, payment_terms = $5,
         quality_rating = $6, delivery_period = $7, warranty = $8
     WHERE id = $9`,
    [
      input.name,
      input.niche,
      input.country,
      input.pricing,
      input.paymentTerms,
      input.qualityRating,
      input.deliveryPeriod,
      input.warranty,
      id,
    ]
  );
  return getVendorById(id);
}

export async function deleteVendor(id: number): Promise<void> {
  await query(`DELETE FROM procurement_vendors WHERE id = $1`, [id]);
}
