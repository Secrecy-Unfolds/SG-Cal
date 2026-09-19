import { query, withTransaction } from "@/lib/db";
import { del } from "@vercel/blob";
import { updateEvent, validateEventTiming, type EventType } from "@/lib/events";
import { prerequisitesSatisfied, type StepStatus } from "@/lib/planDisplay";
import type { TaskStatus } from "@/lib/eventDisplay";
import { isDeliverableDefFilled, type DeliverableDefRow, type DeliverableKind } from "@/lib/planDeliverables";
import { isMinutesOfMeetingFilled, type MinutesOfMeetingRow } from "@/lib/planMinutesOfMeeting";
import { getMilestoneProgress } from "@/lib/planProgress";

export type StepRow = {
  id: number;
  plan_id: number;
  event_id: number;
  step_type: EventType;
  notes: string;
  status: StepStatus;
  requires_deliverable: boolean;
  sort_order: number;
  completed_at: Date | null;
  completed_by: number | null;
  completed_by_username: string | null;
  overdue_reminder_sent_at: Date | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
  updated_at: Date;
  // Joined from the backing `events` row — the single source of truth for
  // a step's title/timing/assignee (see steps' schema comment in
  // db/schema.sql). event_status is Calendar's own Kanban TaskStatus
  // vocabulary (backlog/pending/in_progress/review_needed/closed) —
  // deliberately kept separate from this step's own `status`
  // (pending/done/blocked/skipped/na), which is the authoritative signal
  // for workflow prerequisite/progress gating. The two aren't synced in
  // Phase 1 — see the note on updateStepStatus below.
  title: string;
  event_description: string;
  start_at: Date;
  end_at: Date | null;
  event_status: TaskStatus;
  assignee_id: number | null;
  assignee_username: string | null;
  prerequisite_step_ids: number[];
  // Phase 2: aggregated inline (same nested json_agg pattern events'
  // attendees already uses) rather than fetched separately — see
  // lib/planDeliverables.ts / lib/planMinutesOfMeeting.ts for the shapes.
  deliverable_defs: DeliverableDefRow[];
  minutes_of_meeting: MinutesOfMeetingRow | null;
};

const STEP_SELECT = `
  SELECT s.id, s.plan_id, s.event_id, s.step_type, s.notes, s.status, s.requires_deliverable,
         s.sort_order, s.completed_at, s.completed_by, cu.username AS completed_by_username,
         s.overdue_reminder_sent_at, s.created_by, su.username AS created_by_username,
         s.created_at, s.updated_at,
         e.title, e.description AS event_description, e.start_at, e.end_at, e.status AS event_status,
         e.assignee_id, au.username AS assignee_username,
         COALESCE(
           (SELECT json_agg(sp.prerequisite_step_id ORDER BY sp.prerequisite_step_id)
            FROM step_prerequisites sp WHERE sp.step_id = s.id),
           '[]'
         ) AS prerequisite_step_ids,
         COALESCE(
           (SELECT json_agg(json_build_object(
               'id', d.id, 'step_id', d.step_id, 'kind', d.kind, 'label', d.label,
               'sort_order', d.sort_order, 'text_value', d.text_value,
               'filled_by', d.filled_by, 'filled_by_username', fu.username, 'filled_at', d.filled_at,
               'created_at', d.created_at,
               'files', COALESCE(
                 (SELECT json_agg(json_build_object(
                     'id', f.id, 'deliverable_def_id', f.deliverable_def_id, 'version_number', f.version_number,
                     'blob_url', f.blob_url, 'file_name', f.file_name, 'mime_type', f.mime_type,
                     'size_bytes', f.size_bytes, 'uploaded_by', f.uploaded_by,
                     'uploaded_by_username', uu.username, 'uploaded_at', f.uploaded_at
                   ) ORDER BY f.version_number DESC)
                  FROM step_deliverable_files f LEFT JOIN users uu ON uu.id = f.uploaded_by
                  WHERE f.deliverable_def_id = d.id),
                 '[]'
               )
             ) ORDER BY d.sort_order ASC, d.id ASC)
            FROM step_deliverable_defs d LEFT JOIN users fu ON fu.id = d.filled_by
            WHERE d.step_id = s.id),
           '[]'
         ) AS deliverable_defs,
         (SELECT json_build_object(
             'step_id', m.step_id, 'attendees', m.attendees, 'discussion', m.discussion,
             'decisions', m.decisions, 'action_items', m.action_items,
             'filled_by', m.filled_by, 'filled_by_username', mu.username, 'filled_at', m.filled_at,
             'created_at', m.created_at, 'updated_at', m.updated_at
           )
          FROM minutes_of_meeting m LEFT JOIN users mu ON mu.id = m.filled_by
          WHERE m.step_id = s.id) AS minutes_of_meeting
  FROM steps s
  JOIN events e ON e.id = s.event_id
  LEFT JOIN users cu ON cu.id = s.completed_by
  LEFT JOIN users su ON su.id = s.created_by
  LEFT JOIN users au ON au.id = e.assignee_id
`;

export async function listStepsForPlan(planId: number): Promise<StepRow[]> {
  const res = await query<StepRow>(
    `${STEP_SELECT} WHERE s.plan_id = $1 ORDER BY s.sort_order ASC, s.created_at ASC`,
    [planId]
  );
  return res.rows;
}

export async function getStepById(id: number): Promise<StepRow | null> {
  const res = await query<StepRow>(`${STEP_SELECT} WHERE s.id = $1`, [id]);
  return res.rows[0] ?? null;
}

// Phase 5: overdue-step reminders. A lighter-weight row than StepRow —
// just what the reminder email needs, including `plan_name` (via a join
// STEP_SELECT doesn't carry, since every other caller already has the
// plan in hand and doesn't need it duplicated onto every step row).
export type OverdueStepReminder = {
  id: number;
  title: string;
  notes: string;
  step_type: EventType;
  start_at: Date;
  end_at: Date | null;
  assignee_id: number;
  plan_name: string;
};

// A step is overdue once its own due moment has passed while it's still
// not resolved (done/skipped/na don't need reminding; blocked still does,
// since "blocked" isn't a resolution). "Due moment" is end_at (the due
// time) for a task, start_at (when it happens) for a meeting — a meeting
// that already passed without being recorded is exactly the case worth
// nudging someone about. Requires an assignee (nothing to notify
// otherwise) — mirrors Calendar's own task/meeting reminder pattern
// (src/lib/events.ts's listTasksNeedingEndReminder/
// listMeetingsNeedingStartReminder), reusing the same "gated by a
// *_reminder_sent_at column, marked once fired" mechanism rather than a
// new one.
export async function listStepsNeedingOverdueReminder(): Promise<OverdueStepReminder[]> {
  const res = await query<OverdueStepReminder>(
    `SELECT s.id, e.title, s.notes, s.step_type, e.start_at, e.end_at, e.assignee_id, p.name AS plan_name
     FROM steps s
     JOIN events e ON e.id = s.event_id
     JOIN plans p ON p.id = s.plan_id
     WHERE s.status NOT IN ('done', 'skipped', 'na')
       AND s.overdue_reminder_sent_at IS NULL
       AND e.assignee_id IS NOT NULL
       AND (
         (s.step_type = 'task' AND e.end_at IS NOT NULL AND e.end_at < now())
         OR (s.step_type = 'meeting' AND e.start_at < now())
       )
     ORDER BY e.start_at ASC`
  );
  return res.rows;
}

export async function markOverdueReminderSent(id: number): Promise<void> {
  await query(`UPDATE steps SET overdue_reminder_sent_at = now() WHERE id = $1`, [id]);
}

// Plan authoring (steps included) is Admin-level-only end to end (see
// docs/erp-v3-roadmap.md / the plans API routes), so — unlike Calendar's
// own resolveTaskAssignment in lib/events.ts, which restricts a plain
// "user" to self-assigning — a step's author can assign either a task or
// a meeting step to anyone. TaskStatus on the backing event is only
// meaningful for step_type='task' (mirrors how standalone Calendar
// meetings already always carry an unused 'backlog' status).
export async function createStep(input: {
  planId: number;
  stepType: EventType;
  title: string;
  notes: string;
  startAt: Date;
  endAt: Date | null;
  assigneeId: number | null;
  requiresDeliverable: boolean;
  deliverableDefs: { kind: DeliverableKind; label: string }[];
  prerequisiteStepIds: number[];
  sortOrder: number;
  createdBy: number;
}): Promise<{ ok: true; step: StepRow } | { ok: false; error: string }> {
  const timingError = validateEventTiming({
    type: input.stepType,
    isTentative: false,
    startAt: input.startAt,
    endAt: input.endAt,
  });
  if (timingError) return { ok: false, error: timingError };

  if (input.prerequisiteStepIds.length > 0) {
    const res = await query<{ id: number }>(
      `SELECT id FROM steps WHERE id = ANY($1::int[]) AND plan_id = $2`,
      [Array.from(new Set(input.prerequisiteStepIds)), input.planId]
    );
    if (res.rows.length !== new Set(input.prerequisiteStepIds).size) {
      return { ok: false, error: "A prerequisite must be another step in the same plan" };
    }
  }

  const eventStatus: TaskStatus =
    input.stepType === "task" ? (input.assigneeId !== null ? "pending" : "backlog") : "backlog";

  const stepId = await withTransaction(async (client) => {
    const eventRes = await client.query<{ id: number }>(
      `INSERT INTO events (title, description, type, is_tentative, start_at, end_at, created_by, assignee_id, status)
       VALUES ($1, '', $2, false, $3, $4, $5, $6, $7) RETURNING id`,
      [input.title, input.stepType, input.startAt, input.endAt, input.createdBy, input.assigneeId, eventStatus]
    );
    const eventId = eventRes.rows[0].id;

    const stepRes = await client.query<{ id: number }>(
      `INSERT INTO steps (plan_id, event_id, step_type, notes, requires_deliverable, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [input.planId, eventId, input.stepType, input.notes, input.requiresDeliverable, input.sortOrder, input.createdBy]
    );
    const newStepId = stepRes.rows[0].id;

    const uniquePrereqIds = Array.from(new Set(input.prerequisiteStepIds));
    if (uniquePrereqIds.length > 0) {
      const values = uniquePrereqIds.map((_, i) => `($1, $${i + 2})`).join(", ");
      await client.query(
        `INSERT INTO step_prerequisites (step_id, prerequisite_step_id) VALUES ${values}`,
        [newStepId, ...uniquePrereqIds]
      );
    }

    for (let i = 0; i < input.deliverableDefs.length; i++) {
      const def = input.deliverableDefs[i];
      await client.query(
        `INSERT INTO step_deliverable_defs (step_id, kind, label, sort_order) VALUES ($1, $2, $3, $4)`,
        [newStepId, def.kind, def.label, i]
      );
    }

    return newStepId;
  });

  const created = await getStepById(stepId);
  if (!created) throw new Error("Failed to load created step");
  return { ok: true, step: created };
}

export async function updateStep(
  id: number,
  input: {
    title: string;
    notes: string;
    startAt: Date;
    endAt: Date | null;
    assigneeId: number | null;
    requiresDeliverable: boolean;
    // Existing deliverable defs are managed via their own
    // /api/plans/steps/[id]/deliverables/** routes, not here — this only
    // ever appends brand-new ones (matches how the edit form only offers
    // "add another placeholder," never editing/reordering existing ones).
    newDeliverableDefs?: { kind: DeliverableKind; label: string }[];
  }
): Promise<{ ok: true; step: StepRow } | { ok: false; error: string }> {
  const existing = await getStepById(id);
  if (!existing) return { ok: false, error: "Not found" };

  const timingError = validateEventTiming({
    type: existing.step_type,
    isTentative: false,
    startAt: input.startAt,
    endAt: input.endAt,
  });
  if (timingError) return { ok: false, error: timingError };

  const eventStatus: TaskStatus =
    existing.step_type === "task"
      ? input.assigneeId !== null
        ? existing.event_status === "backlog"
          ? "pending"
          : existing.event_status
        : "backlog"
      : "backlog";

  await updateEvent(existing.event_id, {
    title: input.title,
    description: "",
    type: existing.step_type,
    isTentative: false,
    startAt: input.startAt,
    endAt: input.endAt,
    assigneeId: input.assigneeId,
    status: eventStatus,
  });

  // Editing the due date resets the overdue reminder flag if it was
  // already sent — mirrors updateEvent's own start/end-reminder reset
  // (src/lib/events.ts), so a rescheduled step can be reminded again if
  // it becomes overdue on its new date.
  const dueDateChanged =
    input.startAt.getTime() !== existing.start_at.getTime() ||
    (input.endAt?.getTime() ?? null) !== (existing.end_at?.getTime() ?? null);

  // $4 is cast explicitly — the earlier `completed_by` bug (see
  // docs/handover.md) was exactly this shape (a bare parameter inside a
  // CASE alongside a differently-typed branch) tripping Postgres's type
  // inference; not leaving that to chance again here.
  await query(
    `UPDATE steps SET notes = $1, requires_deliverable = $2, updated_at = now(),
       overdue_reminder_sent_at = CASE WHEN $4::boolean THEN NULL ELSE overdue_reminder_sent_at END
     WHERE id = $3`,
    [input.notes, input.requiresDeliverable, id, dueDateChanged]
  );

  if (input.newDeliverableDefs && input.newDeliverableDefs.length > 0) {
    const existingCount = existing.deliverable_defs.length;
    for (let i = 0; i < input.newDeliverableDefs.length; i++) {
      const def = input.newDeliverableDefs[i];
      await query(`INSERT INTO step_deliverable_defs (step_id, kind, label, sort_order) VALUES ($1, $2, $3, $4)`, [
        id,
        def.kind,
        def.label,
        existingCount + i,
      ]);
    }
  }

  const updated = await getStepById(id);
  if (!updated) throw new Error("Failed to load updated step");
  return { ok: true, step: updated };
}

// Deletes the step's backing event, which cascades to delete the step row
// itself (steps.event_id ON DELETE CASCADE) — there is intentionally no
// separate "delete the step row" path, since a step with no Calendar
// entry would contradict "they're the same record." Also cleans up any
// deliverable files uploaded under this step (best-effort, after the DB
// delete — see lib/planDeliverables.ts's deleteDeliverableDef for the
// same reasoning), since the cascade only reaches DB rows, not Blob
// storage.
export async function deleteStep(id: number): Promise<void> {
  const step = await getStepById(id);
  if (!step) return;
  const blobUrls = step.deliverable_defs.flatMap((def) => def.files.map((f) => f.blob_url));
  await query(`DELETE FROM events WHERE id = $1`, [step.event_id]);
  await Promise.all(blobUrls.map((url) => del(url).catch(() => {})));
}

// BFS over the prerequisite graph: does `fromStepId` already (transitively)
// depend on `targetStepId`? Used to reject an edge that would close a
// cycle before it's ever written.
async function dependsOn(fromStepId: number, targetStepId: number): Promise<boolean> {
  const visited = new Set<number>([fromStepId]);
  let frontier = [fromStepId];
  while (frontier.length > 0) {
    const res = await query<{ prerequisite_step_id: number }>(
      `SELECT DISTINCT prerequisite_step_id FROM step_prerequisites WHERE step_id = ANY($1::int[])`,
      [frontier]
    );
    const next: number[] = [];
    for (const row of res.rows) {
      if (row.prerequisite_step_id === targetStepId) return true;
      if (!visited.has(row.prerequisite_step_id)) {
        visited.add(row.prerequisite_step_id);
        next.push(row.prerequisite_step_id);
      }
    }
    frontier = next;
  }
  return false;
}

// Replaces a step's full prerequisite list — confirmed 2026-09-18: "a real
// graph, not a strict chain," so a step can have more than one.
export async function setStepPrerequisites(
  stepId: number,
  planId: number,
  prerequisiteStepIds: number[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const uniqueIds = Array.from(new Set(prerequisiteStepIds));
  if (uniqueIds.includes(stepId)) {
    return { ok: false, error: "A step can't be its own prerequisite" };
  }
  if (uniqueIds.length > 0) {
    const res = await query<{ id: number }>(
      `SELECT id FROM steps WHERE id = ANY($1::int[]) AND plan_id = $2`,
      [uniqueIds, planId]
    );
    if (res.rows.length !== uniqueIds.length) {
      return { ok: false, error: "A prerequisite must be another step in the same plan" };
    }
    for (const prereqId of uniqueIds) {
      if (await dependsOn(prereqId, stepId)) {
        return { ok: false, error: "That prerequisite would create a circular dependency" };
      }
    }
  }
  await query(`DELETE FROM step_prerequisites WHERE step_id = $1`, [stepId]);
  if (uniqueIds.length > 0) {
    const values = uniqueIds.map((_, i) => `($1, $${i + 2})`).join(", ");
    await query(`INSERT INTO step_prerequisites (step_id, prerequisite_step_id) VALUES ${values}`, [
      stepId,
      ...uniqueIds,
    ]);
  }
  return { ok: true };
}

export type StepDoneCheckResult =
  | { ok: true }
  | { ok: false; reason: "prerequisite_unmet" | "deliverable_incomplete" | "milestone_prerequisite_unmet" };

// For a Meeting step, Minutes of Meeting IS the deliverable (per the
// roadmap) — any deliverable_defs it also carries are bonus/optional
// attachments, not gating. For a Task step, every deliverable def must be
// filled. A requires_deliverable step with zero defs defined (an
// authoring gap, not a real workflow state) passes trivially rather than
// permanently blocking — matches the Phase 1 stub's fallback behavior.
function isDeliverableGateSatisfied(step: StepRow): boolean {
  if (step.step_type === "meeting") {
    return isMinutesOfMeetingFilled(step.minutes_of_meeting);
  }
  if (step.deliverable_defs.length === 0) return true;
  return step.deliverable_defs.every((def) => isDeliverableDefFilled(def));
}

// A Stage's own Milestone can carry a prerequisite Milestone (Phase 3) —
// attempting to mark ANY step inside a Milestone B's Stage as done is
// rejected while B has an unmet prerequisite Milestone (confirmed
// 2026-09-18), enforced live via the prerequisite's own rollup progress
// rather than a stored flag. Not a Stage (parent_milestone_id null, i.e.
// every Phase 1/2 plan) or a Milestone with no prerequisite set both pass
// trivially — this only ever fires once Phase 3's Strategy/Milestone
// structure is actually in use.
async function isMilestonePrerequisiteSatisfied(planId: number): Promise<boolean> {
  const planRes = await query<{ parent_milestone_id: number | null }>(
    `SELECT parent_milestone_id FROM plans WHERE id = $1`,
    [planId]
  );
  const parentMilestoneId = planRes.rows[0]?.parent_milestone_id ?? null;
  if (parentMilestoneId === null) return true;

  const msRes = await query<{ prerequisite_milestone_id: number | null }>(
    `SELECT prerequisite_milestone_id FROM milestones WHERE id = $1`,
    [parentMilestoneId]
  );
  const prerequisiteMilestoneId = msRes.rows[0]?.prerequisite_milestone_id ?? null;
  if (prerequisiteMilestoneId === null) return true;

  const progress = await getMilestoneProgress(prerequisiteMilestoneId);
  return progress.progress >= 100;
}

export async function checkCanMarkStepDone(step: StepRow): Promise<StepDoneCheckResult> {
  if (step.prerequisite_step_ids.length > 0) {
    const res = await query<{ status: StepStatus }>(`SELECT status FROM steps WHERE id = ANY($1::int[])`, [
      step.prerequisite_step_ids,
    ]);
    if (!prerequisitesSatisfied(res.rows)) {
      return { ok: false, reason: "prerequisite_unmet" };
    }
  }
  if (!(await isMilestonePrerequisiteSatisfied(step.plan_id))) {
    return { ok: false, reason: "milestone_prerequisite_unmet" };
  }
  if (step.requires_deliverable && !isDeliverableGateSatisfied(step)) {
    return { ok: false, reason: "deliverable_incomplete" };
  }
  return { ok: true };
}

// The gated status transition. blocked/skipped/na are always settable
// (they're the explicit escape hatches for "this isn't completing
// normally") — only a transition TO 'done' goes through
// checkCanMarkStepDone. Deliberately does not also flip the backing
// event's Calendar TaskStatus (see StepRow's event_status comment) — kept
// as two independent views on this step's completion for Phase 1 rather
// than a partial/one-directional sync that could itself become a source
// of confusion; worth revisiting if the plan/Calendar views are found to
// disagree in practice.
export async function updateStepStatus(
  id: number,
  status: StepStatus,
  actorUid: number
): Promise<
  | { ok: true; step: StepRow }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "prerequisite_unmet" | "deliverable_incomplete" | "milestone_prerequisite_unmet" }
> {
  const step = await getStepById(id);
  if (!step) return { ok: false, reason: "not_found" };

  if (status === "done") {
    const check = await checkCanMarkStepDone(step);
    if (!check.ok) return check;
  }

  await query(
    `UPDATE steps
     SET status = $1, updated_at = now(),
         completed_at = CASE WHEN $1 = 'done' THEN now() ELSE NULL END,
         completed_by = CASE WHEN $1 = 'done' THEN $2::integer ELSE NULL END
     WHERE id = $3`,
    [status, actorUid, id]
  );
  const updated = await getStepById(id);
  if (!updated) return { ok: false, reason: "not_found" };
  return { ok: true, step: updated };
}
