// Client-safe Process/Strategy/Idea constants/types — no server-only
// imports (mirrors eventDisplay.ts's split from events.ts).

export type PlanType = "process" | "strategy" | "idea";

export const PLAN_TYPES: PlanType[] = ["process", "strategy", "idea"];

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  process: "Process",
  strategy: "Strategy",
  idea: "Idea",
};

export function isPlanType(value: unknown): value is PlanType {
  return PLAN_TYPES.includes(value as PlanType);
}

// done/not-done plus Blocked/Skipped/N/A (confirmed 2026-09-18/19) —
// Skipped/N/A satisfy downstream prerequisites but are excluded from the
// progress percentage (see lib/planSteps.ts / lib/planProgress.ts).
export type StepStatus = "pending" | "done" | "blocked" | "skipped" | "na";

export const STEP_STATUSES: StepStatus[] = ["pending", "done", "blocked", "skipped", "na"];

export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  pending: "Pending",
  done: "Done",
  blocked: "Blocked",
  skipped: "Skipped",
  na: "N/A",
};

export function isStepStatus(value: unknown): value is StepStatus {
  return STEP_STATUSES.includes(value as StepStatus);
}

export const STEP_STATUS_BADGE_CLASS: Record<StepStatus, string> = {
  pending: "bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50",
  done: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
  blocked: "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300",
  skipped: "bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40",
  na: "bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40",
};

// Why a step's "mark done" is currently disabled, mirrored client-side
// from the same gate lib/planSteps.ts's status-transition route enforces
// server-side (the API call remains the actual authority — this is only
// used to explain/disable the checkbox proactively).
export type StepDoneBlockReason = "prerequisite_unmet" | "deliverable_incomplete" | "milestone_prerequisite_unmet";

export const STEP_DONE_BLOCK_REASON_LABELS: Record<StepDoneBlockReason, string> = {
  prerequisite_unmet: "Waiting on a prerequisite step",
  deliverable_incomplete: "Deliverable not filled in yet",
  milestone_prerequisite_unmet: "This Stage's Milestone is waiting on a prerequisite Milestone",
};

// Both helpers below only ever need a step's status — kept minimal so a
// plain aggregate query (list pages) can build these without joining in
// every step column.
export type StepStub = { status: StepStatus };

// Live prerequisite check — a step satisfies a downstream dependency once
// it's done, skipped, or n/a (confirmed 2026-09-18: skipped/na unblock
// downstream so the chain never permanently wedges; blocked does not).
export function prerequisitesSatisfied(
  prerequisiteSteps: StepStub[]
): boolean {
  return prerequisiteSteps.every((s) => s.status === "done" || s.status === "skipped" || s.status === "na");
}

// Live progress over one plan's/stage's own steps — skipped/na are
// excluded from both numerator and denominator (confirmed 2026-09-19),
// linear/equal weighting (confirmed 2026-09-18).
export function computeStepProgress(steps: StepStub[]): number {
  const counted = steps.filter((s) => s.status !== "skipped" && s.status !== "na");
  // No steps at all, or every step ended up skipped/na (nothing left that
  // could count as "done") — 0%, not a misleading 100%.
  if (counted.length === 0) return 0;
  const done = counted.filter((s) => s.status === "done").length;
  return Math.round((done / counted.length) * 100);
}
