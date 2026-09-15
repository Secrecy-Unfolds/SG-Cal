import { query } from "@/lib/db";
import { getTransactionById } from "@/lib/accounting";
import type { RecurringExpenseFrequency } from "@/lib/accountingDisplay";
import { toMuscatDateInput } from "@/lib/time";

export type RecurringExpenseRow = {
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
  FROM recurring_expenses r
  LEFT JOIN users u ON u.id = r.created_by
`;

export async function listRecurringExpenses(): Promise<RecurringExpenseRow[]> {
  const res = await query<RecurringExpenseRow>(`${RECURRING_SELECT} ORDER BY r.next_run_date ASC, r.id DESC`);
  return res.rows;
}

export async function getRecurringExpenseById(id: number): Promise<RecurringExpenseRow | null> {
  const res = await query<RecurringExpenseRow>(`${RECURRING_SELECT} WHERE r.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function createRecurringExpense(input: {
  description: string;
  category: string;
  amount: number;
  currency: string;
  frequency: RecurringExpenseFrequency;
  nextRunDate: string;
  createdBy: number;
}): Promise<RecurringExpenseRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO recurring_expenses (description, category, amount, currency, frequency, next_run_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [input.description, input.category, input.amount, input.currency, input.frequency, input.nextRunDate, input.createdBy]
  );
  const created = await getRecurringExpenseById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created recurring expense");
  return created;
}

export async function updateRecurringExpense(
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
): Promise<RecurringExpenseRow | null> {
  await query(
    `UPDATE recurring_expenses
     SET description = $1, category = $2, amount = $3, currency = $4, frequency = $5, next_run_date = $6, active = $7, updated_at = now()
     WHERE id = $8`,
    [input.description, input.category, input.amount, input.currency, input.frequency, input.nextRunDate, input.active, id]
  );
  return getRecurringExpenseById(id);
}

export async function deleteRecurringExpense(id: number): Promise<void> {
  await query(`DELETE FROM recurring_expenses WHERE id = $1`, [id]);
}

const FREQUENCY_INTERVAL: Record<RecurringExpenseFrequency, string> = {
  weekly: "1 week",
  monthly: "1 month",
  quarterly: "3 months",
  yearly: "1 year",
};

// Called from the reminder-sweep cron (polled every 10-15 min) — posts one
// accounting_transactions row per due recurring expense and advances
// next_run_date by one period. Posts as 'approved' immediately: a recurring
// expense was already set up by an Admin-level account ahead of time, same
// trust level as a received PO or a run payroll, not a fresh manual entry
// subject to the approval-threshold check. Only advances one period per
// sweep call — if a row falls further behind (e.g. the app was down a
// while), it self-heals over the next few sweeps rather than replaying a
// long backlog of missed occurrences at once.
export async function processRecurringExpenses(): Promise<{ posted: number }> {
  const today = toMuscatDateInput(new Date());
  const due = await query<RecurringExpenseRow>(
    `${RECURRING_SELECT} WHERE r.active = true AND r.next_run_date <= $1`,
    [today]
  );

  let posted = 0;
  for (const r of due.rows) {
    const res = await query<{ id: number }>(
      `INSERT INTO accounting_transactions (date, description, amount, currency, type, category, recurring_expense_id, status)
       VALUES ($1, $2, $3, $4, 'expense', $5, $6, 'approved') RETURNING id`,
      [r.next_run_date, r.description, r.amount, r.currency, r.category, r.id]
    );
    await getTransactionById(res.rows[0].id); // ensures the row exists before advancing (surfaces a failure loudly rather than silently)

    await query(
      `UPDATE recurring_expenses
       SET next_run_date = next_run_date + ($1)::interval, updated_at = now()
       WHERE id = $2`,
      [FREQUENCY_INTERVAL[r.frequency], r.id]
    );
    posted++;
  }

  return { posted };
}
