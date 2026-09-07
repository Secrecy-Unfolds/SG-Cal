import { query } from "@/lib/db";

export type EventRow = {
  id: number;
  title: string;
  description: string;
  start_at: Date;
  end_at: Date | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

const SELECT_BASE = `
  SELECT e.id, e.title, e.description, e.start_at, e.end_at, e.created_by,
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
  startAt: Date;
  endAt: Date | null;
  createdBy: number;
}): Promise<EventRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO events (title, description, start_at, end_at, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.title, input.description, input.startAt, input.endAt, input.createdBy]
  );
  const created = await getEventById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created event");
  return created;
}

export async function updateEvent(
  id: number,
  input: { title: string; description: string; startAt: Date; endAt: Date | null }
): Promise<EventRow | null> {
  await query(
    `UPDATE events SET title = $1, description = $2, start_at = $3, end_at = $4 WHERE id = $5`,
    [input.title, input.description, input.startAt, input.endAt, id]
  );
  return getEventById(id);
}

export async function deleteEvent(id: number): Promise<void> {
  await query(`DELETE FROM events WHERE id = $1`, [id]);
}
