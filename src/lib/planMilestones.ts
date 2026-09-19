import { query, withTransaction } from "@/lib/db";

export type MilestoneRow = {
  id: number;
  strategy_plan_id: number;
  name: string;
  description: string;
  sort_order: number;
  prerequisite_milestone_id: number | null;
  created_at: Date;
  updated_at: Date;
};

const MILESTONE_SELECT = `SELECT id, strategy_plan_id, name, description, sort_order, prerequisite_milestone_id, created_at, updated_at FROM milestones`;

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

export async function createMilestone(input: {
  strategyPlanId: number;
  name: string;
  description: string;
  prerequisiteMilestoneId: number | null;
  sortOrder: number;
}): Promise<{ ok: true; milestone: MilestoneRow } | { ok: false; error: string }> {
  const error = await validatePrerequisite(input.strategyPlanId, input.prerequisiteMilestoneId, null);
  if (error) return { ok: false, error };

  const res = await query<{ id: number }>(
    `INSERT INTO milestones (strategy_plan_id, name, description, prerequisite_milestone_id, sort_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.strategyPlanId, input.name, input.description, input.prerequisiteMilestoneId, input.sortOrder]
  );
  const milestone = await getMilestoneById(res.rows[0].id);
  if (!milestone) throw new Error("Failed to load created milestone");
  return { ok: true, milestone };
}

export async function updateMilestone(
  id: number,
  input: { name: string; description: string; prerequisiteMilestoneId: number | null }
): Promise<{ ok: true; milestone: MilestoneRow } | { ok: false; error: string }> {
  const existing = await getMilestoneById(id);
  if (!existing) return { ok: false, error: "Not found" };

  const error = await validatePrerequisite(existing.strategy_plan_id, input.prerequisiteMilestoneId, id);
  if (error) return { ok: false, error };

  await query(
    `UPDATE milestones SET name = $1, description = $2, prerequisite_milestone_id = $3, updated_at = now() WHERE id = $4`,
    [input.name, input.description, input.prerequisiteMilestoneId, id]
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
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

export async function listStagesForMilestone(milestoneId: number): Promise<StagePlanRow[]> {
  const res = await query<StagePlanRow>(
    `SELECT p.id, p.name, p.description, p.start_date, p.created_by, u.username AS created_by_username, p.created_at
     FROM plans p LEFT JOIN users u ON u.id = p.created_by
     WHERE p.parent_milestone_id = $1
     ORDER BY p.created_at ASC`,
    [milestoneId]
  );
  return res.rows;
}

export async function createStage(input: {
  milestoneId: number;
  name: string;
  description: string;
  startDate: string | null;
  createdBy: number;
}): Promise<{ id: number }> {
  const res = await query<{ id: number }>(
    `INSERT INTO plans (plan_type, parent_milestone_id, name, description, start_date, created_by)
     VALUES ('process', $1, $2, $3, $4, $5) RETURNING id`,
    [input.milestoneId, input.name, input.description, input.startDate, input.createdBy]
  );
  return res.rows[0];
}
