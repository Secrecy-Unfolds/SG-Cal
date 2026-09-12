import { query } from "@/lib/db";

export type IdeaRow = {
  id: number;
  name: string;
  description: string;
  prerequisites: string;
  expected_start_date: string | null; // "YYYY-MM-DD"
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
  updated_at: Date;
};

const IDEA_SELECT = `
  SELECT i.id, i.name, i.description, i.prerequisites, i.expected_start_date,
         i.created_by, u.username AS created_by_username, i.created_at, i.updated_at
  FROM ideas i
  LEFT JOIN users u ON u.id = i.created_by
`;

export async function listIdeas(): Promise<IdeaRow[]> {
  const res = await query<IdeaRow>(`${IDEA_SELECT} ORDER BY i.created_at DESC`);
  return res.rows;
}

export async function getIdeaById(id: number): Promise<IdeaRow | null> {
  const res = await query<IdeaRow>(`${IDEA_SELECT} WHERE i.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function createIdea(input: {
  name: string;
  description: string;
  prerequisites: string;
  expectedStartDate: string | null;
  createdBy: number;
}): Promise<IdeaRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO ideas (name, description, prerequisites, expected_start_date, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.name, input.description, input.prerequisites, input.expectedStartDate, input.createdBy]
  );
  const created = await getIdeaById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created idea");
  return created;
}

export async function updateIdea(
  id: number,
  input: { name: string; description: string; prerequisites: string; expectedStartDate: string | null }
): Promise<IdeaRow | null> {
  await query(
    `UPDATE ideas
     SET name = $1, description = $2, prerequisites = $3, expected_start_date = $4, updated_at = now()
     WHERE id = $5`,
    [input.name, input.description, input.prerequisites, input.expectedStartDate, id]
  );
  return getIdeaById(id);
}

export async function deleteIdea(id: number): Promise<void> {
  await query(`DELETE FROM ideas WHERE id = $1`, [id]);
}
