import { query } from "@/lib/db";
import { listEmployeesWithDetails } from "@/lib/hr";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import { computeCapitalNeeded } from "@/lib/procurementDisplay";
import type { UserRole } from "@/lib/users";
import { getBaseCurrency } from "@/lib/settings";
import { getExchangeRateMap } from "@/lib/exchangeRates";
import { convertToBase } from "@/lib/currencyDisplay";
import { EXPENSE_APPROVAL_THRESHOLD } from "@/lib/accountingDisplay";
import { isDateInClosedPeriod } from "@/lib/periodClosing";

// Single source of truth lives in accountingDisplay.ts (client-safe — no
// server-only imports), so client components can use it directly without
// pulling in `pg`.
export type { TransactionStatus } from "@/lib/accountingDisplay";
export {
  EXPENSE_APPROVAL_THRESHOLD,
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_STATUS_BADGE_CLASS,
  isTransactionStatus,
} from "@/lib/accountingDisplay";
import type { TransactionStatus } from "@/lib/accountingDisplay";

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
  recurring_expense_id: number | null;
  recurring_income_id: number | null;
  financial_account_id: number | null;
  financial_account_name: string | null;
  attachment_url: string | null;
  taxable: boolean;
  vat_rate: string | null; // numeric comes back as a string from pg
  vat_amount: string | null;
  status: TransactionStatus;
  decided_by: number | null;
  decided_by_username: string | null;
  decided_at: Date | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

const TRANSACTION_SELECT = `
  SELECT t.id, t.date, t.description, t.amount, t.currency, t.type, t.category,
         t.purchase_order_id, t.payroll_run_id, t.recurring_expense_id, t.recurring_income_id,
         t.financial_account_id, fa.name AS financial_account_name,
         t.attachment_url, t.taxable, t.vat_rate, t.vat_amount, t.status,
         t.decided_by, du.username AS decided_by_username, t.decided_at,
         t.created_by, u.username AS created_by_username, t.created_at
  FROM accounting_transactions t
  LEFT JOIN users u ON u.id = t.created_by
  LEFT JOIN users du ON du.id = t.decided_by
  LEFT JOIN financial_accounts fa ON fa.id = t.financial_account_id
`;

export async function listTransactions(): Promise<AccountingTransactionRow[]> {
  const res = await query<AccountingTransactionRow>(`${TRANSACTION_SELECT} ORDER BY t.date DESC, t.id DESC`);
  return res.rows;
}

export async function getTransactionById(id: number): Promise<AccountingTransactionRow | null> {
  const res = await query<AccountingTransactionRow>(`${TRANSACTION_SELECT} WHERE t.id = $1`, [id]);
  return res.rows[0] ?? null;
}

// Manual entries only (income, or an expense within/over the approval
// threshold) — auto-posted rows (PO-received, payroll, recurring expenses)
// go through their own dedicated insert below and always post 'approved'
// immediately, since they're already the result of an approved action
// elsewhere (a received PO, a run payroll, a scheduled recurring expense).
export async function createTransaction(input: {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: TransactionType;
  category: string;
  createdBy: number;
  actorRole: UserRole;
  financialAccountId?: number | null;
  attachmentUrl?: string | null;
  taxable?: boolean;
  vatRate?: number | null;
}): Promise<AccountingTransactionRow> {
  if (await isDateInClosedPeriod(input.date)) throw new Error("PERIOD_CLOSED");

  const status = await decideTransactionStatus(input.type, input.amount, input.currency, input.actorRole);
  const taxable = input.taxable ?? false;
  const vatRate = taxable ? input.vatRate ?? null : null;
  const vatAmount = taxable && vatRate !== null ? input.amount * (vatRate / 100) : null;

  const res = await query<{ id: number }>(
    `INSERT INTO accounting_transactions
       (date, description, amount, currency, type, category, created_by, status,
        financial_account_id, attachment_url, taxable, vat_rate, vat_amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [
      input.date,
      input.description,
      input.amount,
      input.currency,
      input.type,
      input.category,
      input.createdBy,
      status,
      input.financialAccountId ?? null,
      input.attachmentUrl ?? null,
      taxable,
      vatRate,
      vatAmount,
    ]
  );
  const created = await getTransactionById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created transaction");
  return created;
}

// Income never needs approval; a Super Admin's own expense entry is already
// backed by the authority that would otherwise have to approve it, so it
// posts immediately too. A currency with no configured exchange rate can't
// be checked against the threshold, so it falls back to requiring approval
// — same no-silent-default precedent as the currency-blending layer.
async function decideTransactionStatus(
  type: TransactionType,
  amount: number,
  currency: string,
  actorRole: UserRole
): Promise<TransactionStatus> {
  if (type === "income" || actorRole === "super_admin") return "approved";
  const baseCurrency = await getBaseCurrency();
  const rates = await getExchangeRateMap();
  const converted = convertToBase(amount, currency, baseCurrency, rates);
  return converted === null || converted > EXPENSE_APPROVAL_THRESHOLD ? "pending" : "approved";
}

// Super-Admin-only — approve or reject a pending expense. A rejected
// transaction stays in the system (for audit) but, like a pending one,
// never counts toward the ledger's totals — only 'approved' rows do.
export async function decideTransaction(
  id: number,
  input: { status: "approved" | "rejected"; decidedBy: number }
): Promise<AccountingTransactionRow | null> {
  await query(`UPDATE accounting_transactions SET status = $1, decided_by = $2, decided_at = now() WHERE id = $3`, [
    input.status,
    input.decidedBy,
    id,
  ]);
  return getTransactionById(id);
}

// Blocks deleting a transaction dated inside a still-closed period — same
// lock createTransaction() enforces on the way in.
export async function deleteTransaction(id: number): Promise<void> {
  const existing = await getTransactionById(id);
  if (existing && (await isDateInClosedPeriod(existing.date))) throw new Error("PERIOD_CLOSED");
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
