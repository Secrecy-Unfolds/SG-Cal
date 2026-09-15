import { query } from "@/lib/db";
import { postCapitalEntry } from "@/lib/capital";
import type { SupporterType } from "@/lib/governmentSupportDisplay";

export type GovernmentSupporterRow = {
  id: number;
  name: string;
  supporter_type: SupporterType;
  contact: string;
  created_at: Date;
};

export async function listGovernmentSupporters(): Promise<GovernmentSupporterRow[]> {
  const res = await query<GovernmentSupporterRow>(
    `SELECT id, name, supporter_type, contact, created_at FROM government_supporters ORDER BY name`
  );
  return res.rows;
}

export async function getGovernmentSupporterById(id: number): Promise<GovernmentSupporterRow | null> {
  const res = await query<GovernmentSupporterRow>(
    `SELECT id, name, supporter_type, contact, created_at FROM government_supporters WHERE id = $1`,
    [id]
  );
  return res.rows[0] ?? null;
}

export async function createGovernmentSupporter(input: {
  name: string;
  supporterType: SupporterType;
  contact: string;
}): Promise<GovernmentSupporterRow> {
  const res = await query<GovernmentSupporterRow>(
    `INSERT INTO government_supporters (name, supporter_type, contact) VALUES ($1, $2, $3)
     RETURNING id, name, supporter_type, contact, created_at`,
    [input.name, input.supporterType, input.contact]
  );
  return res.rows[0];
}

export async function updateGovernmentSupporter(
  id: number,
  input: { name: string; supporterType: SupporterType; contact: string }
): Promise<GovernmentSupporterRow | null> {
  const res = await query<GovernmentSupporterRow>(
    `UPDATE government_supporters SET name = $1, supporter_type = $2, contact = $3 WHERE id = $4
     RETURNING id, name, supporter_type, contact, created_at`,
    [input.name, input.supporterType, input.contact, id]
  );
  return res.rows[0] ?? null;
}

// Cascades via the schema's FK: government_support.supporter_id is ON DELETE
// CASCADE. The capital_entries rows those support records posted are kept,
// same as deleteInvestor() in lib/investors.ts.
export async function deleteGovernmentSupporter(id: number): Promise<void> {
  await query(`DELETE FROM government_supporters WHERE id = $1`, [id]);
}

export type GovernmentSupportRow = {
  id: number;
  supporter_id: number;
  supporter_name: string;
  amount: string;
  currency: string;
  date: string;
  expectations: string | null;
  capital_entry_id: number | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

const SUPPORT_SELECT = `
  SELECT g.id, g.supporter_id, s.name AS supporter_name, g.amount, g.currency, g.date, g.expectations,
         g.capital_entry_id, g.created_by, u.username AS created_by_username, g.created_at
  FROM government_support g
  JOIN government_supporters s ON s.id = g.supporter_id
  LEFT JOIN users u ON u.id = g.created_by
`;

export async function listGovernmentSupport(): Promise<GovernmentSupportRow[]> {
  const res = await query<GovernmentSupportRow>(`${SUPPORT_SELECT} ORDER BY g.date DESC, g.id DESC`);
  return res.rows;
}

export async function listGovernmentSupportForSupporter(supporterId: number): Promise<GovernmentSupportRow[]> {
  const res = await query<GovernmentSupportRow>(`${SUPPORT_SELECT} WHERE g.supporter_id = $1 ORDER BY g.date DESC, g.id DESC`, [
    supporterId,
  ]);
  return res.rows;
}

export async function getGovernmentSupportById(id: number): Promise<GovernmentSupportRow | null> {
  const res = await query<GovernmentSupportRow>(`${SUPPORT_SELECT} WHERE g.id = $1`, [id]);
  return res.rows[0] ?? null;
}

// Auto-posts a matching capital_entries row (source: "government"), same
// pattern as createInvestment() in lib/investors.ts. `expectations` is
// nullable/optional — most government/Royal support has none, per the "no
// expectation of return by default" design.
export async function createGovernmentSupport(input: {
  supporterId: number;
  amount: number;
  currency: string;
  date: string;
  expectations: string | null;
  createdBy: number;
}): Promise<GovernmentSupportRow> {
  const supporter = await getGovernmentSupporterById(input.supporterId);
  if (!supporter) throw new Error("Supporter not found");

  const capitalEntry = await postCapitalEntry({
    source: "government",
    amount: input.amount,
    currency: input.currency,
    date: input.date,
    description: `Support from ${supporter.name}`,
    createdBy: input.createdBy,
  });

  const res = await query<{ id: number }>(
    `INSERT INTO government_support (supporter_id, amount, currency, date, expectations, capital_entry_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [input.supporterId, input.amount, input.currency, input.date, input.expectations, capitalEntry.id, input.createdBy]
  );
  const created = await getGovernmentSupportById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created government support record");
  return created;
}

export async function deleteGovernmentSupport(id: number): Promise<void> {
  await query(`DELETE FROM government_support WHERE id = $1`, [id]);
}
