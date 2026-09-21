export type ProcurementStatus = "planning" | "ordered" | "in_transit" | "received" | "cancelled";

export const PROCUREMENT_STATUSES: ProcurementStatus[] = [
  "planning",
  "ordered",
  "in_transit",
  "received",
  "cancelled",
];

export const PROCUREMENT_STATUS_LABELS: Record<ProcurementStatus, string> = {
  planning: "Planning",
  ordered: "Ordered",
  in_transit: "In Transit / Customs",
  received: "Received",
  cancelled: "Cancelled",
};

export function isProcurementStatus(value: unknown): value is ProcurementStatus {
  return PROCUREMENT_STATUSES.includes(value as ProcurementStatus);
}

export const PROCUREMENT_STATUS_BADGE_CLASS: Record<ProcurementStatus, string> = {
  planning: "bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60",
  ordered: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  in_transit: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
  received: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
  cancelled: "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300",
};

// v2 Procurement workflow Phase 2 — RFQ status per product-vendor link,
// distinct from the offering data itself. null (not in this union) means
// no RFQ has been sent yet.
export type RfqStatus = "requested" | "quoted" | "declined";

export const RFQ_STATUSES: RfqStatus[] = ["requested", "quoted", "declined"];

export const RFQ_STATUS_LABELS: Record<RfqStatus, string> = {
  requested: "RFQ sent",
  quoted: "Quoted",
  declined: "Declined",
};

export const RFQ_STATUS_BADGE_CLASS: Record<RfqStatus, string> = {
  requested: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
  quoted: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
  declined: "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300",
};

export function isRfqStatus(value: unknown): value is RfqStatus {
  return RFQ_STATUSES.includes(value as RfqStatus);
}

// Capital needed is derived, not typed in directly: unit price * quantity,
// plus shipping and customs cost. Missing pieces count as 0 so a partial
// estimate still shows something useful.
export function computeCapitalNeeded(input: {
  unitPrice: string | number | null;
  quantityNeeded: number;
  shippingCost: string | number | null;
  customsCost: string | number | null;
}): number {
  const toNumber = (v: string | number | null) => {
    if (v === null || v === "") return 0;
    const n = typeof v === "string" ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : 0;
  };
  return toNumber(input.unitPrice) * input.quantityNeeded + toNumber(input.shippingCost) + toNumber(input.customsCost);
}

export function formatMoney(amount: string | number | null, currency: string): string {
  if (amount === null || amount === "") return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

// DATE columns have no time-of-day component — format using UTC so the
// calendar date shown always matches what's stored, regardless of the
// viewer's own timezone (otherwise a viewer behind UTC could see it roll
// back a day).
export function formatDateOnly(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

// A vendor's website, as entered: '' (none) or a URL. A missing scheme gets
// "https://" prepended, and only http/https is accepted — the value is
// rendered as a clickable link, so anything else (javascript:, data:, ...)
// must never be stored. Returns null when the input isn't a usable URL.
export function normalizeWebsite(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// Vendor documents (company profile, catalogue, ...) — a fixed category list
// rather than free text so they group/filter consistently.
export const VENDOR_DOCUMENT_CATEGORIES = [
  "company_profile",
  "product_catalogue",
  "price_list",
  "certificate",
  "contract",
  "other",
] as const;
export type VendorDocumentCategory = (typeof VENDOR_DOCUMENT_CATEGORIES)[number];

export const VENDOR_DOCUMENT_CATEGORY_LABELS: Record<VendorDocumentCategory, string> = {
  company_profile: "Company profile",
  product_catalogue: "Product catalogue",
  price_list: "Price list",
  certificate: "Certificate",
  contract: "Contract",
  other: "Other",
};

export function isVendorDocumentCategory(value: unknown): value is VendorDocumentCategory {
  return VENDOR_DOCUMENT_CATEGORIES.includes(value as VendorDocumentCategory);
}

export type VendorDocumentRow = {
  id: number;
  vendor_id: number;
  category: VendorDocumentCategory;
  blob_url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by_username: string | null;
  uploaded_at: string; // ISO
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
