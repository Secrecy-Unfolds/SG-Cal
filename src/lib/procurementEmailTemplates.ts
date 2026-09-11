import type { ProductRow, ProductVendorRow } from "@/lib/procurement";
import { escapeHtml, introText, wrap } from "@/lib/emailShell";
import { computeCapitalNeeded, formatDateOnly, formatMoney, PROCUREMENT_STATUS_LABELS } from "@/lib/procurementDisplay";

const PRODUCT_COLOR = "#3b5bdb";
const VENDOR_COLOR = "#0f766e";

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
