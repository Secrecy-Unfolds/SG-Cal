import { query } from "@/lib/db";

export type ExpenseBudgetRow = {
  id: number;
  category: string;
  period_start: string; // "YYYY-MM-DD"
  period_end: string;
  amount: string; // numeric comes back as a string from pg
  currency: string;
  actual: string; // live-computed, see the correlated subquery below
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

// "Actual" is the sum of *approved* expense transactions falling inside the
// budget's period, matching its category and currency. Pending/rejected
// expenses don't count yet, same as the Ledger's own totals. Computed live,
// never stored — same pattern as lib/capitalBudgets.ts.
const BUDGET_SELECT = `
  SELECT b.id, b.category, b.period_start, b.period_end, b.amount, b.currency,
         COALESCE((
           SELECT SUM(t.amount) FROM accounting_transactions t
           WHERE t.type = 'expense' AND t.status = 'approved' AND t.currency = b.currency
             AND t.category = b.category
             AND t.date >= b.period_start AND t.date <= b.period_end
         ), 0) AS actual,
         b.created_by, u.username AS created_by_username, b.created_at
  FROM expense_budgets b
  LEFT JOIN users u ON u.id = b.created_by
`;

export async function listExpenseBudgets(): Promise<ExpenseBudgetRow[]> {
  const res = await query<ExpenseBudgetRow>(`${BUDGET_SELECT} ORDER BY b.period_start DESC, b.id DESC`);
  return res.rows;
}

export async function getExpenseBudgetById(id: number): Promise<ExpenseBudgetRow | null> {
  const res = await query<ExpenseBudgetRow>(`${BUDGET_SELECT} WHERE b.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function createExpenseBudget(input: {
  category: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  createdBy: number;
}): Promise<ExpenseBudgetRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO expense_budgets (category, period_start, period_end, amount, currency, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.category, input.periodStart, input.periodEnd, input.amount, input.currency, input.createdBy]
  );
  const created = await getExpenseBudgetById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created expense budget");
  return created;
}

export async function updateExpenseBudget(
  id: number,
  input: { category: string; periodStart: string; periodEnd: string; amount: number; currency: string }
): Promise<ExpenseBudgetRow | null> {
  await query(
    `UPDATE expense_budgets SET category = $1, period_start = $2, period_end = $3, amount = $4, currency = $5 WHERE id = $6`,
    [input.category, input.periodStart, input.periodEnd, input.amount, input.currency, id]
  );
  return getExpenseBudgetById(id);
}

export async function deleteExpenseBudget(id: number): Promise<void> {
  await query(`DELETE FROM expense_budgets WHERE id = $1`, [id]);
}
