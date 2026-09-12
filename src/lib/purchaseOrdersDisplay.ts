// Client-safe PO constants/types — no server-only imports. Deliberately its
// own type (not reusing procurementDisplay.ts's ProcurementStatus), even
// though the labels overlap conceptually — Procurement execution is a
// decoupled module from Procurement Planning.

export type POStatus = "ordered" | "in_transit" | "received" | "cancelled";

export const PO_STATUSES: POStatus[] = ["ordered", "in_transit", "received", "cancelled"];

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  ordered: "Ordered",
  in_transit: "In Transit/Customs",
  received: "Received",
  cancelled: "Cancelled",
};

export const PO_STATUS_BADGE_CLASS: Record<POStatus, string> = {
  ordered: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  in_transit: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
  received: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
  cancelled: "bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50",
};

export function isPOStatus(value: unknown): value is POStatus {
  return PO_STATUSES.includes(value as POStatus);
}
