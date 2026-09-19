import { query } from "@/lib/db";
import { computeStepProgress, type StepStatus } from "@/lib/planDisplay";

// "Compute live, don't store derived state" — same precedent as
// depreciation/capital-needed/invoice-balances elsewhere in this app (see
// docs/erp-v3-roadmap.md). A flat plan's (Process/Idea/Stage) progress is
// its own steps' progress; a Milestone's is the equal-weighted average of
// its Stages' progress; a Strategy's is the equal-weighted average of its
// Milestones' progress (confirmed 2026-09-18) — same shape reused at every
// level, `total`/`done` meaning "how many children" / "how many are fully
// at 100%" one level up from steps.
export type PlanProgress = { total: number; done: number; progress: number };

export async function getPlanProgress(planId: number): Promise<PlanProgress> {
  const map = await getPlanProgressForPlans([planId]);
  return map[planId] ?? { total: 0, done: 0, progress: 0 };
}

export async function getPlanProgressForPlans(planIds: number[]): Promise<Record<number, PlanProgress>> {
  const result: Record<number, PlanProgress> = {};
  for (const id of planIds) result[id] = { total: 0, done: 0, progress: 0 };
  if (planIds.length === 0) return result;

  const res = await query<{ plan_id: number; status: StepStatus }>(
    `SELECT plan_id, status FROM steps WHERE plan_id = ANY($1::int[])`,
    [planIds]
  );

  const grouped = new Map<number, { status: StepStatus }[]>();
  for (const row of res.rows) {
    const list = grouped.get(row.plan_id) ?? [];
    list.push({ status: row.status });
    grouped.set(row.plan_id, list);
  }

  for (const id of planIds) {
    const steps = grouped.get(id) ?? [];
    result[id] = {
      total: steps.length,
      done: steps.filter((s) => s.status === "done").length,
      progress: computeStepProgress(steps),
    };
  }
  return result;
}

function averageProgress(percentages: number[]): PlanProgress {
  if (percentages.length === 0) return { total: 0, done: 0, progress: 0 };
  const progress = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
  const done = percentages.filter((p) => p === 100).length;
  return { total: percentages.length, done, progress };
}

export async function getMilestoneProgress(milestoneId: number): Promise<PlanProgress> {
  const map = await getMilestoneProgressForMilestones([milestoneId]);
  return map[milestoneId] ?? { total: 0, done: 0, progress: 0 };
}

export async function getMilestoneProgressForMilestones(
  milestoneIds: number[]
): Promise<Record<number, PlanProgress>> {
  const result: Record<number, PlanProgress> = {};
  for (const id of milestoneIds) result[id] = { total: 0, done: 0, progress: 0 };
  if (milestoneIds.length === 0) return result;

  const stagesRes = await query<{ id: number; parent_milestone_id: number }>(
    `SELECT id, parent_milestone_id FROM plans WHERE parent_milestone_id = ANY($1::int[])`,
    [milestoneIds]
  );
  const stageProgress = await getPlanProgressForPlans(stagesRes.rows.map((r) => r.id));

  const byMilestone = new Map<number, number[]>();
  for (const row of stagesRes.rows) {
    const list = byMilestone.get(row.parent_milestone_id) ?? [];
    list.push(stageProgress[row.id].progress);
    byMilestone.set(row.parent_milestone_id, list);
  }
  for (const id of milestoneIds) {
    result[id] = averageProgress(byMilestone.get(id) ?? []);
  }
  return result;
}

export async function getStrategyProgress(strategyPlanId: number): Promise<PlanProgress> {
  const map = await getStrategyProgressForPlans([strategyPlanId]);
  return map[strategyPlanId] ?? { total: 0, done: 0, progress: 0 };
}

// Not batched across strategies at the SQL level (one round-trip per
// strategy via getMilestoneProgressForMilestones) — acceptable at this
// app's scale (an internal ERP tool, not a high-traffic one), and keeps
// this function a simple composition of the two lower-level ones above.
export async function getStrategyProgressForPlans(strategyPlanIds: number[]): Promise<Record<number, PlanProgress>> {
  const result: Record<number, PlanProgress> = {};
  for (const id of strategyPlanIds) result[id] = { total: 0, done: 0, progress: 0 };
  if (strategyPlanIds.length === 0) return result;

  const milestonesRes = await query<{ id: number; strategy_plan_id: number }>(
    `SELECT id, strategy_plan_id FROM milestones WHERE strategy_plan_id = ANY($1::int[])`,
    [strategyPlanIds]
  );
  const milestoneProgress = await getMilestoneProgressForMilestones(milestonesRes.rows.map((r) => r.id));

  const byStrategy = new Map<number, number[]>();
  for (const row of milestonesRes.rows) {
    const list = byStrategy.get(row.strategy_plan_id) ?? [];
    list.push(milestoneProgress[row.id].progress);
    byStrategy.set(row.strategy_plan_id, list);
  }
  for (const id of strategyPlanIds) {
    result[id] = averageProgress(byStrategy.get(id) ?? []);
  }
  return result;
}
