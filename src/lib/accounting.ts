import { query } from "@/lib/db";
import { listEmployeesWithDetails } from "@/lib/hr";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import { computeCapitalNeeded } from "@/lib/procurementDisplay";

export type TransactionType = "income" | "expense";

export function isTransactionType(value: unknown): value is TransactionType {
  return value === "income" || value === "expense";
}

export type AccountingTransactionRow = {
  id: number;
  date: string; // "YYYY-MM-DD"
  description: string;
  amount: string; // numeric comes back as a string from pg
  currency: string;
  type: TransactionType;
  category: string;
  purchase_order_id: number | null;
  payroll_run_id: number | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

const TRANSACTION_SELECT = `
  SELECT t.id, t.date, t.description, t.amount, t.currency, t.type, t.category,
         t.purchase_order_id, t.payroll_run_id, t.created_by, u.username AS created_by_username, t.created_at
  FROM accounting_transactions t
  LEFT JOIN users u ON u.id = t.created_by
`;

export async function listTransactions(): Promise<AccountingTransactionRow[]> {
  const res = await query<AccountingTransactionRow>(`${TRANSACTION_SELECT} ORDER BY t.date DESC, t.id DESC`);
  return res.rows;
}

export async function getTransactionById(id: number): Promise<AccountingTransactionRow | null> {
  const res = await query<AccountingTransactionRow>(`${TRANSACTION_SELECT} WHERE t.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function createTransaction(input: {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: TransactionType;
  category: string;
  createdBy: number;
}): Promise<AccountingTransactionRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO accounting_transactions (date, description, amount, currency, type, category, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [input.date, input.description, input.amount, input.currency, input.type, input.category, input.createdBy]
  );
  const created = await getTransactionById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created transaction");
  return created;
}

export async function deleteTransaction(id: number): Promise<void> {
  await query(`DELETE FROM accounting_transactions WHERE id = $1`, [id]);
}

// Called when a Purchase Order transitions to "received".
export async function postExpenseForPurchaseOrder(po: PurchaseOrderRow): Promise<AccountingTransactionRow> {
  const amount = computeCapitalNeeded({
    unitPrice: po.unit_price,
    quantityNeeded: po.quantity,
    shippingCost: po.shipping_cost,
    customsCost: po.customs_cost,
  });
  const res = await query<{ id: number }>(
    `INSERT INTO accounting_transactions (date, description, amount, currency, type, category, purchase_order_id)
     VALUES (CURRENT_DATE, $1, $2, $3, 'expense', 'Procurement', $4) RETURNING id`,
    [`${po.product_name} (PO #${po.id}, ${po.vendor_name})`, amount, po.currency, po.id]
  );
  const created = await getTransactionById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created transaction");
  return created;
}

export type PayrollRunRow = {
  id: number;
  run_month: string; // "YYYY-MM-DD", first of month
  run_by: number | null;
  run_by_username: string | null;
  created_at: Date;
};

const PAYROLL_RUN_SELECT = `
  SELECT r.id, r.run_month, r.run_by, u.username AS run_by_username, r.created_at
  FROM payroll_runs r
  LEFT JOIN users u ON u.id = r.run_by
`;

export async function listPayrollRuns(): Promise<PayrollRunRow[]> {
  const res = await query<PayrollRunRow>(`${PAYROLL_RUN_SELECT} ORDER BY r.run_month DESC`);
  return res.rows;
}

export type RunPayrollResult =
  | { ok: true; run: PayrollRunRow; transactionsCreated: number }
  | { ok: false; error: string };

// One expense transaction per employee with a salary set. `runMonth` is a
// "YYYY-MM-01" date string; the UNIQUE constraint on payroll_runs.run_month
// is what actually stops a month being run twice (surfaced here as a 409).
export async function runPayroll(runMonth: string, actorId: number): Promise<RunPayrollResult> {
  const employees = await listEmployeesWithDetails();
  const payable = employees.filter((e) => e.salary !== null);

  let runId: number;
  try {
    const res = await query<{ id: number }>(
      `INSERT INTO payroll_runs (run_month, run_by) VALUES ($1, $2) RETURNING id`,
      [runMonth, actorId]
    );
    runId = res.rows[0].id;
  } catch (err: any) {
    if (err?.code === "23505") {
      return { ok: false, error: "Payroll has already been run for this month" };
    }
    throw err;
  }

  for (const e of payable) {
    await query(
      `INSERT INTO accounting_transactions (date, description, amount, currency, type, category, payroll_run_id, created_by)
       VALUES ($1, $2, $3, $4, 'expense', 'Payroll', $5, $6)`,
      [runMonth, `Salary — ${e.username}`, e.salary, e.salary_currency, runId, actorId]
    );
  }

  const run = (await listPayrollRuns()).find((r) => r.id === runId)!;
  return { ok: true, run, transactionsCreated: payable.length };
}
