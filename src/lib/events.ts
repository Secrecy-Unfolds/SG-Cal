import { query } from "@/lib/db";

export type EventType = "meeting" | "task";

export function isEventType(value: unknown): value is EventType {
  return value === "meeting" || value === "task";
}

export type EventRow = {
  id: number;
  title: string;
  description: string;
  type: EventType;
  start_at: Date;
  end_at: Date | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

const SELECT_BASE = `
  SELECT e.id, e.title, e.description, e.type, e.start_at, e.end_at, e.created_by,
         u.username AS created_by_username, e.created_at
  FROM events e
  LEFT JOIN users u ON u.id = e.created_by
`;

export async function listEventsBetween(start: Date, end: Date): Promise<EventRow[]> {
  const res = await query<EventRow>(
    `${SELECT_BASE} WHERE e.start_at >= $1 AND e.start_at < $2 ORDER BY e.start_at ASC`,
    [start, end]
  );
  return res.rows;
}

export async function listUpcomingEvents(from: Date): Promise<EventRow[]> {
  const res = await query<EventRow>(
    `${SELECT_BASE} WHERE e.start_at >= $1 ORDER BY e.start_at ASC`,
    [from]
  );
  return res.rows;
}

export async function getEventById(id: number): Promise<EventRow | null> {
  const res = await query<EventRow>(`${SELECT_BASE} WHERE e.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function createEvent(input: {
  title: string;
  description: string;
  type: EventType;
  startAt: Date;
  endAt: Date | null;
  createdBy: number;
}): Promise<EventRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO events (title, description, type, start_at, end_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.title, input.description, input.type, input.startAt, input.endAt, input.createdBy]
  );
  const created = await getEventById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created event");
  return created;
}

export async function updateEvent(
  id: number,
  input: { title: string; description: string; type: EventType; startAt: Date; endAt: Date | null }
): Promise<EventRow | null> {
  // Editing the time resets whichever reminders haven't fired yet, so they're
  // recomputed against the new schedule instead of silently skipped.
  await query(
    `UPDATE events
     SET title = $1, description = $2, type = $3, start_at = $4, end_at = $5,
         start_reminder_sent_at = CASE WHEN start_at IS DISTINCT FROM $4 THEN NULL ELSE start_reminder_sent_at END,
         end_reminder_sent_at = CASE WHEN end_at IS DISTINCT FROM $5 THEN NULL ELSE end_reminder_sent_at END
     WHERE id = $6`,
    [input.title, input.description, input.type, input.startAt, input.endAt, id]
  );
  return getEventById(id);
}

export async function deleteEvent(id: number): Promise<void> {
  await query(`DELETE FROM events WHERE id = $1`, [id]);
}

// Meetings starting within the next hour that haven't had their "starting soon" email sent yet.
export async function listMeetingsNeedingStartReminder(): Promise<EventRow[]> {
  const res = await query<EventRow>(
    `${SELECT_BASE}
     WHERE e.type = 'meeting'
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
