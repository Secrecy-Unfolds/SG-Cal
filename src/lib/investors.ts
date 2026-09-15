import { query } from "@/lib/db";
import { postCapitalEntry } from "@/lib/capital";
import type { InvestmentStatus, InvestmentType } from "@/lib/investorsDisplay";

export type InvestorRow = {
  id: number;
  name: string;
  contact: string;
  entity_type: string;
  created_at: Date;
};

export async function listInvestors(): Promise<InvestorRow[]> {
  const res = await query<InvestorRow>(`SELECT id, name, contact, entity_type, created_at FROM investors ORDER BY name`);
  return res.rows;
}

export async function getInvestorById(id: number): Promise<InvestorRow | null> {
  const res = await query<InvestorRow>(`SELECT id, name, contact, entity_type, created_at FROM investors WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function createInvestor(input: { name: string; contact: string; entityType: string }): Promise<InvestorRow> {
  const res = await query<InvestorRow>(
    `INSERT INTO investors (name, contact, entity_type) VALUES ($1, $2, $3)
     RETURNING id, name, contact, entity_type, created_at`,
    [input.name, input.contact, input.entityType]
  );
  return res.rows[0];
}

export async function updateInvestor(
  id: number,
  input: { name: string; contact: string; entityType: string }
): Promise<InvestorRow | null> {
  const res = await query<InvestorRow>(
    `UPDATE investors SET name = $1, contact = $2, entity_type = $3 WHERE id = $4
     RETURNING id, name, contact, entity_type, created_at`,
    [input.name, input.contact, input.entityType, id]
  );
  return res.rows[0] ?? null;
}

// Cascades via the schema's FK: investments.investor_id is ON DELETE CASCADE,
// so this also removes the investor's investments and (via that FK) their
// payouts. The capital_entries rows those investments posted are kept
// (capital_entries.id is only referenced back from investments, never the
// other way), preserving the ledger history.
export async function deleteInvestor(id: number): Promise<void> {
  await query(`DELETE FROM investors WHERE id = $1`, [id]);
}

export type InvestmentRow = {
  id: number;
  investor_id: number;
  investor_name: string;
  investment_type: InvestmentType;
  amount: string;
  currency: string;
  date: string;
  terms: string;
  status: InvestmentStatus;
  capital_entry_id: number | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

const INVESTMENT_SELECT = `
  SELECT i.id, i.investor_id, inv.name AS investor_name, i.investment_type, i.amount, i.currency, i.date,
         i.terms, i.status, i.capital_entry_id, i.created_by, u.username AS created_by_username, i.created_at
  FROM investments i
  JOIN investors inv ON inv.id = i.investor_id
  LEFT JOIN users u ON u.id = i.created_by
`;

export async function listInvestments(): Promise<InvestmentRow[]> {
  const res = await query<InvestmentRow>(`${INVESTMENT_SELECT} ORDER BY i.date DESC, i.id DESC`);
  return res.rows;
}

export async function listInvestmentsForInvestor(investorId: number): Promise<InvestmentRow[]> {
  const res = await query<InvestmentRow>(`${INVESTMENT_SELECT} WHERE i.investor_id = $1 ORDER BY i.date DESC, i.id DESC`, [
    investorId,
  ]);
  return res.rows;
}

export async function getInvestmentById(id: number): Promise<InvestmentRow | null> {
  const res = await query<InvestmentRow>(`${INVESTMENT_SELECT} WHERE i.id = $1`, [id]);
  return res.rows[0] ?? null;
}

// Creating an investment auto-posts a matching capital_entries row (source:
// "investor"), same "one action, linked auto-posting" pattern as
// postExpenseForPurchaseOrder() — see lib/capital.ts.
export async function createInvestment(input: {
  investorId: number;
  investmentType: InvestmentType;
  amount: number;
  currency: string;
  date: string;
  terms: string;
  createdBy: number;
}): Promise<InvestmentRow> {
  const investor = await getInvestorById(input.investorId);
  if (!investor) throw new Error("Investor not found");

  const capitalEntry = await postCapitalEntry({
    source: "investor",
    amount: input.amount,
    currency: input.currency,
    date: input.date,
    description: `Investment from ${investor.name} (${input.investmentType})`,
    createdBy: input.createdBy,
  });

  const res = await query<{ id: number }>(
    `INSERT INTO investments (investor_id, investment_type, amount, currency, date, terms, status, capital_entry_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8) RETURNING id`,
    [input.investorId, input.investmentType, input.amount, input.currency, input.date, input.terms, capitalEntry.id, input.createdBy]
  );
  const created = await getInvestmentById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created investment");
  return created;
}

export async function updateInvestmentStatus(id: number, status: InvestmentStatus): Promise<InvestmentRow | null> {
  await query(`UPDATE investments SET status = $1 WHERE id = $2`, [status, id]);
  return getInvestmentById(id);
}

export async function deleteInvestment(id: number): Promise<void> {
  await query(`DELETE FROM investments WHERE id = $1`, [id]);
}

export type InvestmentPayoutRow = {
  id: number;
  investment_id: number;
  amount: string;
  currency: string;
  date: string;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

const PAYOUT_SELECT = `
  SELECT p.id, p.investment_id, p.amount, p.currency, p.date, p.created_by, u.username AS created_by_username, p.created_at
  FROM investment_payouts p
  LEFT JOIN users u ON u.id = p.created_by
`;

export async function listPayoutsForInvestment(investmentId: number): Promise<InvestmentPayoutRow[]> {
  const res = await query<InvestmentPayoutRow>(`${PAYOUT_SELECT} WHERE p.investment_id = $1 ORDER BY p.date DESC, p.id DESC`, [
    investmentId,
  ]);
  return res.rows;
}

// Preloaded in full for the Investors UI (small internal dataset, same
// convention as listTransactions()/listPurchaseOrders()) rather than
// fetched per-investment on demand.
export async function listAllPayouts(): Promise<InvestmentPayoutRow[]> {
  const res = await query<InvestmentPayoutRow>(`${PAYOUT_SELECT} ORDER BY p.date DESC, p.id DESC`);
  return res.rows;
}

export async function createPayout(input: {
  investmentId: number;
  amount: number;
  currency: string;
  date: string;
  createdBy: number;
}): Promise<InvestmentPayoutRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO investment_payouts (investment_id, amount, currency, date, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.investmentId, input.amount, input.currency, input.date, input.createdBy]
  );
  const res2 = await query<InvestmentPayoutRow>(`${PAYOUT_SELECT} WHERE p.id = $1`, [res.rows[0].id]);
  return res2.rows[0];
}

export async function deletePayout(id: number): Promise<void> {
  await query(`DELETE FROM investment_payouts WHERE id = $1`, [id]);
}
