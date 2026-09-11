import { formatMuscatDateOnly, formatMuscatDateTime } from "@/lib/time";

export type TaskStatus = "backlog" | "pending" | "in_progress" | "review_needed" | "closed";

export const TASK_STATUSES: TaskStatus[] = ["backlog", "pending", "in_progress", "review_needed", "closed"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  pending: "Pending",
  in_progress: "In Progress",
  review_needed: "Review Needed",
  closed: "Closed",
};

export function isTaskStatus(value: unknown): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

export const TASK_STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  backlog: "bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50",
  pending: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  in_progress: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
  review_needed: "bg-violet-500/10 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300",
  closed: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
};

export type DisplayEvent = {
  type: "meeting" | "task";
  is_tentative: boolean;
  start_at: string;
  end_at: string | null;
};

export function eventTypeLabel(ev: DisplayEvent): string {
  if (ev.type === "task") return "Task";
  return ev.is_tentative ? "Tentative meeting" : "Meeting";
}

export function eventBadgeClass(ev: DisplayEvent): string {
  if (ev.type === "task") return "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300";
  if (ev.is_tentative) return "bg-violet-500/10 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300";
  return "bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300";
}

export function formatEventWhen(ev: DisplayEvent): string {
  if (ev.is_tentative) {
    const from = formatMuscatDateOnly(new Date(ev.start_at));
    const to = ev.end_at ? formatMuscatDateOnly(new Date(ev.end_at)) : from;
    return from === to ? `Tentative — possibly ${from}` : `Tentative — sometime between ${from} and ${to}`;
  }
  const when = formatMuscatDateTime(new Date(ev.start_at));
  const endPart = ev.end_at ? ` – ${formatMuscatDateTime(new Date(ev.end_at))}` : "";
  return `${when}${endPart}`;
}

export type CurrentUser = { uid: number; role: "user" | "admin" | "super_admin" };

// Mirrors the server-side canEditTask in lib/events.ts, without needing a DB
// round-trip — used to show/hide the Edit button before the user even tries.
export function canEditEvent(
  currentUser: CurrentUser | null,
  ev: { type: "meeting" | "task"; assignee_id: number | null }
): boolean {
  if (!currentUser) return false;
  if (ev.type !== "task") return true;
  if (currentUser.role !== "user") return true;
  return ev.assignee_id === null || ev.assignee_id === currentUser.uid;
}
