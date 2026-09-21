import { query } from "@/lib/db";
import type { StartFloor } from "@/lib/planTiming";

// Server-side half of the start-date hierarchy (see planTiming.ts for the
// client-safe half): resolves the floor a node must respect, and the
// earliest start already used underneath a node (so moving a parent's
// start LATER than an existing child is rejected rather than silently
// leaving the child before its parent).

type Candidate = { date: string | null; label: string };

// Nearest ancestor first — on a tie the nearest wins, so an error message
// names the closest constraint the person can actually go and edit.
function latest(candidates: Candidate[]): StartFloor {
  let best: StartFloor = null;
  for (const c of candidates) {
    if (c.date && (!best || c.date > best.date)) best = { date: c.date, label: c.label };
  }
  return best;
}

async function planCandidate(planId: number, kind: "Strategy" | "Stage" | "Plan"): Promise<Candidate> {
  const res = await query<{ name: string; start_date: string | null; plan_type: string }>(
    `SELECT name, start_date, plan_type FROM plans WHERE id = $1`,
    [planId]
  );
  const row = res.rows[0];
  // "Plan" is the generic caller-side kind for a standalone plan — name it
  // by its real type ("Process"/"Idea") in messages.
  const kindLabel = kind === "Plan" && row ? row.plan_type.charAt(0).toUpperCase() + row.plan_type.slice(1) : kind;
  return { date: row?.start_date ?? null, label: `${kindLabel} "${row?.name ?? "?"}"` };
}

async function milestoneCandidates(milestoneId: number): Promise<Candidate[]> {
  const res = await query<{ name: string; start_date: string | null; strategy_plan_id: number }>(
    `SELECT name, start_date, strategy_plan_id FROM milestones WHERE id = $1`,
    [milestoneId]
  );
  const m = res.rows[0];
  if (!m) return [];
  return [
    { date: m.start_date, label: `Milestone "${m.name}"` },
    await planCandidate(m.strategy_plan_id, "Strategy"),
  ];
}

// A Milestone can start no earlier than its Strategy.
export async function getFloorForMilestone(strategyPlanId: number): Promise<StartFloor> {
  return latest([await planCandidate(strategyPlanId, "Strategy")]);
}

// A Stage can start no earlier than its Milestone or that Milestone's Strategy.
export async function getFloorForStage(milestoneId: number): Promise<StartFloor> {
  return latest(await milestoneCandidates(milestoneId));
}

// The floor for a plan's OWN start date — only a Stage has ancestors; a
// standalone Process/Idea/Strategy has none.
export async function getFloorForPlanStart(planId: number): Promise<StartFloor> {
  const res = await query<{ parent_milestone_id: number | null }>(
    `SELECT parent_milestone_id FROM plans WHERE id = $1`,
    [planId]
  );
  const parentMilestoneId = res.rows[0]?.parent_milestone_id ?? null;
  return parentMilestoneId === null ? null : getFloorForStage(parentMilestoneId);
}

// The floor for a step inside `planId`: the plan's own start (a Stage's,
// or a standalone Process's/Idea's) and, for a Stage, everything above it.
export async function getFloorForSteps(planId: number): Promise<StartFloor> {
  const res = await query<{ parent_milestone_id: number | null }>(
    `SELECT parent_milestone_id FROM plans WHERE id = $1`,
    [planId]
  );
  const parentMilestoneId = res.rows[0]?.parent_milestone_id ?? null;
  const isStage = parentMilestoneId !== null;
  const own = await planCandidate(planId, isStage ? "Stage" : "Plan");
  const above = isStage ? await milestoneCandidates(parentMilestoneId) : [];
  return latest([own, ...above]);
}

// Earliest start date (Muscat calendar day) used anywhere underneath a plan:
// its own steps and, when it's a Strategy, every Milestone, Stage and step
// below it. Same query serves a Stage/Process (the extra branches just
// match nothing).
export async function earliestStartUnderPlan(planId: number): Promise<string | null> {
  const res = await query<{ d: string | null }>(
    `SELECT MIN(d)::text AS d FROM (
       SELECT (e.start_at AT TIME ZONE 'Asia/Muscat')::date AS d
         FROM steps s JOIN events e ON e.id = s.event_id WHERE s.plan_id = $1
       UNION ALL
       SELECT m.start_date FROM milestones m WHERE m.strategy_plan_id = $1
       UNION ALL
       SELECT sp.start_date FROM plans sp JOIN milestones m ON m.id = sp.parent_milestone_id
         WHERE m.strategy_plan_id = $1
       UNION ALL
       SELECT (e.start_at AT TIME ZONE 'Asia/Muscat')::date
         FROM steps s JOIN events e ON e.id = s.event_id
         JOIN plans sp ON sp.id = s.plan_id JOIN milestones m ON m.id = sp.parent_milestone_id
         WHERE m.strategy_plan_id = $1
     ) t`,
    [planId]
  );
  return res.rows[0]?.d ?? null;
}

export async function earliestStartUnderMilestone(milestoneId: number): Promise<string | null> {
  const res = await query<{ d: string | null }>(
    `SELECT MIN(d)::text AS d FROM (
       SELECT sp.start_date AS d FROM plans sp WHERE sp.parent_milestone_id = $1
       UNION ALL
       SELECT (e.start_at AT TIME ZONE 'Asia/Muscat')::date
         FROM steps s JOIN events e ON e.id = s.event_id
         JOIN plans sp ON sp.id = s.plan_id WHERE sp.parent_milestone_id = $1
     ) t`,
    [milestoneId]
  );
  return res.rows[0]?.d ?? null;
}
