// Client-safe notification-category constants/types — no server-only
// imports. Cross-cutting/platform's "per-user notification preferences" —
// confirmed 2026-09-18 via `AskUserQuestion`: per-module opt-out, matching
// how recipients are already grouped across the app's mailer helper calls,
// not a single global on/off switch.

export type NotificationCategory =
  | "procurement"
  | "accounting"
  | "inventory"
  | "hr"
  | "ideas"
  | "calendar"
  | "digests";

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "procurement",
  "accounting",
  "inventory",
  "hr",
  "ideas",
  "calendar",
  "digests",
];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  procurement: "Procurement",
  accounting: "Accounting",
  inventory: "Inventory",
  hr: "HR",
  // v3 Phase 1: the "ideas" module was rebuilt into Process/Strategy/Idea
  // plans — the internal key/union member is kept unchanged (zero
  // notification_preferences row migration needed, see
  // docs/erp-v3-roadmap.md), only this user-facing label changed.
  ideas: "Plans & Strategy",
  calendar: "Calendar (meetings/tasks with no specific attendees, task reminders)",
  digests: "Daily/weekly digest emails",
};

export const NOTIFICATION_CATEGORY_DESCRIPTIONS: Record<NotificationCategory, string> = {
  procurement: "Product, vendor, purchase order, requisition, and RFQ notifications.",
  accounting: "Manual and auto-posted transaction notifications.",
  inventory: "Inventory item created/updated/deleted notifications.",
  hr: "Leave request submitted notifications (admin-level).",
  ideas: "Plan (Process/Strategy/Idea) created/updated/deleted notifications.",
  calendar: "Meeting/task emails that broadcast to everyone (no specific attendee list), plus task-due-soon reminders sent to admin-level accounts.",
  digests: "The daily and weekly upcoming-events digest emails.",
};

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return NOTIFICATION_CATEGORIES.includes(value as NotificationCategory);
}
