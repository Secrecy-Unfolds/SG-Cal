import { query, withTransaction } from "@/lib/db";
import { earliestStartUnderMilestone, getFloorForMilestone, getFloorForStage } from "@/lib/planStartRules";
import { startAfterDescendantsMessage, startBeforeFloorMessage } from "@/lib/planTiming";

export type MilestoneRow = {
  id: number;
  strategy_plan_id: number;
  name: string;
  description: string;
  start_date: string | null; // "YYYY-MM-DD"
  sort_order: number;
  prerequisite_milestone_id: number | null;
  created_at: Date;
  updated_at: Date;
};

const MILESTONE_SELECT = `SELECT id, strategy_plan_id, name, description, start_date, sort_order, prerequisite_milestone_id, created_at, updated_at FROM milestones`;

export async function listMilestonesForStrategy(strategyPlanId: number): Promise<MilestoneRow[]> {
  const res = await query<MilestoneRow>(
    `${MILESTONE_SELECT} WHERE strategy_plan_id = $1 ORDER BY sort_order ASC, id ASC`,
    [strategyPlanId]
  );
  return res.rows;
}

export async function getMilestoneById(id: number): Promise<MilestoneRow | null> {
  const res = await query<MilestoneRow>(`${MILESTONE_SELECT} WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

// Milestone ordering reuses the exact same prerequisite mechanism as
// steps, one level up (confirmed 2026-09-18) — but a Milestone has at
// most ONE prerequisite (a chain, not a graph), so cycle detection is a
// simple chain walk rather than steps' full BFS.
async function chainReaches(startMilestoneId: number, targetMilestoneId: number): Promise<boolean> {
  let currentId: number | null = startMilestoneId;
  const visited = new Set<number>();
  while (currentId !== null) {
    const checkingId: number = currentId;
    if (checkingId === targetMilestoneId) return true;
    if (visited.has(checkingId)) break; // safety net against an already-corrupt chain
    visited.add(checkingId);
    const res = await query<{ prerequisite_milestone_id: number | null }>(
      `SELECT prerequisite_milestone_id FROM milestones WHERE id = $1`,
      [checkingId]
    );
    const nextId: number | null = res.rows[0]?.prerequisite_milestone_id ?? null;
    currentId = nextId;
  }
  return false;
}

async function validatePrerequisite(
  strategyPlanId: number,
  prerequisiteMilestoneId: number | null,
  selfId: number | null
): Promise<string | null> {
  if (prerequisiteMilestoneId === null) return null;
  if (prerequisiteMilestoneId === selfId) return "A milestone can't be its own prerequisite";
  const res = await query<{ id: number }>(`SELECT id FROM milestones WHERE id = $1 AND strategy_plan_id = $2`, [
    prerequisiteMilestoneId,
    strategyPlanId,
  ]);
  if (res.rows.length === 0) return "A prerequisite must be another milestone in the same Strategy";
  if (selfId !== null && (await chainReaches(prerequisiteMilestoneId, selfId))) {
    return "That prerequisite would create a circular dependency";
  }
  return null;
}

// A Milestone can't start before its Strategy does (Strategy.start_date <=
// Milestone.start_date <= Stage <= step — see lib/planStartRules.ts).
async function validateMilestoneStart(strategyPlanId: number, startDate: string | null): Promise<string | null> {
  if (!startDate) return null;
  const floor = await getFloorForMilestone(strategyPlanId);
  if (floor && startDate < floor.date) return startBeforeFloorMessage("A milestone", floor);
  return null;
}

export async function createMilestone(input: {
  strategyPlanId: number;
  name: string;
  description: string;
  startDate: string | null;
  prerequisiteMilestoneId: number | null;
  sortOrder: number;
}): Promise<{ ok: true; milestone: MilestoneRow } | { ok: false; error: string }> {
  const error = await validatePrerequisite(input.strategyPlanId, input.prerequisiteMilestoneId, null);
  if (error) return { ok: false, error };
  const startError = await validateMilestoneStart(input.strategyPlanId, input.startDate);
  if (startError) return { ok: false, error: startError };

  const res = await query<{ id: number }>(
    `INSERT INTO milestones (strategy_plan_id, name, description, start_date, prerequisite_milestone_id, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.strategyPlanId, input.name, input.description, input.startDate, input.prerequisiteMilestoneId, input.sortOrder]
  );
  const milestone = await getMilestoneById(res.rows[0].id);
  if (!milestone) throw new Error("Failed to load created milestone");
  return { ok: true, milestone };
}

export async function updateMilestone(
  id: number,
  input: { name: string; description: string; startDate: string | null; prerequisiteMilestoneId: number | null }
): Promise<{ ok: true; milestone: MilestoneRow } | { ok: false; error: string }> {
  const existing = await getMilestoneById(id);
  if (!existing) return { ok: false, error: "Not found" };

  const error = await validatePrerequisite(existing.strategy_plan_id, input.prerequisiteMilestoneId, id);
  if (error) return { ok: false, error };
  // Only re-checked when the start date actually changes, so a milestone
  // predating this rule can still be renamed/edited in place.
  if (input.startDate && input.startDate !== existing.start_date) {
    const startError = await validateMilestoneStart(existing.strategy_plan_id, input.startDate);
    if (startError) return { ok: false, error: startError };
    const earliest = await earliestStartUnderMilestone(id);
    if (earliest && earliest < input.startDate) {
      return { ok: false, error: startAfterDescendantsMessage("This milestone", input.startDate, earliest) };
    }
  }

  await query(
    `UPDATE milestones SET name = $1, description = $2, start_date = $3, prerequisite_milestone_id = $4, updated_at = now() WHERE id = $5`,
    [input.name, input.description, input.startDate, input.prerequisiteMilestoneId, id]
  );
  const milestone = await getMilestoneById(id);
  if (!milestone) throw new Error("Failed to load updated milestone");
  return { ok: true, milestone };
}

// Deleting a milestone cascades to delete its Stage plans
// (plans.parent_milestone_id ON DELETE CASCADE) and, through those, their
// steps (steps.plan_id ON DELETE CASCADE) — but not those steps' backing
// Calendar events (no reverse FK, same reason lib/plans.ts's deletePlan
// has to do this explicitly). Clean those up first, in one transaction.
export async function deleteMilestone(id: number): Promise<void> {
  await withTransaction(async (client) => {
    const stepEvents = await client.query<{ event_id: number }>(
      `SELECT s.event_id FROM steps s JOIN plans p ON p.id = s.plan_id WHERE p.parent_milestone_id = $1`,
      [id]
    );
    const eventIds = stepEvents.rows.map((r) => r.event_id);
    if (eventIds.length > 0) {
      await client.query(`DELETE FROM events WHERE id = ANY($1::int[])`, [eventIds]);
    }
    await client.query(`DELETE FROM milestones WHERE id = $1`, [id]);
  });
}

// A Stage IS a plan_type='process' row with parent_milestone_id set — not
// a 4th plan_type (see db/schema.sql's comment on `plans`). Listing a
// milestone's stages is therefore just plans filtered by parent_milestone_id,
// living here rather than lib/plans.ts since it's always reached through a
// milestone, never through the general plans list.
export type StagePlanRow = {
  id: number;
  name: string;
  description: string;
  start_date: string | null;
  prerequisite_stage_id: number | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

export async function listStagesForMilestone(milestoneId: number): Promise<StagePlanRow[]> {
  const res = await query<StagePlanRow>(
    `SELECT p.id, p.name, p.description, p.start_date, p.prerequisite_stage_id, p.created_by, u.username AS created_by_username, p.created_at
     FROM plans p LEFT JOIN users u ON u.id = p.created_by
     WHERE p.parent_milestone_id = $1
     ORDER BY p.created_at ASC`,
    [milestoneId]
  );
  return res.rows;
}

// A Stage can name ONE prerequisite sibling Stage (same milestone) —
// an ordering/graph edge only, not a done-gate (unlike a Milestone's
// prerequisite, which does gate — see lib/planSteps.ts). Same chain-walk
// cycle check as milestones.
async function stageChainReaches(startStageId: number, targetStageId: number): Promise<boolean> {
  let currentId: number | null = startStageId;
  const visited = new Set<number>();
  while (currentId !== null) {
    const checkingId: number = currentId;
    if (checkingId === targetStageId) return true;
    if (visited.has(checkingId)) break;
    visited.add(checkingId);
    const res = await query<{ prerequisite_stage_id: number | null }>(
      `SELECT prerequisite_stage_id FROM plans WHERE id = $1`,
      [checkingId]
    );
    const nextId: number | null = res.rows[0]?.prerequisite_stage_id ?? null;
    currentId = nextId;
  }
  return false;
}

export async function validateStagePrerequisite(
  milestoneId: number,
  prerequisiteStageId: number | null,
  selfId: number | null
): Promise<string | null> {
  if (prerequisiteStageId === null) return null;
  if (prerequisiteStageId === selfId) return "A stage can't be its own prerequisite";
  const res = await query<{ id: number }>(`SELECT id FROM plans WHERE id = $1 AND parent_milestone_id = $2`, [
    prerequisiteStageId,
    milestoneId,
  ]);
  if (res.rows.length === 0) return "A prerequisite must be another stage in the same milestone";
  if (selfId !== null && (await stageChainReaches(prerequisiteStageId, selfId))) {
    return "That prerequisite would create a circular dependency";
  }
  return null;
}

export async function createStage(input: {
  milestoneId: number;
  name: string;
  description: string;
  startDate: string | null;
  prerequisiteStageId: number | null;
  createdBy: number;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const prereqError = await validateStagePrerequisite(input.milestoneId, input.prerequisiteStageId, null);
  if (prereqError) return { ok: false, error: prereqError };
  if (input.startDate) {
    const floor = await getFloorForStage(input.milestoneId);
    if (floor && input.startDate < floor.date) {
      return { ok: false, error: startBeforeFloorMessage("A stage", floor) };
    }
  }

  const res = await query<{ id: number }>(
    `INSERT INTO plans (plan_type, parent_milestone_id, name, description, start_date, prerequisite_stage_id, created_by)
     VALUES ('process', $1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.milestoneId, input.name, input.description, input.startDate, input.prerequisiteStageId, input.createdBy]
  );
  return { ok: true, id: res.rows[0].id };
}

// Every Strategy with its Milestones — the picker data for "Add to
// Strategy" on a standalone Process (a Stage always lives inside one).
export type StrategyTarget = {
  id: number;
  name: string;
  start_date: string | null;
  milestones: { id: number; name: string; start_date: string | null }[];
};

export async function listStrategyTargets(): Promise<StrategyTarget[]> {
  const strategies = await query<{ id: number; name: string; start_date: string | null }>(
    `SELECT id, name, start_date FROM plans WHERE plan_type = 'strategy' AND parent_milestone_id IS NULL ORDER BY name ASC`
  );
  if (strategies.rows.length === 0) return [];
  const milestones = await query<{ id: number; name: string; start_date: string | null; strategy_plan_id: number }>(
    `SELECT id, name, start_date, strategy_plan_id FROM milestones
     WHERE strategy_plan_id = ANY($1::int[]) ORDER BY sort_order ASC, id ASC`,
    [strategies.rows.map((s) => s.id)]
  );
  return strategies.rows.map((s) => ({
    ...s,
    milestones: milestones.rows
      .filter((m) => m.strategy_plan_id === s.id)
      .map((m) => ({ id: m.id, name: m.name, start_date: m.start_date })),
  }));
}
