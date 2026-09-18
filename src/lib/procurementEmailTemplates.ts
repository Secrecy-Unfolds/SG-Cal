import type { ProductRow, ProductVendorRow, VendorRow } from "@/lib/procurement";
import type { PurchaseRequisitionRow } from "@/lib/purchaseRequisitions";
import { escapeHtml, introText, wrap } from "@/lib/emailShell";
import { computeCapitalNeeded, formatDateOnly, formatMoney, PROCUREMENT_STATUS_LABELS } from "@/lib/procurementDisplay";

const PRODUCT_COLOR = "#3b5bdb";
const VENDOR_COLOR = "#0f766e";
const REQUISITION_COLOR = "#9333ea";

function requisitionCard(r: PurchaseRequisitionRow): string {
  const details = [
    `Quantity: <strong>${r.quantity_needed} ${escapeHtml(r.quantity_unit)}</strong>`,
    r.justification ? `Justification: <strong>${escapeHtml(r.justification)}</strong>` : null,
  ]
    .filter(Boolean)
    .join(" &middot; ");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:4px; background:${REQUISITION_COLOR}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(r.product_name)}</div>
          <div style="font-size:12px; color:#6b7280; margin-top:4px; line-height:1.6;">${details || "No further details"}</div>
        </td>
      </tr>
    </table>`;
}

// Sent to Admin-level when a requisition needs a decision — mirrors
// expenseApprovalNeededEmail's shape (accountingEmailTemplates.ts).
export function requisitionSubmittedEmail(r: PurchaseRequisitionRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `Purchase requisition needs a decision: ${r.product_name}`,
    html: wrap(
      `${whoSafe} submitted a purchase requisition for "${r.product_name}"`,
      "Requisition needs a decision",
      introText(`${whoSafe} submitted this requisition, which needs an Admin-level decision:`) + requisitionCard(r)
    ),
  };
}

// Sent TO the vendor's own email — the app's first outbound email to an
// external, non-account recipient rather than an internal Admin-level
// account. Tone is a business request, not an internal "X did Y" notice.
export function rfqEmail(
  product: ProductRow,
  vendor: ProductVendorRow,
  fromWho: string
): { subject: string; html: string } {
  const details = [
    `Quantity needed: <strong>${product.quantity_needed} ${escapeHtml(product.quantity_unit)}</strong>`,
    product.required_by ? `Needed by: <strong>${formatDateOnly(product.required_by)}</strong>` : null,
  ]
    .filter(Boolean)
    .join(" &middot; ");
  const desc = product.description?.trim()
    ? `<div style="margin-top:8px; font-size:13px; line-height:1.5; color:#4b5563; white-space:pre-wrap;">${escapeHtml(
        product.description
      )}</div>`
    : "";

  return {
    subject: `Request for Quotation: ${product.name}`,
    html: wrap(
      `Request for a quotation on "${product.name}"`,
      "Request for Quotation",
      introText(
        `${escapeHtml(fromWho)} is requesting a quotation from ${escapeHtml(vendor.name)} for the following:`
      ) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
          <tr>
            <td style="width:4px; background:${VENDOR_COLOR}; border-radius:4px; font-size:0;">&nbsp;</td>
            <td style="padding:2px 0 12px 14px;">
              <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(product.name)}</div>
              <div style="font-size:12px; color:#6b7280; margin-top:4px; line-height:1.6;">${details}</div>
              ${desc}
            </td>
          </tr>
        </table>` +
        introText("Please reply to this email with your quotation (pricing, payment terms, delivery period, and warranty).")
    ),
  };
}

export function requisitionDecidedEmail(r: PurchaseRequisitionRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  const verb = r.status === "approved" ? "approved" : "rejected";
  return {
    subject: `Requisition ${verb}: ${r.product_name}`,
    html: wrap(
      `${whoSafe} ${verb} your requisition for "${r.product_name}"`,
      `Requisition ${verb}`,
      introText(
        `${whoSafe} ${verb} this requisition${
          r.status === "approved" ? " — it's now a Planning product" : ""
        }:`
      ) + requisitionCard(r)
    ),
  };
}

function productCard(product: ProductRow): string {
  const desc = product.description?.trim()
    ? `<div style="margin-top:8px; font-size:13px; line-height:1.5; color:#4b5563; white-space:pre-wrap;">${escapeHtml(
        product.description
      )}</div>`
    : "";
  const details = [
    `Status: <strong>${escapeHtml(PROCUREMENT_STATUS_LABELS[product.status])}</strong>`,
    product.required_for ? `Required for: <strong>${escapeHtml(product.required_for)}</strong>` : null,
    `Required by: <strong>${formatDateOnly(product.required_by)}</strong>`,
    `Quantity: <strong>${product.quantity_needed} ${escapeHtml(product.quantity_unit)}</strong>`,
    `Capital needed: <strong>${formatMoney(
      computeCapitalNeeded({
        unitPrice: product.unit_price,
        quantityNeeded: product.quantity_needed,
        shippingCost: product.shipping_cost,
        customsCost: product.customs_cost,
      }),
      product.currency
    )}</strong>`,
  ]
    .filter(Boolean)
    .join(" &middot; ");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:4px; background:${PRODUCT_COLOR}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(product.name)}</div>
          <div style="font-size:12px; color:#6b7280; margin-top:4px; line-height:1.6;">${details}</div>
          ${desc}
        </td>
      </tr>
    </table>`;
}

function vendorCard(vendor: ProductVendorRow): string {
  const details = [
    vendor.country ? `Country: <strong>${escapeHtml(vendor.country)}</strong>` : null,
    vendor.niche ? `Niche: <strong>${escapeHtml(vendor.niche)}</strong>` : null,
    vendor.pricing ? `Pricing: <strong>${escapeHtml(vendor.pricing)}</strong>` : null,
    vendor.payment_terms ? `Payment terms: <strong>${escapeHtml(vendor.payment_terms)}</strong>` : null,
    vendor.delivery_period ? `Delivery: <strong>${escapeHtml(vendor.delivery_period)}</strong>` : null,
    vendor.warranty ? `Warranty: <strong>${escapeHtml(vendor.warranty)}</strong>` : null,
    vendor.quality_rating ? `Quality: <strong>${"★".repeat(vendor.quality_rating)}</strong>` : null,
  ]
    .filter(Boolean)
    .join(" &middot; ");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:4px; background:${VENDOR_COLOR}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(vendor.name)}</div>
          <div style="font-size:12px; color:#6b7280; margin-top:4px; line-height:1.6;">${details || "No further details yet"}</div>
        </td>
      </tr>
    </table>`;
}

export function productCreatedEmail(product: ProductRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `New procurement item: ${product.name}`,
    html: wrap(
      `${whoSafe} added "${product.name}" to Procurement Planning`,
      "Procurement item added",
      introText(`${whoSafe} added a new product to Procurement Planning:`) + productCard(product)
    ),
  };
}

// Sent instead of productUpdatedEmail when this PUT's only meaningful
// change was which vendor is preferred — a "product updated" email with no
// vendor context buried the actual news. `vendor` is null when the
// preference was cleared rather than switched to another vendor.
export function preferredVendorChangedEmail(
  product: ProductRow,
  vendor: VendorRow | null,
  who: string
): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  const vendorName = vendor ? escapeHtml(vendor.name) : null;
  return {
    subject: vendorName
      ? `Preferred vendor for ${product.name}: ${vendorName}`
      : `Preferred vendor cleared for ${product.name}`,
    html: wrap(
      vendorName
        ? `${whoSafe} set "${vendorName}" as the preferred vendor for "${product.name}"`
        : `${whoSafe} cleared the preferred vendor for "${product.name}"`,
      "Preferred vendor changed",
      introText(
        vendorName
          ? `${whoSafe} marked "${vendorName}" as the preferred vendor for this product:`
          : `${whoSafe} cleared the preferred vendor for this product — it currently has none set:`
      ) + productCard(product)
    ),
  };
}

export function productUpdatedEmail(product: ProductRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `Updated procurement item: ${product.name}`,
    html: wrap(
      `${whoSafe} updated "${product.name}"`,
      "Procurement item updated",
      introText(`${whoSafe} made changes to this product. Here are the current details:`) + productCard(product)
    ),
  };
}

export function productDeletedEmail(product: ProductRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `Removed procurement item: ${product.name}`,
    html: wrap(
      `${whoSafe} removed "${product.name}" from Procurement Planning`,
      "Procurement item removed",
      introText(`${whoSafe} removed this product from Procurement Planning. It was:`) + productCard(product)
    ),
  };
}

export function vendorAddedEmail(
  product: ProductRow,
  vendor: ProductVendorRow,
  who: string
): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `New vendor for ${product.name}: ${vendor.name}`,
    html: wrap(
      `${whoSafe} added vendor "${vendor.name}" for "${product.name}"`,
      "Vendor added",
      introText(`${whoSafe} added a vendor option for "${product.name}":`) + vendorCard(vendor)
    ),
  };
}

export function vendorUpdatedEmail(
  product: ProductRow,
  vendor: ProductVendorRow,
  who: string
): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `Updated vendor for ${product.name}: ${vendor.name}`,
    html: wrap(
      `${whoSafe} updated vendor "${vendor.name}" for "${product.name}"`,
      "Vendor updated",
      introText(`${whoSafe} updated a vendor option for "${product.name}":`) + vendorCard(vendor)
    ),
  };
}

export function vendorDeletedEmail(
  product: ProductRow,
  vendor: ProductVendorRow,
  who: string
): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `Removed vendor for ${product.name}: ${vendor.name}`,
    html: wrap(
      `${whoSafe} removed vendor "${vendor.name}" from "${product.name}"`,
      "Vendor removed",
      introText(`${whoSafe} removed a vendor option from "${product.name}":`) + vendorCard(vendor)
    ),
  };
}
