// Client-safe Invoice constants/types — no server-only imports.

export type InvoiceStatus = "draft" | "sent" | "paid";

export const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid"];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
};

export const INVOICE_STATUS_BADGE_CLASS: Record<InvoiceStatus, string> = {
  draft: "bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50",
  sent: "bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300",
  paid: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
};

export function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return INVOICE_STATUSES.includes(value as InvoiceStatus);
}

// "Overdue" is a display-only derived state (status is still 'sent'
// underneath) — nothing flips a stored status for it, matching the app's
// "compute live, don't store derived state" convention. See
// lib/invoices.ts's IssuedInvoiceRow.
export function isInvoiceOverdue(status: InvoiceStatus, dueDate: string | null, todayKey: string): boolean {
  return status === "sent" && dueDate !== null && dueDate < todayKey;
}
