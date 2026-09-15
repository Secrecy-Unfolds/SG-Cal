import { listTransactions } from "@/lib/accounting";
import { listInventoryItems } from "@/lib/inventory";
import { listFinancialAccounts } from "@/lib/financialAccounts";
import { listInvestments, listAllPayouts } from "@/lib/investors";

export type ProfitAndLossRow = {
  currency: string;
  income: number;
  expense: number;
  net: number;
  vatCollected: number;
  vatPaid: number;
};

// P&L over a chosen period — only 'approved' transactions count, same rule
// as the Ledger's own totals. A reporting view over existing data, not a
// new ledger model — see docs/erp-v2-roadmap.md's "Basic financial
// statements".
export async function computeProfitAndLoss(periodStart: string, periodEnd: string): Promise<ProfitAndLossRow[]> {
  const transactions = await listTransactions();
  const map = new Map<string, ProfitAndLossRow>();
  for (const t of transactions) {
    if (t.status !== "approved") continue;
    if (t.date < periodStart || t.date > periodEnd) continue;
    const row = map.get(t.currency) ?? { currency: t.currency, income: 0, expense: 0, net: 0, vatCollected: 0, vatPaid: 0 };
    const amount = parseFloat(t.amount);
    const vat = t.vat_amount ? parseFloat(t.vat_amount) : 0;
    if (t.type === "income") {
      row.income += amount;
      row.vatCollected += vat;
    } else {
      row.expense += amount;
      row.vatPaid += vat;
    }
    row.net = row.income - row.expense;
    map.set(t.currency, row);
  }
  return Array.from(map.values());
}

export type BalanceSummaryRow = {
  currency: string;
  inventoryValue: number;
  cashAndBankBalance: number;
  outstandingLoans: number;
  netPosition: number;
};

// Inventory value (Inventory's own live-depreciation-adjusted current_value)
// + cash/bank balances (financial_accounts' live-computed balances) −
// outstanding loan capital owed (active loan investments, net of payouts) —
// a balance-style summary, deliberately short of real double-entry-backed
// financial statements.
export async function computeBalanceSummary(): Promise<BalanceSummaryRow[]> {
  const [inventoryItems, accounts, investments, payouts] = await Promise.all([
    listInventoryItems(),
    listFinancialAccounts(),
    listInvestments(),
    listAllPayouts(),
  ]);

  const map = new Map<string, BalanceSummaryRow>();
  const get = (currency: string) => {
    let row = map.get(currency);
    if (!row) {
      row = { currency, inventoryValue: 0, cashAndBankBalance: 0, outstandingLoans: 0, netPosition: 0 };
      map.set(currency, row);
    }
    return row;
  };

  for (const item of inventoryItems) {
    const value = parseFloat(item.current_value ?? item.purchase_cost ?? "0");
    if (!Number.isFinite(value)) continue;
    get(item.currency).inventoryValue += value;
  }

  for (const account of accounts) {
    const balance = parseFloat(account.balance);
    if (!Number.isFinite(balance)) continue;
    get(account.currency).cashAndBankBalance += balance;
  }

  const paidOutByInvestment = new Map<number, number>();
  for (const p of payouts) {
    paidOutByInvestment.set(p.investment_id, (paidOutByInvestment.get(p.investment_id) ?? 0) + parseFloat(p.amount));
  }
  for (const inv of investments) {
    if (inv.investment_type !== "loan" || inv.status !== "active") continue;
    const owed = parseFloat(inv.amount) - (paidOutByInvestment.get(inv.id) ?? 0);
    get(inv.currency).outstandingLoans += owed;
  }

  for (const row of map.values()) {
    row.netPosition = row.inventoryValue + row.cashAndBankBalance - row.outstandingLoans;
  }

  return Array.from(map.values());
}
