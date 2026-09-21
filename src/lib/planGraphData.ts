import { query } from "@/lib/db";
import type { StepStatus } from "@/lib/planDisplay";
import type { GraphMilestone, GraphStage, GraphStep } from "@/lib/planGraph";
import type { MilestoneRow, StagePlanRow } from "@/lib/planMilestones";
import { getPlanProgressForPlans } from "@/lib/planProgress";

// Lightweight step rows for the graphs — deliberately NOT StepRow (which
// carries every deliverable def/file and Minutes of Meeting): a Strategy's
// "all the way down to steps" graph needs every step in the tree at once,
// and only its title/status/timing/prerequisites.
type GraphStepQueryRow = {
  id: number;
  plan_id: number;
  title: string;
  step_type: "task" | "meeting";
  status: StepStatus;
  sort_order: number;
  start_at: Date;
  end_at: Date | null;
  assignee_username: string | null;
  attendee_count: number;
  prerequisite_step_ids: number[];
};

export async function listGraphStepsForPlans(planIds: number[]): Promise<Map<number, GraphStep[]>> {
  const byPlan = new Map<number, GraphStep[]>();
  if (planIds.length === 0) return byPlan;

  const res = await query<GraphStepQueryRow>(
    `SELECT s.id, s.plan_id, e.title, s.step_type, s.status, s.sort_order, e.start_at, e.end_at,
            au.username AS assignee_username,
            (SELECT COUNT(*)::int FROM event_attendees ea WHERE ea.event_id = e.id) AS attendee_count,
            COALESCE((SELECT json_agg(sp.prerequisite_step_id ORDER BY sp.prerequisite_step_id)
                      FROM step_prerequisites sp WHERE sp.step_id = s.id), '[]') AS prerequisite_step_ids
     FROM steps s
     JOIN events e ON e.id = s.event_id
     LEFT JOIN users au ON au.id = e.assignee_id
     WHERE s.plan_id = ANY($1::int[])
     ORDER BY s.sort_order ASC, s.created_at ASC`,
    [planIds]
  );
  for (const row of res.rows) {
    const list = byPlan.get(row.plan_id) ?? [];
    list.push({
      id: row.id,
      title: row.title,
      step_type: row.step_type,
      status: row.status,
      sort_order: row.sort_order,
      due_at: (row.step_type === "task" && row.end_at ? row.end_at : row.start_at).toISOString(),
      assignee_username: row.assignee_username,
      attendee_count: row.attendee_count,
      prerequisite_step_ids: row.prerequisite_step_ids,
    });
    byPlan.set(row.plan_id, list);
  }
  return byPlan;
}

// Stages (with their steps) for one Milestone's graph.
export async function buildStageGraph(stages: StagePlanRow[]): Promise<GraphStage[]> {
  const ids = stages.map((s) => s.id);
  const [stepsByPlan, progress] = await Promise.all([listGraphStepsForPlans(ids), getPlanProgressForPlans(ids)]);
  return stages.map((s) => ({
    id: s.id,
    name: s.name,
    start_date: s.start_date,
    progress: progress[s.id]?.progress ?? 0,
    prerequisite_stage_id: s.prerequisite_stage_id,
    steps: stepsByPlan.get(s.id) ?? [],
  }));
}

// A Strategy's whole Milestone -> Stage -> step tree, for its graph.
export async function buildStrategyGraph(milestones: MilestoneRow[]): Promise<GraphMilestone[]> {
  if (milestones.length === 0) return [];
  const stagesRes = await query<StagePlanRow & { parent_milestone_id: number }>(
    `SELECT p.id, p.name, p.description, p.start_date, p.prerequisite_stage_id, p.parent_milestone_id,
            p.created_by, NULL::text AS created_by_username, p.created_at
     FROM plans p WHERE p.parent_milestone_id = ANY($1::int[])
     ORDER BY p.created_at ASC`,
    [milestones.map((m) => m.id)]
  );
  const graphStages = await buildStageGraph(stagesRes.rows);
  const stagesByMilestone = new Map<number, GraphStage[]>();
  stagesRes.rows.forEach((row, i) => {
    const list = stagesByMilestone.get(row.parent_milestone_id) ?? [];
    list.push(graphStages[i]);
    stagesByMilestone.set(row.parent_milestone_id, list);
  });

  return milestones.map((m) => {
    const stages = stagesByMilestone.get(m.id) ?? [];
    const progress = stages.length === 0 ? 0 : Math.round(stages.reduce((a, s) => a + s.progress, 0) / stages.length);
    return {
      id: m.id,
      name: m.name,
      start_date: m.start_date,
      progress,
      prerequisite_milestone_id: m.prerequisite_milestone_id,
      stages,
    };
  });
}

// A single plan's own steps (the Stage/Process/Idea step graph).
export async function listGraphStepsForPlan(planId: number): Promise<GraphStep[]> {
  const map = await listGraphStepsForPlans([planId]);
  return map.get(planId) ?? [];
}
