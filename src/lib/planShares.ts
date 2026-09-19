import { query } from "@/lib/db";
import { isAdminLevel, type UserRole } from "@/lib/users";

export type PlanShareUser = { id: number; username: string };

export async function listPlanShares(planId: number): Promise<PlanShareUser[]> {
  const res = await query<PlanShareUser>(
    `SELECT u.id, u.username FROM plan_shares ps JOIN users u ON u.id = ps.user_id
     WHERE ps.plan_id = $1 ORDER BY u.username ASC`,
    [planId]
  );
  return res.rows;
}

// Replaces a plan's full share list — mirrors setStepPrerequisites'
// delete-then-reinsert pattern in lib/planSteps.ts. `shared_by`'s
// placeholder index is reused across every row in the VALUES list since
// it's the same value for all of them (a single-request bulk share, not a
// truly per-recipient action).
export async function setPlanShares(planId: number, userIds: number[], sharedBy: number): Promise<void> {
  const uniqueIds = Array.from(new Set(userIds));
  await query(`DELETE FROM plan_shares WHERE plan_id = $1`, [planId]);
  if (uniqueIds.length > 0) {
    const values = uniqueIds.map((_, i) => `($1, $${i + 2}, $${uniqueIds.length + 2})`).join(", ");
    await query(`INSERT INTO plan_shares (plan_id, user_id, shared_by) VALUES ${values}`, [
      planId,
      ...uniqueIds,
      sharedBy,
    ]);
  }
}

// Every root-level plan_id (parent_milestone_id IS NULL) shared with this
// user — used to filter the top-level plans list for a non-Admin-level
// viewer.
export async function listSharedPlanIdsForUser(userId: number): Promise<number[]> {
  const res = await query<{ plan_id: number }>(`SELECT plan_id FROM plan_shares WHERE user_id = $1`, [userId]);
  return res.rows.map((r) => r.plan_id);
}

// A Stage/Milestone has no share row of its own — sharing always targets
// the root Strategy (or a standalone Process/Idea, which IS its own
// root). Walks a Stage's parent_milestone_id up to its Strategy's plan_id
// before checking; a standalone plan is already its own root.
async function resolveRootPlanId(planId: number): Promise<number> {
  const res = await query<{ parent_milestone_id: number | null }>(
    `SELECT parent_milestone_id FROM plans WHERE id = $1`,
    [planId]
  );
  const parentMilestoneId = res.rows[0]?.parent_milestone_id ?? null;
  if (parentMilestoneId === null) return planId;
  const msRes = await query<{ strategy_plan_id: number }>(
    `SELECT strategy_plan_id FROM milestones WHERE id = $1`,
    [parentMilestoneId]
  );
  return msRes.rows[0]?.strategy_plan_id ?? planId;
}

// Admin-level bypasses unconditionally (sees every plan); a plain user
// needs a plan_shares row for the plan's root Strategy/Process/Idea.
export async function canUserViewPlan(planId: number, userId: number, role: UserRole): Promise<boolean> {
  if (isAdminLevel(role)) return true;
  const rootId = await resolveRootPlanId(planId);
  const res = await query<{ user_id: number }>(
    `SELECT user_id FROM plan_shares WHERE plan_id = $1 AND user_id = $2`,
    [rootId, userId]
  );
  return res.rows.length > 0;
}
