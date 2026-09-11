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

// Vendor identity (name/country/niche) is global — the same vendor can be
// linked to several products. Each product's offering for a vendor
// (pricing/terms/rating/delivery/warranty) lives on the join row instead —
// see ProductVendorRow below.
export type VendorRow = {
  id: number;
  name: string;
  country: string;
  niche: string;
  created_at: Date;
};

// One row = one vendor's offering on one product (procurement_product_vendors
// joined with its vendor's identity, denormalized for display).
export type ProductVendorRow = {
  id: number;
  product_id: number;
  vendor_id: number;
  name: string;
  country: string;
  niche: string;
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

const PRODUCT_VENDOR_SELECT = `
  SELECT pv.id, pv.product_id, pv.vendor_id, v.name, v.country, v.niche,
         pv.pricing, pv.payment_terms, pv.quality_rating, pv.delivery_period,
         pv.warranty, pv.created_at
  FROM procurement_product_vendors pv
  JOIN procurement_vendors v ON v.id = pv.vendor_id
`;

export async function listVendorsForProduct(productId: number): Promise<ProductVendorRow[]> {
  const res = await query<ProductVendorRow>(
    `${PRODUCT_VENDOR_SELECT} WHERE pv.product_id = $1 ORDER BY pv.created_at ASC`,
    [productId]
  );
  return res.rows;
}

export async function getProductVendorById(id: number): Promise<ProductVendorRow | null> {
  const res = await query<ProductVendorRow>(`${PRODUCT_VENDOR_SELECT} WHERE pv.id = $1`, [id]);
  return res.rows[0] ?? null;
}

// Whether vendorId is linked to productId — used to validate a product's
// preferred_vendor_id actually points at one of its own linked vendors.
export async function productHasVendor(productId: number, vendorId: number): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM procurement_product_vendors WHERE product_id = $1 AND vendor_id = $2`,
    [productId, vendorId]
  );
  return res.rows.length > 0;
}

export async function searchVendors(q: string): Promise<VendorRow[]> {
  const res = await query<VendorRow>(
    `SELECT id, name, country, niche, created_at FROM procurement_vendors
     WHERE name ILIKE '%' || $1 || '%' ORDER BY name ASC LIMIT 10`,
    [q]
  );
  return res.rows;
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

export type VendorIdentityInput = {
  name: string;
  country: string;
  niche: string;
};

export type VendorOfferingInput = {
  pricing: string;
  paymentTerms: string;
  qualityRating: number | null;
  deliveryPeriod: string;
  warranty: string;
};

export async function createVendor(input: VendorIdentityInput): Promise<VendorRow> {
  const res = await query<VendorRow>(
    `INSERT INTO procurement_vendors (name, country, niche)
     VALUES ($1,$2,$3)
     RETURNING id, name, country, niche, created_at`,
    [input.name, input.country, input.niche]
  );
  return res.rows[0];
}

// Thrown when a vendor is already linked to this product (unique_violation on
// procurement_product_vendors' (product_id, vendor_id) constraint).
export class VendorAlreadyLinkedError extends Error {}

export async function linkVendorToProduct(
  productId: number,
  vendorId: number,
  offering: VendorOfferingInput
): Promise<ProductVendorRow> {
  let joinId: number;
  try {
    const res = await query<{ id: number }>(
      `INSERT INTO procurement_product_vendors
         (product_id, vendor_id, pricing, payment_terms, quality_rating, delivery_period, warranty)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        productId,
        vendorId,
        offering.pricing,
        offering.paymentTerms,
        offering.qualityRating,
        offering.deliveryPeriod,
        offering.warranty,
      ]
    );
    joinId = res.rows[0].id;
  } catch (err: any) {
    if (err?.code === "23505") throw new VendorAlreadyLinkedError();
    throw err;
  }
  const created = await getProductVendorById(joinId);
  if (!created) throw new Error("Failed to load created product-vendor link");
  return created;
}

export async function updateProductVendorOffering(
  id: number,
  offering: VendorOfferingInput
): Promise<ProductVendorRow | null> {
  await query(
    `UPDATE procurement_product_vendors
     SET pricing = $1, payment_terms = $2, quality_rating = $3, delivery_period = $4, warranty = $5
     WHERE id = $6`,
    [
      offering.pricing,
      offering.paymentTerms,
      offering.qualityRating,
      offering.deliveryPeriod,
      offering.warranty,
      id,
    ]
  );
  return getProductVendorById(id);
}

// Removes this product's link to the vendor only — the vendor's identity
// and its links to any other products are untouched. Since the vendor row
// itself isn't deleted, the preferred_vendor_id FK's ON DELETE SET NULL
// doesn't fire here, so clear it explicitly if this was the preferred vendor.
export async function unlinkVendorFromProduct(id: number): Promise<void> {
  const link = await getProductVendorById(id);
  await query(`DELETE FROM procurement_product_vendors WHERE id = $1`, [id]);
  if (link) {
    await query(
      `UPDATE procurement_products SET preferred_vendor_id = NULL WHERE id = $1 AND preferred_vendor_id = $2`,
      [link.product_id, link.vendor_id]
    );
  }
}
