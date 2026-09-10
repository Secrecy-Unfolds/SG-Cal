import { formatMuscatDateOnly, formatMuscatDateTime } from "@/lib/time";

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
