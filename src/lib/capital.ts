import { query } from "@/lib/db";
import type { CapitalSource } from "@/lib/capitalDisplay";

export type CapitalEntryRow = {
  id: number;
  source: CapitalSource;
  amount: string; // numeric comes back as a string from pg
  currency: string;
  date: string; // "YYYY-MM-DD"
  description: string;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

const CAPITAL_ENTRY_SELECT = `
  SELECT c.id, c.source, c.amount, c.currency, c.date, c.description,
         c.created_by, u.username AS created_by_username, c.created_at
  FROM capital_entries c
  LEFT JOIN users u ON u.id = c.created_by
`;

export async function listCapitalEntries(): Promise<CapitalEntryRow[]> {
  const res = await query<CapitalEntryRow>(`${CAPITAL_ENTRY_SELECT} ORDER BY c.date DESC, c.id DESC`);
  return res.rows;
}

export async function getCapitalEntryById(id: number): Promise<CapitalEntryRow | null> {
  const res = await query<CapitalEntryRow>(`${CAPITAL_ENTRY_SELECT} WHERE c.id = $1`, [id]);
  return res.rows[0] ?? null;
}

// Shared insert used both for manual entries (owner contributions, loans,
// grants, "other") and, as postCapitalEntry below, for the "one action,
// linked auto-posting" flow from investments/government support — mirroring
// postExpenseForPurchaseOrder() in lib/accounting.ts.
export async function createCapitalEntry(input: {
  source: CapitalSource;
  amount: number;
  currency: string;
  date: string;
  description: string;
  createdBy: number | null;
}): Promise<CapitalEntryRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO capital_entries (source, amount, currency, date, description, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.source, input.amount, input.currency, input.date, input.description, input.createdBy]
  );
  const created = await getCapitalEntryById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created capital entry");
  return created;
}

export async function deleteCapitalEntry(id: number): Promise<void> {
  await query(`DELETE FROM capital_entries WHERE id = $1`, [id]);
}

// Called by lib/investors.ts (on investment creation) and
// lib/governmentSupport.ts (on support-record creation). Returns the created
// capital_entries row so the caller can store its id back on the
// investment/support record.
export const postCapitalEntry = createCapitalEntry;
