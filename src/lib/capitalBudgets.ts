import { query } from "@/lib/db";

export type CapitalBudgetRow = {
  id: number;
  label: string;
  period_start: string; // "YYYY-MM-DD"
  period_end: string;
  product_id: number | null;
  product_name: string | null;
  amount: string; // numeric comes back as a string from pg
  currency: string;
  actual: string; // live-computed, see the correlated subquery below
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

// "Actual" is the sum of *approved* expense transactions falling inside the
// budget's period and matching its currency — scoped to the budget's
// product (via the transaction's linked purchase order) when product_id is
// set, or org-wide when it isn't. Pending/rejected expenses don't count yet
// — see the Expense management approval workflow. Computed live in the
// query, never stored — same "compute live, never store" pattern as
// Procurement's "Capital needed".
const BUDGET_SELECT = `
  SELECT b.id, b.label, b.period_start, b.period_end, b.product_id, p.name AS product_name,
         b.amount, b.currency,
         COALESCE((
           SELECT SUM(t.amount) FROM accounting_transactions t
           LEFT JOIN purchase_orders po ON po.id = t.purchase_order_id
           WHERE t.type = 'expense' AND t.status = 'approved' AND t.currency = b.currency
             AND t.date >= b.period_start AND t.date <= b.period_end
             AND (b.product_id IS NULL OR po.product_id = b.product_id)
         ), 0) AS actual,
         b.created_by, u.username AS created_by_username, b.created_at
  FROM capital_budgets b
  LEFT JOIN procurement_products p ON p.id = b.product_id
  LEFT JOIN users u ON u.id = b.created_by
`;

export async function listCapitalBudgets(): Promise<CapitalBudgetRow[]> {
  const res = await query<CapitalBudgetRow>(`${BUDGET_SELECT} ORDER BY b.period_start DESC, b.id DESC`);
  return res.rows;
}

export async function getCapitalBudgetById(id: number): Promise<CapitalBudgetRow | null> {
  const res = await query<CapitalBudgetRow>(`${BUDGET_SELECT} WHERE b.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function createCapitalBudget(input: {
  label: string;
  periodStart: string;
  periodEnd: string;
  productId: number | null;
  amount: number;
  currency: string;
  createdBy: number;
}): Promise<CapitalBudgetRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO capital_budgets (label, period_start, period_end, product_id, amount, currency, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [input.label, input.periodStart, input.periodEnd, input.productId, input.amount, input.currency, input.createdBy]
  );
  const created = await getCapitalBudgetById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created capital budget");
  return created;
}

export async function updateCapitalBudget(
  id: number,
  input: { label: string; periodStart: string; periodEnd: string; productId: number | null; amount: number; currency: string }
): Promise<CapitalBudgetRow | null> {
  await query(
    `UPDATE capital_budgets SET label = $1, period_start = $2, period_end = $3, product_id = $4, amount = $5, currency = $6
     WHERE id = $7`,
    [input.label, input.periodStart, input.periodEnd, input.productId, input.amount, input.currency, id]
  );
  return getCapitalBudgetById(id);
}

export async function deleteCapitalBudget(id: number): Promise<void> {
  await query(`DELETE FROM capital_budgets WHERE id = $1`, [id]);
}
