import { toMuscatDateInput } from "@/lib/time";

// Client-safe (no server-only imports) helpers for the start-date
// hierarchy: Strategy.start_date <= Milestone.start_date <= Stage.start_date
// <= a step's own date. A "floor" is the latest start date among a node's
// ancestors — the earliest date this node is allowed to start on. `label`
// names which ancestor set it, for error messages ("Stage \"X\"").
export type StartFloor = { date: string; label: string } | null;

export function todayMuscat(): string {
  return toMuscatDateInput(new Date());
}

// What a brand-new child's start date pre-fills with: today, unless the
// parent hasn't started yet, in which case the parent's own start — never
// earlier than the floor.
export function defaultStartDate(floor: StartFloor): string {
  const today = todayMuscat();
  return floor && floor.date > today ? floor.date : today;
}

export function startBeforeFloorMessage(what: string, floor: NonNullable<StartFloor>): string {
  return `${what} can't start before ${floor.date} — the start of ${floor.label}`;
}

export function startAfterDescendantsMessage(what: string, newStart: string, earliest: string): string {
  return `${what} can't start on ${newStart}: something inside it already starts on ${earliest}. Move or edit that first.`;
}

// Whole days from `fromDate` to `toDate` ("YYYY-MM-DD" each; negative if
// toDate is earlier). Muscat has no DST, so whole days in UTC are exact.
export function daysBetweenDates(fromDate: string, toDate: string): number {
  const toUtc = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((toUtc(toDate) - toUtc(fromDate)) / 86_400_000);
}
