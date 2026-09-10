import { query } from "@/lib/db";
import type { UserRole } from "@/lib/users";

export type EventType = "meeting" | "task";

export function isEventType(value: unknown): value is EventType {
  return value === "meeting" || value === "task";
}

export type TaskStatus = "backlog" | "pending" | "in_progress" | "review_needed" | "closed";

export const TASK_STATUSES: TaskStatus[] = ["backlog", "pending", "in_progress", "review_needed", "closed"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  pending: "Pending",
  in_progress: "In Progress",
  review_needed: "Review Needed",
  closed: "Closed",
};

export function isTaskStatus(value: unknown): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

export type EventRow = {
  id: number;
  title: string;
  description: string;
  type: EventType;
  is_tentative: boolean;
  start_at: Date;
  end_at: Date | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
  assignee_id: number | null;
  assignee_username: string | null;
  status: TaskStatus;
};

const SELECT_BASE = `
  SELECT e.id, e.title, e.description, e.type, e.is_tentative, e.start_at, e.end_at, e.created_by,
         u.username AS created_by_username, e.created_at,
         e.assignee_id, au.username AS assignee_username, e.status
  FROM events e
  LEFT JOIN users u ON u.id = e.created_by
  LEFT JOIN users au ON au.id = e.assignee_id
`;

// Fixed events match if their start falls in [start, end); tentative (date-range)
// meetings match if their range overlaps [start, end) at all, so they show up
// on every day they might happen, not just their range's first day.
export async function listEventsBetween(start: Date, end: Date): Promise<EventRow[]> {
  const res = await query<EventRow>(
    `${SELECT_BASE}
     WHERE (e.is_tentative = false AND e.start_at >= $1 AND e.start_at < $2)
        OR (e.is_tentative = true AND e.start_at < $2 AND e.end_at >= $1)
     ORDER BY e.start_at ASC`,
    [start, end]
  );
  return res.rows;
}

// Fixed events are "upcoming" while their start is still ahead; tentative
// ones stay upcoming until the whole range has passed.
export async function listUpcomingEvents(from: Date): Promise<EventRow[]> {
  const res = await query<EventRow>(
    `${SELECT_BASE}
     WHERE (e.is_tentative = false AND e.start_at >= $1)
        OR (e.is_tentative = true AND e.end_at >= $1)
     ORDER BY e.start_at ASC`,
    [from]
  );
  return res.rows;
}

// Shared validation for POST (create) and PUT (update): only meetings can be
// tentative/date-range, tentative ones need a range end, and fixed tasks
// still need a due time for the 3-hours-before reminder.
export function validateEventTiming(input: {
  type: EventType;
  isTentative: boolean;
  startAt: Date;
  endAt: Date | null;
}): string | null {
  if (input.isTentative && input.type !== "meeting") {
    return "Only meetings can be tentative/date-range";
  }
  if (input.isTentative) {
    if (!input.endAt) return "Tentative meetings need a range end date";
    if (input.endAt.getTime() < input.startAt.getTime()) {
      return "Range end must be on or after the start date";
    }
    return null;
  }
  if (input.type === "task" && !input.endAt) {
    return "Tasks need a due/end time so the 3-hours-before reminder can fire";
  }
  return null;
}

export type TaskAssignmentResult =
  | { ok: true; assigneeId: number | null; status: TaskStatus }
  | { ok: false; error: string; httpStatus: number };

// Resolves + validates who a task is assigned to and what status it lands
// on, given who's making the request:
// - Non-tasks (meetings) never have an assignee/status — always backlog/null.
// - A "user" can only assign to themselves (or leave unassigned).
// - Admin-level (admin/super_admin) can assign to anyone that exists.
// - Unassigned always means status "backlog"; assigning defaults to
//   "pending" unless a different valid status was explicitly requested.
// - Setting status to "closed" (from anything else, including on create)
//   requires admin-level — this is the "Review Needed -> Closed" gate,
//   generalized so a non-admin can't shortcut it via a different status.
export async function resolveTaskAssignment(input: {
  type: EventType;
  actorUid: number;
  actorRole: UserRole;
  requestedAssigneeId: number | null;
  requestedStatus: TaskStatus | null;
  previousStatus?: TaskStatus;
}): Promise<TaskAssignmentResult> {
  if (input.type !== "task") {
    return { ok: true, assigneeId: null, status: "backlog" };
  }

  const assigneeId = input.requestedAssigneeId;

  if (assigneeId !== null) {
    if (input.actorRole === "user" && assigneeId !== input.actorUid) {
      return { ok: false, error: "Users can only assign tasks to themselves", httpStatus: 403 };
    }
    const exists = await query<{ id: number }>("SELECT id FROM users WHERE id = $1", [assigneeId]);
    if (exists.rows.length === 0) {
      return { ok: false, error: "Assignee not found", httpStatus: 400 };
    }
  }

  const status: TaskStatus =
    assigneeId === null
      ? "backlog"
      : input.requestedStatus && input.requestedStatus !== "backlog"
      ? input.requestedStatus
      : "pending";

  if (status === "closed" && status !== input.previousStatus && input.actorRole === "user") {
    return { ok: false, error: "Only Admin level can close a task", httpStatus: 403 };
  }

  return { ok: true, assigneeId, status };
}

// Meetings stay open to everyone to edit. A task can only be edited/deleted
// by admin-level or its assignee — an unassigned (backlog) task is fair
// game for anyone, since nobody owns it yet.
export function canEditTask(
  actor: { uid: number; role: UserRole },
  existing: Pick<EventRow, "type" | "assignee_id">
): boolean {
  if (existing.type !== "task") return true;
  if (actor.role !== "user") return true;
  return existing.assignee_id === null || existing.assignee_id === actor.uid;
}

export async function getEventById(id: number): Promise<EventRow | null> {
  const res = await query<EventRow>(`${SELECT_BASE} WHERE e.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function createEvent(input: {
  title: string;
  description: string;
  type: EventType;
  isTentative: boolean;
  startAt: Date;
  endAt: Date | null;
  createdBy: number;
  assigneeId: number | null;
  status: TaskStatus;
}): Promise<EventRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO events (title, description, type, is_tentative, start_at, end_at, created_by, assignee_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      input.title,
      input.description,
      input.type,
      input.isTentative,
      input.startAt,
      input.endAt,
      input.createdBy,
      input.assigneeId,
      input.status,
    ]
  );
  const created = await getEventById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created event");
  return created;
}

export async function updateEvent(
  id: number,
  input: {
    title: string;
    description: string;
    type: EventType;
    isTentative: boolean;
    startAt: Date;
    endAt: Date | null;
    assigneeId: number | null;
    status: TaskStatus;
  }
): Promise<EventRow | null> {
  // Editing the time resets whichever reminders haven't fired yet, so they're
  // recomputed against the new schedule instead of silently skipped.
  await query(
    `UPDATE events
     SET title = $1, description = $2, type = $3, is_tentative = $4, start_at = $5, end_at = $6,
         assignee_id = $7, status = $8,
         start_reminder_sent_at = CASE WHEN start_at IS DISTINCT FROM $5 THEN NULL ELSE start_reminder_sent_at END,
         end_reminder_sent_at = CASE WHEN end_at IS DISTINCT FROM $6 THEN NULL ELSE end_reminder_sent_at END
     WHERE id = $9`,
    [
      input.title,
      input.description,
      input.type,
      input.isTentative,
      input.startAt,
      input.endAt,
      input.assigneeId,
      input.status,
      id,
    ]
  );
  return getEventById(id);
}

export async function deleteEvent(id: number): Promise<void> {
  await query(`DELETE FROM events WHERE id = $1`, [id]);
}

// Meetings starting within the next hour that haven't had their "starting soon"
// email sent yet. Tentative meetings have no fixed start, so they never qualify.
export async function listMeetingsNeedingStartReminder(): Promise<EventRow[]> {
  const res = await query<EventRow>(
    `${SELECT_BASE}
     WHERE e.type = 'meeting'
       AND e.is_tentative = false
       AND e.start_reminder_sent_at IS NULL
       AND e.start_at > now()
       AND e.start_at <= now() + interval '1 hour'
     ORDER BY e.start_at ASC`
  );
  return res.rows;
}

// Tasks ending within the next 3 hours that haven't had their "due soon" email sent yet.
export async function listTasksNeedingEndReminder(): Promise<EventRow[]> {
  const res = await query<EventRow>(
    `${SELECT_BASE}
     WHERE e.type = 'task'
       AND e.end_at IS NOT NULL
       AND e.end_reminder_sent_at IS NULL
       AND e.end_at > now()
       AND e.end_at <= now() + interval '3 hours'
     ORDER BY e.end_at ASC`
  );
  return res.rows;
}

export async function markStartReminderSent(id: number): Promise<void> {
  await query(`UPDATE events SET start_reminder_sent_at = now() WHERE id = $1`, [id]);
}

export async function markEndReminderSent(id: number): Promise<void> {
  await query(`UPDATE events SET end_reminder_sent_at = now() WHERE id = $1`, [id]);
}
