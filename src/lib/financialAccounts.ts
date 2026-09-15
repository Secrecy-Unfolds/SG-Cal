import { query } from "@/lib/db";
import type { FinancialAccountType } from "@/lib/accountingDisplay";

export type FinancialAccountRow = {
  id: number;
  name: string;
  account_type: FinancialAccountType;
  currency: string;
  balance: string; // live-computed, see the correlated subquery below
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

// Balance = sum of *approved* income minus approved expense for
// transactions linked to this account — computed live, never stored, same
// "compute live, never store" pattern used throughout v2. Only counts
// transactions whose own currency matches the account's (an account linked
// to a mismatched-currency transaction is a data-entry mistake, not
// something to silently convert).
const ACCOUNT_SELECT = `
  SELECT a.id, a.name, a.account_type, a.currency,
         COALESCE((
           SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
           FROM accounting_transactions t
           WHERE t.financial_account_id = a.id AND t.status = 'approved' AND t.currency = a.currency
         ), 0) AS balance,
         a.created_by, u.username AS created_by_username, a.created_at
  FROM financial_accounts a
  LEFT JOIN users u ON u.id = a.created_by
`;

export async function listFinancialAccounts(): Promise<FinancialAccountRow[]> {
  const res = await query<FinancialAccountRow>(`${ACCOUNT_SELECT} ORDER BY a.name`);
  return res.rows;
}

export async function getFinancialAccountById(id: number): Promise<FinancialAccountRow | null> {
  const res = await query<FinancialAccountRow>(`${ACCOUNT_SELECT} WHERE a.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function createFinancialAccount(input: {
  name: string;
  accountType: FinancialAccountType;
  currency: string;
  createdBy: number;
}): Promise<FinancialAccountRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO financial_accounts (name, account_type, currency, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.name, input.accountType, input.currency, input.createdBy]
  );
  const created = await getFinancialAccountById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created financial account");
  return created;
}

export async function updateFinancialAccount(
  id: number,
  input: { name: string; accountType: FinancialAccountType; currency: string }
): Promise<FinancialAccountRow | null> {
  await query(`UPDATE financial_accounts SET name = $1, account_type = $2, currency = $3 WHERE id = $4`, [
    input.name,
    input.accountType,
    input.currency,
    id,
  ]);
  return getFinancialAccountById(id);
}

// Transactions linked to this account keep their link cleared (ON DELETE
// SET NULL on accounting_transactions.financial_account_id) — deleting an
// account never deletes ledger history.
export async function deleteFinancialAccount(id: number): Promise<void> {
  await query(`DELETE FROM financial_accounts WHERE id = $1`, [id]);
}
