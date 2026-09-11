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
