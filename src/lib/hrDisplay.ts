// Client-safe HR constants/types — no server-only imports, so client
// components can use these directly. Same reason eventDisplay.ts and
// procurementDisplay.ts exist (see the "recurring pattern" note in
// docs/project-structure.md): lib/hr.ts imports `query` from lib/db.ts,
// which pulls in the Node-only `pg` driver.

export type LeaveStatus = "pending" | "approved" | "rejected";

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const LEAVE_STATUS_BADGE_CLASS: Record<LeaveStatus, string> = {
  pending: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  approved: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
  rejected: "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300",
};

export function isLeaveStatus(value: unknown): value is LeaveStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}
