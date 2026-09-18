// Client-safe Purchase Requisition constants/types — no server-only imports.

export type RequisitionStatus = "pending" | "approved" | "rejected";

export function isRequisitionStatus(value: unknown): value is RequisitionStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

export const REQUISITION_STATUS_LABELS: Record<RequisitionStatus, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const REQUISITION_STATUS_BADGE_CLASS: Record<RequisitionStatus, string> = {
  pending: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  approved: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
  rejected: "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300",
};
