import { query } from "@/lib/db";
import { getTransactionById } from "@/lib/accounting";
import type { RecurringExpenseFrequency } from "@/lib/accountingDisplay";
import { toMuscatDateInput } from "@/lib/time";

export type RecurringIncomeRow = {
  id: number;
  description: string;
  category: string;
  amount: string; // numeric comes back as a string from pg
  currency: string;
  frequency: RecurringExpenseFrequency;
  next_run_date: string; // "YYYY-MM-DD"
  active: boolean;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
  updated_at: Date;
};

const RECURRING_SELECT = `
  SELECT r.id, r.description, r.category, r.amount, r.currency, r.frequency, r.next_run_date, r.active,
         r.created_by, u.username AS created_by_username, r.created_at, r.updated_at
  FROM recurring_income r
  LEFT JOIN users u ON u.id = r.created_by
`;

export async function listRecurringIncome(): Promise<RecurringIncomeRow[]> {
  const res = await query<RecurringIncomeRow>(`${RECURRING_SELECT} ORDER BY r.next_run_date ASC, r.id DESC`);
  return res.rows;
}

export async function getRecurringIncomeById(id: number): Promise<RecurringIncomeRow | null> {
  const res = await query<RecurringIncomeRow>(`${RECURRING_SELECT} WHERE r.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function createRecurringIncome(input: {
  description: string;
  category: string;
  amount: number;
  currency: string;
  frequency: RecurringExpenseFrequency;
  nextRunDate: string;
  createdBy: number;
}): Promise<RecurringIncomeRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO recurring_income (description, category, amount, currency, frequency, next_run_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [input.description, input.category, input.amount, input.currency, input.frequency, input.nextRunDate, input.createdBy]
  );
  const created = await getRecurringIncomeById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created recurring income");
  return created;
}

export async function updateRecurringIncome(
  id: number,
  input: {
    description: string;
    category: string;
    amount: number;
    currency: string;
    frequency: RecurringExpenseFrequency;
    nextRunDate: string;
    active: boolean;
  }
): Promise<RecurringIncomeRow | null> {
  await query(
    `UPDATE recurring_income
     SET description = $1, category = $2, amount = $3, currency = $4, frequency = $5, next_run_date = $6, active = $7, updated_at = now()
     WHERE id = $8`,
    [input.description, input.category, input.amount, input.currency, input.frequency, input.nextRunDate, input.active, id]
  );
  return getRecurringIncomeById(id);
}

export async function deleteRecurringIncome(id: number): Promise<void> {
  await query(`DELETE FROM recurring_income WHERE id = $1`, [id]);
}

const FREQUENCY_INTERVAL: Record<RecurringExpenseFrequency, string> = {
  weekly: "1 week",
  monthly: "1 month",
  quarterly: "3 months",
  yearly: "1 year",
};

// Mirrors lib/recurringExpenses.ts's processRecurringExpenses() — called
// from the same reminder-sweep cron. Income never goes through the
// expense-approval threshold, so this always posts 'approved' immediately.
export async function processRecurringIncome(): Promise<{ posted: number }> {
  const today = toMuscatDateInput(new Date());
  const due = await query<RecurringIncomeRow>(`${RECURRING_SELECT} WHERE r.active = true AND r.next_run_date <= $1`, [today]);

  let posted = 0;
  for (const r of due.rows) {
    const res = await query<{ id: number }>(
      `INSERT INTO accounting_transactions (date, description, amount, currency, type, category, recurring_income_id, status)
       VALUES ($1, $2, $3, $4, 'income', $5, $6, 'approved') RETURNING id`,
      [r.next_run_date, r.description, r.amount, r.currency, r.category, r.id]
    );
    await getTransactionById(res.rows[0].id);

    await query(`UPDATE recurring_income SET next_run_date = next_run_date + ($1)::interval, updated_at = now() WHERE id = $2`, [
      FREQUENCY_INTERVAL[r.frequency],
      r.id,
    ]);
    posted++;
  }

  return { posted };
}
