import { query, withTransaction } from "@/lib/db";
import type { PoolClient } from "pg";
import type { PlanType } from "@/lib/planDisplay";
import { getMilestoneById, validateStagePrerequisite } from "@/lib/planMilestones";
import { earliestStartUnderPlan, getFloorForPlanStart, getFloorForStage } from "@/lib/planStartRules";
import { daysBetweenDates, startAfterDescendantsMessage, startBeforeFloorMessage } from "@/lib/planTiming";

export type PlanRow = {
  id: number;
  plan_type: PlanType;
  parent_milestone_id: number | null;
  name: string;
  description: string;
  start_date: string | null; // "YYYY-MM-DD"
  // Only meaningful on a Stage (parent_milestone_id set) — its one optional
  // prerequisite sibling Stage. Ordering/graph edge only, not a done-gate.
  prerequisite_stage_id: number | null;
  // Optional link to a Project (Organization structure, Phase 3) — "required
  // for" stays free text elsewhere in the app; this is the structured escape
  // hatch alongside it, not a replacement.
  project_id: number | null;
  project_name: string | null;
  promoted_from_plan_id: number | null;
  duplicated_from_plan_id: number | null;
  migrated_from_idea_id: number | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
  updated_at: Date;
};

const PLAN_SELECT = `
  SELECT p.id, p.plan_type, p.parent_milestone_id, p.name, p.description, p.start_date, p.prerequisite_stage_id,
         p.project_id, pr.name AS project_name,
         p.promoted_from_plan_id, p.duplicated_from_plan_id, p.migrated_from_idea_id,
         p.created_by, u.username AS created_by_username, p.created_at, p.updated_at
  FROM plans p
  LEFT JOIN users u ON u.id = p.created_by
  LEFT JOIN projects pr ON pr.id = p.project_id
`;

// Phase 1 only ever lists/creates standalone plans (parent_milestone_id
// IS NULL) — a Stage (plan_type='process' with parent_milestone_id set,
// Phase 3) is excluded from every general list; it's only ever reached by
// drilling into its Strategy/Milestone.
export async function listPlans(planType?: PlanType): Promise<PlanRow[]> {
  const conditions = ["p.parent_milestone_id IS NULL"];
  const params: unknown[] = [];
  if (planType) {
    params.push(planType);
    conditions.push(`p.plan_type = $${params.length}`);
  }
  const res = await query<PlanRow>(
    `${PLAN_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY p.created_at DESC`,
    params
  );
  return res.rows;
}

export async function getPlanById(id: number): Promise<PlanRow | null> {
  const res = await query<PlanRow>(`${PLAN_SELECT} WHERE p.id = $1`, [id]);
  return res.rows[0] ?? null;
}

// Phase 1 only creates 'process'/'idea' plans — 'strategy' is a valid DB
// value (Phase 3 needs the column to already allow it) but nothing calls
// this with planType: 'strategy' yet; the API route rejects it for now.
export async function createPlan(input: {
  planType: PlanType;
  name: string;
  description: string;
  startDate: string | null;
  projectId: number | null;
  createdBy: number;
}): Promise<PlanRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO plans (plan_type, name, description, start_date, project_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.planType, input.name, input.description, input.startDate, input.projectId, input.createdBy]
  );
  const created = await getPlanById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created plan");
  return created;
}

// Start-date hierarchy (Strategy <= Milestone <= Stage <= step, see
// lib/planStartRules.ts): a Stage's start can't precede its Milestone's or
// Strategy's, and no plan's start can move LATER than something already
// scheduled inside it. `prerequisiteStageId` undefined leaves a Stage's
// prerequisite untouched (the form only sends it for Stages).
export async function updatePlan(
  id: number,
  input: {
    name: string;
    description: string;
    startDate: string | null;
    projectId: number | null;
    prerequisiteStageId?: number | null;
  }
): Promise<{ ok: true; plan: PlanRow } | { ok: false; error: string; notFound?: boolean }> {
  const existing = await getPlanById(id);
  if (!existing) return { ok: false, error: "Not found", notFound: true };

  const isStage = existing.parent_milestone_id !== null;
  const noun = isStage ? "A stage" : `A ${existing.plan_type}`;

  // Only re-checked when the start date actually changes, so a plan
  // dated before this rule existed can still be renamed/edited in place.
  if (input.startDate && input.startDate !== existing.start_date) {
    const floor = await getFloorForPlanStart(id);
    if (floor && input.startDate < floor.date) {
      return { ok: false, error: startBeforeFloorMessage(noun, floor) };
    }
    const earliest = await earliestStartUnderPlan(id);
    if (earliest && earliest < input.startDate) {
      return { ok: false, error: startAfterDescendantsMessage(`This ${isStage ? "stage" : existing.plan_type}`, input.startDate, earliest) };
    }
  }

  let prerequisiteStageId = existing.prerequisite_stage_id;
  if (isStage && input.prerequisiteStageId !== undefined) {
    const error = await validateStagePrerequisite(existing.parent_milestone_id!, input.prerequisiteStageId, id);
    if (error) return { ok: false, error };
    prerequisiteStageId = input.prerequisiteStageId;
  }

  await query(
    `UPDATE plans SET name = $1, description = $2, start_date = $3, project_id = $4, prerequisite_stage_id = $5, updated_at = now() WHERE id = $6`,
    [input.name, input.description, input.startDate, input.projectId, prerequisiteStageId, id]
  );
  const plan = await getPlanById(id);
  if (!plan) return { ok: false, error: "Not found", notFound: true };
  return { ok: true, plan };
}

// A plan's steps are each backed by their own real `events` row (see
// lib/planSteps.ts) — `steps.plan_id` cascades on plan delete, but that
// only removes the `steps` rows, not their linked Calendar events (there's
// no reverse cascade from steps -> events, only events -> steps, by
// design — see steps' schema comment). Delete those events explicitly
// first inside one transaction so a deleted plan never leaves orphaned
// Calendar entries behind.
//
// Deleting a Strategy plan cascades at the DB level through its Milestones
// (milestones.strategy_plan_id ON DELETE CASCADE) and, through those, their
// Stage plans (plans.parent_milestone_id ON DELETE CASCADE) and those
// Stages' own steps — but none of that reaches steps' backing events
// either, so this collects every affected plan (the plan itself, plus any
// Stage plans under it if it's a Strategy) before cleaning up.
export async function deletePlan(id: number): Promise<void> {
  await withTransaction(async (client) => {
    const affectedPlans = await client.query<{ id: number }>(
      `SELECT p.id FROM plans p WHERE p.id = $1
       UNION
       SELECT sp.id FROM plans sp
       JOIN milestones m ON m.id = sp.parent_milestone_id
       WHERE m.strategy_plan_id = $1`,
      [id]
    );
    const planIds = affectedPlans.rows.map((r) => r.id);
    const stepEvents = await client.query<{ event_id: number }>(
      `SELECT event_id FROM steps WHERE plan_id = ANY($1::int[])`,
      [planIds]
    );
    const eventIds = stepEvents.rows.map((r) => r.event_id);
    if (eventIds.length > 0) {
      await client.query(`DELETE FROM events WHERE id = ANY($1::int[])`, [eventIds]);
    }
    await client.query(`DELETE FROM plans WHERE id = $1`, [id]);
  });
}

// Deep-clones every step under `sourcePlanId` into `targetPlanId` — each
// gets a brand-new `events` row (never reuses/points at the original's
// event, per the roadmap: "the new copy's start date is set to the date
// of duplication"), its own prerequisite edges remapped to the new step
// ids, and empty deliverable defs (structure only — no text_value/filled_by,
// no files: a duplicate is a fresh instance, not a copy of already-filled
// answers). Returns the old-id -> new-id map so a caller cloning a
// Strategy can also remap cross-stage step references if ever needed
// (none exist today, but kept for symmetry with the milestone map below).
async function cloneStepsForPlan(
  client: PoolClient,
  sourcePlanId: number,
  targetPlanId: number,
  dayShiftMs: number,
  createdBy: number
): Promise<Map<number, number>> {
  const stepsRes = await client.query<{
    id: number;
    event_id: number;
    step_type: "task" | "meeting";
    notes: string;
    requires_deliverable: boolean;
    sort_order: number;
    title: string;
    start_at: Date;
    end_at: Date | null;
    assignee_id: number | null;
  }>(
    `SELECT s.id, s.event_id, s.step_type, s.notes, s.requires_deliverable, s.sort_order,
            e.title, e.start_at, e.end_at, e.assignee_id
     FROM steps s JOIN events e ON e.id = s.event_id
     WHERE s.plan_id = $1 ORDER BY s.sort_order ASC, s.id ASC`,
    [sourcePlanId]
  );

  const idMap = new Map<number, number>();

  for (const step of stepsRes.rows) {
    const newStart = new Date(step.start_at.getTime() + dayShiftMs);
    const newEnd = step.end_at ? new Date(step.end_at.getTime() + dayShiftMs) : null;
    // Mirrors lib/planSteps.ts's createStep: TaskStatus is only meaningful
    // for task-type steps, reset fresh (never carries over a 'closed'/
    // 'review_needed' status from the original).
    const eventStatus = step.step_type === "task" ? (step.assignee_id !== null ? "pending" : "backlog") : "backlog";

    const eventRes = await client.query<{ id: number }>(
      `INSERT INTO events (title, description, type, is_tentative, start_at, end_at, created_by, assignee_id, status)
       VALUES ($1, '', $2, false, $3, $4, $5, $6, $7) RETURNING id`,
      [step.title, step.step_type, newStart, newEnd, createdBy, step.step_type === "meeting" ? null : step.assignee_id, eventStatus]
    );

    // A meeting step's attendees carry over (they ARE the meeting's people,
    // not per-run state like deliverable answers).
    if (step.step_type === "meeting") {
      await client.query(
        `INSERT INTO event_attendees (event_id, user_id)
         SELECT $1, ea.user_id FROM event_attendees ea WHERE ea.event_id = $2`,
        [eventRes.rows[0].id, step.event_id]
      );
    }

    const newStepRes = await client.query<{ id: number }>(
      `INSERT INTO steps (plan_id, event_id, step_type, notes, requires_deliverable, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [targetPlanId, eventRes.rows[0].id, step.step_type, step.notes, step.requires_deliverable, step.sort_order, createdBy]
    );
    idMap.set(step.id, newStepRes.rows[0].id);
  }

  if (idMap.size === 0) return idMap;
  const oldIds = Array.from(idMap.keys());

  const prereqRes = await client.query<{ step_id: number; prerequisite_step_id: number }>(
    `SELECT step_id, prerequisite_step_id FROM step_prerequisites WHERE step_id = ANY($1::int[])`,
    [oldIds]
  );
  for (const row of prereqRes.rows) {
    const newStepId = idMap.get(row.step_id);
    const newPrereqId = idMap.get(row.prerequisite_step_id);
    if (newStepId && newPrereqId) {
      await client.query(`INSERT INTO step_prerequisites (step_id, prerequisite_step_id) VALUES ($1, $2)`, [
        newStepId,
        newPrereqId,
      ]);
    }
  }

  const defsRes = await client.query<{ step_id: number; kind: string; label: string; sort_order: number }>(
    `SELECT step_id, kind, label, sort_order FROM step_deliverable_defs WHERE step_id = ANY($1::int[])`,
    [oldIds]
  );
  for (const def of defsRes.rows) {
    const newStepId = idMap.get(def.step_id);
    if (newStepId) {
      await client.query(`INSERT INTO step_deliverable_defs (step_id, kind, label, sort_order) VALUES ($1, $2, $3, $4)`, [
        newStepId,
        def.kind,
        def.label,
        def.sort_order,
      ]);
    }
  }

  return idMap;
}

// Duplicate-and-reset-dates (confirmed 2026-09-18) — the answer to "can a
// workflow be saved as a reusable template": no separate template concept,
// just clone-and-reset-dates on an existing plan. A Strategy's whole
// Milestone -> Stage -> step tree is cloned; a Process/Idea's own steps
// are cloned directly. Every step's date is shifted by the same amount —
// however far the plan's *earliest* original step already is from "now" —
// so the whole workflow starts today while keeping its steps' relative
// spacing intact, rather than collapsing every step onto the same date.
export async function duplicatePlan(
  id: number,
  createdBy: number
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const plan = await getPlanById(id);
  if (!plan) return { ok: false, error: "Not found" };
  if (plan.parent_milestone_id !== null) {
    return { ok: false, error: "A Stage can't be duplicated directly — duplicate its Strategy instead" };
  }

  const newPlanId = await withTransaction(async (client) => {
    const earliestRes = await client.query<{ min_start: Date | null }>(
      plan.plan_type === "strategy"
        ? `SELECT MIN(e.start_at) AS min_start FROM steps s
           JOIN events e ON e.id = s.event_id
           JOIN plans sp ON sp.id = s.plan_id
           JOIN milestones m ON m.id = sp.parent_milestone_id
           WHERE m.strategy_plan_id = $1`
        : `SELECT MIN(e.start_at) AS min_start FROM steps s JOIN events e ON e.id = s.event_id WHERE s.plan_id = $1`,
      [id]
    );
    const earliest = earliestRes.rows[0]?.min_start;
    const dayShiftMs = earliest ? Date.now() - new Date(earliest).getTime() : 0;
    const today = new Date().toISOString().slice(0, 10);

    const newPlanRes = await client.query<{ id: number }>(
      `INSERT INTO plans (plan_type, name, description, start_date, project_id, duplicated_from_plan_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [plan.plan_type, `${plan.name} (copy)`, plan.description, today, plan.project_id, plan.id, createdBy]
    );
    const newPlanId = newPlanRes.rows[0].id;

    if (plan.plan_type === "strategy") {
      const milestonesRes = await client.query<{
        id: number;
        name: string;
        description: string;
        sort_order: number;
        prerequisite_milestone_id: number | null;
      }>(
        `SELECT id, name, description, sort_order, prerequisite_milestone_id
         FROM milestones WHERE strategy_plan_id = $1 ORDER BY sort_order ASC, id ASC`,
        [id]
      );
      const milestoneIdMap = new Map<number, number>();
      const stageIdMap = new Map<number, number>();
      const stagePrerequisites: { oldId: number; oldPrerequisiteId: number }[] = [];

      // Every level restarts "today" (Strategy <= Milestone <= Stage <=
      // steps — the shifted steps all land on or after today, since the
      // earliest one is moved to now), so the copy satisfies the same
      // start-date hierarchy an original does.
      for (const m of milestonesRes.rows) {
        const newMsRes = await client.query<{ id: number }>(
          `INSERT INTO milestones (strategy_plan_id, name, description, start_date, sort_order)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [newPlanId, m.name, m.description, today, m.sort_order]
        );
        const newMilestoneId = newMsRes.rows[0].id;
        milestoneIdMap.set(m.id, newMilestoneId);

        const stagesRes = await client.query<{
          id: number;
          name: string;
          description: string;
          prerequisite_stage_id: number | null;
        }>(
          `SELECT id, name, description, prerequisite_stage_id FROM plans WHERE parent_milestone_id = $1`,
          [m.id]
        );
        for (const stage of stagesRes.rows) {
          const newStageRes = await client.query<{ id: number }>(
            `INSERT INTO plans (plan_type, parent_milestone_id, name, description, start_date, created_by)
             VALUES ('process', $1, $2, $3, $4, $5) RETURNING id`,
            [newMilestoneId, stage.name, stage.description, today, createdBy]
          );
          stageIdMap.set(stage.id, newStageRes.rows[0].id);
          if (stage.prerequisite_stage_id !== null) {
            stagePrerequisites.push({ oldId: stage.id, oldPrerequisiteId: stage.prerequisite_stage_id });
          }
          await cloneStepsForPlan(client, stage.id, newStageRes.rows[0].id, dayShiftMs, createdBy);
        }
      }

      // Stage prerequisites, remapped once every Stage in the clone has a
      // new id (a Stage's prerequisite is always a sibling in its own
      // Milestone, so every reference resolves).
      for (const sp of stagePrerequisites) {
        const newSelfId = stageIdMap.get(sp.oldId);
        const newPrereqId = stageIdMap.get(sp.oldPrerequisiteId);
        if (newSelfId && newPrereqId) {
          await client.query(`UPDATE plans SET prerequisite_stage_id = $1 WHERE id = $2`, [newPrereqId, newSelfId]);
        }
      }

      // Second pass: milestone prerequisites, now that every milestone in
      // this Strategy has a new id (a milestone can only prerequisite a
      // sibling within the same Strategy, so every reference resolves).
      for (const m of milestonesRes.rows) {
        if (m.prerequisite_milestone_id === null) continue;
        const newSelfId = milestoneIdMap.get(m.id);
        const newPrereqId = milestoneIdMap.get(m.prerequisite_milestone_id);
        if (newSelfId && newPrereqId) {
          await client.query(`UPDATE milestones SET prerequisite_milestone_id = $1 WHERE id = $2`, [
            newPrereqId,
            newSelfId,
          ]);
        }
      }
    } else {
      await cloneStepsForPlan(client, id, newPlanId, dayShiftMs, createdBy);
    }

    return newPlanId;
  });

  return { ok: true, id: newPlanId };
}

// Adds a standalone Process to a Strategy's Milestone as a Stage (0.2.6).
//  - "move": the SAME plan row becomes the Stage (parent_milestone_id set) —
//    it leaves the standalone Processes list, keeps its steps, progress and
//    dates. Confirmed with the user as the meaning of "link the same".
//    Its own plan_shares rows are dropped: a Stage has no share row of its
//    own — visibility now follows the Strategy's shares — so leaving them
//    would just be dead rows.
//  - "duplicate": a brand-new Stage is created from a copy of the Process
//    (name/description/steps/prerequisites/deliverable placeholders/meeting
//    attendees), starting at zero progress on a start date the caller
//    supplies. Every step moves by the same number of days as the new start
//    is from the Process's own start date (its earliest step, if it has no
//    start date — or if a step somehow predates it), so relative spacing is
//    kept. The original is untouched.
// Either way the Stage must respect the start-date hierarchy (Strategy <=
// Milestone <= Stage <= steps): the move is rejected if the Process (or
// its earliest step) starts before the Milestone's floor; a duplicate's
// chosen start date can't be before it.
export async function addProcessToStrategy(
  planId: number,
  input: { milestoneId: number; mode: "move" | "duplicate"; startDate: string | null },
  createdBy: number
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const plan = await getPlanById(planId);
  if (!plan) return { ok: false, error: "Not found" };
  if (plan.plan_type !== "process" || plan.parent_milestone_id !== null) {
    return { ok: false, error: "Only a standalone Process can be added to a Strategy as a Stage" };
  }
  const milestone = await getMilestoneById(input.milestoneId);
  if (!milestone) return { ok: false, error: "Milestone not found" };

  const floor = await getFloorForStage(input.milestoneId);
  const earliestStep = await earliestStartUnderPlan(planId);
  const baseline = [plan.start_date, earliestStep]
    .filter((d): d is string => !!d)
    .reduce<string | null>((min, d) => (min === null || d < min ? d : min), null);

  if (input.mode === "move") {
    if (floor && baseline && baseline < floor.date) {
      return {
        ok: false,
        error: `This process starts on ${baseline}, before ${floor.label} starts (${floor.date}). Duplicate it with a new start date instead, or change its dates first.`,
      };
    }
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE plans SET parent_milestone_id = $1, prerequisite_stage_id = NULL, updated_at = now() WHERE id = $2`,
        [input.milestoneId, planId]
      );
      await client.query(`DELETE FROM plan_shares WHERE plan_id = $1`, [planId]);
    });
    return { ok: true, id: planId };
  }

  const startDate = input.startDate;
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false, error: "A start date is required for the duplicate" };
  }
  if (floor && startDate < floor.date) {
    return { ok: false, error: `A stage can't start before ${floor.date} — the start of ${floor.label}` };
  }
  const shiftDays = baseline ? daysBetweenDates(baseline, startDate) : 0;

  const newId = await withTransaction(async (client) => {
    const res = await client.query<{ id: number }>(
      `INSERT INTO plans (plan_type, parent_milestone_id, name, description, start_date, duplicated_from_plan_id, created_by)
       VALUES ('process', $1, $2, $3, $4, $5, $6) RETURNING id`,
      [input.milestoneId, plan.name, plan.description, startDate, plan.id, createdBy]
    );
    await cloneStepsForPlan(client, planId, res.rows[0].id, shiftDays * 86_400_000, createdBy);
    return res.rows[0].id;
  });
  return { ok: true, id: newId };
}

// Idea -> Process/Strategy promotion (confirmed 2026-09-18): an Idea is
// never just a bare write-up — it always has a real workflow, specifically
// because it might later be promoted. Both paths flip the SAME row's
// plan_type in place (same id throughout) rather than creating a new plan
// and linking back — there's no separate "old" row for
// `promoted_from_plan_id` to point at, so that column (scaffolded in
// Phase 1 for a create-new-and-link design that this confirmed mechanic
// turned out not to need) is deliberately left null by both functions
// below; kept as a harmless nullable column rather than dropped, in case
// a future promotion path ever does need real before/after lineage.

export async function promoteIdeaToProcess(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const plan = await getPlanById(id);
  if (!plan) return { ok: false, error: "Not found" };
  if (plan.plan_type !== "idea") return { ok: false, error: "Only an Idea can be promoted" };

  await query(`UPDATE plans SET plan_type = 'process', updated_at = now() WHERE id = $1`, [id]);
  return { ok: true };
}

// Idea -> Strategy: confirmed 2026-09-19 as a GUIDED reorg, not
// auto-created placeholder Milestones/Stages — the admin explicitly
// defines every Milestone/Stage and explicitly assigns every one of the
// Idea's existing steps into one; no step moves until the admin places it
// (enforced below: every existing step id must appear in
// `stepAssignments`, or the whole promotion is rejected before any write
// happens).
export async function promoteIdeaToStrategy(
  id: number,
  input: {
    milestones: { name: string; description: string; stages: { name: string; description: string }[] }[];
    stepAssignments: Record<number, { milestoneIndex: number; stageIndex: number }>;
  },
  createdBy: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const plan = await getPlanById(id);
  if (!plan) return { ok: false, error: "Not found" };
  if (plan.plan_type !== "idea") return { ok: false, error: "Only an Idea can be promoted" };
  if (input.milestones.length === 0) return { ok: false, error: "At least one milestone is required" };
  for (const m of input.milestones) {
    if (!m.name.trim()) return { ok: false, error: "Every milestone needs a name" };
    if (m.stages.length === 0) return { ok: false, error: "Every milestone needs at least one stage" };
    for (const s of m.stages) {
      if (!s.name.trim()) return { ok: false, error: "Every stage needs a name" };
    }
  }

  const existingSteps = await query<{ id: number }>(`SELECT id FROM steps WHERE plan_id = $1`, [id]);
  for (const step of existingSteps.rows) {
    const assignment = input.stepAssignments[step.id];
    if (
      !assignment ||
      !input.milestones[assignment.milestoneIndex] ||
      !input.milestones[assignment.milestoneIndex].stages[assignment.stageIndex]
    ) {
      return { ok: false, error: "Every existing step must be assigned to a stage" };
    }
  }

  await withTransaction(async (client) => {
    await client.query(`UPDATE plans SET plan_type = 'strategy', updated_at = now() WHERE id = $1`, [id]);

    const stagePlanIds: number[][] = [];
    for (let mi = 0; mi < input.milestones.length; mi++) {
      const m = input.milestones[mi];
      const msRes = await client.query<{ id: number }>(
        `INSERT INTO milestones (strategy_plan_id, name, description, sort_order) VALUES ($1, $2, $3, $4) RETURNING id`,
        [id, m.name.trim(), m.description.trim(), mi]
      );
      const milestoneId = msRes.rows[0].id;
      stagePlanIds[mi] = [];
      for (let si = 0; si < m.stages.length; si++) {
        const s = m.stages[si];
        const stageRes = await client.query<{ id: number }>(
          `INSERT INTO plans (plan_type, parent_milestone_id, name, description, created_by)
           VALUES ('process', $1, $2, $3, $4) RETURNING id`,
          [milestoneId, s.name.trim(), s.description.trim(), createdBy]
        );
        stagePlanIds[mi][si] = stageRes.rows[0].id;
      }
    }

    // Re-parent every existing step from the Idea's own plan_id to the
    // Stage the admin placed it in — a Strategy's steps live under its
    // Stages, never directly on the Strategy row itself.
    for (const step of existingSteps.rows) {
      const assignment = input.stepAssignments[step.id];
      const targetPlanId = stagePlanIds[assignment.milestoneIndex][assignment.stageIndex];
      await client.query(`UPDATE steps SET plan_id = $1 WHERE id = $2`, [targetPlanId, step.id]);
    }
  });

  return { ok: true };
}
