import { query } from "@/lib/db";

export type ClosedPeriodRow = {
  id: number;
  period_start: string; // "YYYY-MM-DD"
  period_end: string;
  label: string;
  closed_by: number | null;
  closed_by_username: string | null;
  closed_at: Date;
  reopened_by: number | null;
  reopened_by_username: string | null;
  reopened_at: Date | null;
};

const PERIOD_SELECT = `
  SELECT p.id, p.period_start, p.period_end, p.label,
         p.closed_by, cu.username AS closed_by_username, p.closed_at,
         p.reopened_by, ru.username AS reopened_by_username, p.reopened_at
  FROM closed_periods p
  LEFT JOIN users cu ON cu.id = p.closed_by
  LEFT JOIN users ru ON ru.id = p.reopened_by
`;

export async function listClosedPeriods(): Promise<ClosedPeriodRow[]> {
  const res = await query<ClosedPeriodRow>(`${PERIOD_SELECT} ORDER BY p.period_start DESC, p.id DESC`);
  return res.rows;
}

export async function getClosedPeriodById(id: number): Promise<ClosedPeriodRow | null> {
  const res = await query<ClosedPeriodRow>(`${PERIOD_SELECT} WHERE p.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function closePeriod(input: {
  periodStart: string;
  periodEnd: string;
  label: string;
  closedBy: number;
}): Promise<ClosedPeriodRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO closed_periods (period_start, period_end, label, closed_by) VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.periodStart, input.periodEnd, input.label, input.closedBy]
  );
  const created = await getClosedPeriodById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created closed period");
  return created;
}

// Super-Admin-only, enforced by the caller (API route) — mirrors the
// Settings page's existing Super-Admin-only gate. Keeps the row (rather
// than deleting it) so the closing history stays auditable.
export async function reopenPeriod(id: number, reopenedBy: number): Promise<ClosedPeriodRow | null> {
  await query(`UPDATE closed_periods SET reopened_by = $1, reopened_at = now() WHERE id = $2`, [reopenedBy, id]);
  return getClosedPeriodById(id);
}

// Used by lib/accounting.ts to block creating/deleting a transaction dated
// inside a still-closed period.
export async function isDateInClosedPeriod(date: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM closed_periods WHERE reopened_at IS NULL AND period_start <= $1 AND period_end >= $1 LIMIT 1`,
    [date]
  );
  return res.rows.length > 0;
}
