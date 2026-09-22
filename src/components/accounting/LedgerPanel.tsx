"use client";

import { useState } from "react";
import TransactionsListClient from "@/components/accounting/TransactionsListClient";
import ExpenseBudgetsClient from "@/components/accounting/ExpenseBudgetsClient";
import RecurringExpensesClient from "@/components/accounting/RecurringExpensesClient";
import RecurringIncomeClient from "@/components/accounting/RecurringIncomeClient";
import FinancialAccountsClient from "@/components/accounting/FinancialAccountsClient";
import ClosedPeriodsClient from "@/components/accounting/ClosedPeriodsClient";
import type { AccountingTransactionRow } from "@/lib/accounting";
import type { ExpenseBudgetRow } from "@/lib/expenseBudgets";
import type { RecurringExpenseRow } from "@/lib/recurringExpenses";
import type { RecurringIncomeRow } from "@/lib/recurringIncome";
import type { FinancialAccountRow } from "@/lib/financialAccounts";
import type { ClosedPeriodRow } from "@/lib/periodClosing";
import type { UserRole } from "@/lib/users";
import type { ExchangeRateSnapshot } from "@/lib/currencyDisplay";
import FolderTabs from "@/components/hud/FolderTabs";

type SubTab = "transactions" | "budgets" | "recurringExpenses" | "recurringIncome" | "accounts" | "closedPeriods";

export default function LedgerPanel({
  transactions,
  expenseBudgets,
  recurringExpenses,
  recurringIncome,
  financialAccounts,
  closedPeriods,
  baseCurrency,
  exchangeRateSnapshot,
  actorRole,
  isAdmin,
}: {
  transactions: AccountingTransactionRow[];
  expenseBudgets: ExpenseBudgetRow[];
  recurringExpenses: RecurringExpenseRow[];
  recurringIncome: RecurringIncomeRow[];
  financialAccounts: FinancialAccountRow[];
  closedPeriods: ClosedPeriodRow[];
  baseCurrency: string;
  exchangeRateSnapshot: ExchangeRateSnapshot;
  actorRole: UserRole;
  isAdmin: boolean;
}) {
  const [subTab, setSubTab] = useState<SubTab>("transactions");

  return (
    <div>
      <FolderTabs
        tabs={[
          { key: "transactions", label: "Transactions" },
          { key: "budgets", label: "Expense budgets" },
          { key: "recurringExpenses", label: "Recurring expenses" },
          { key: "recurringIncome", label: "Recurring income" },
          { key: "accounts", label: "Accounts" },
          { key: "closedPeriods", label: "Closed periods" },
        ]}
        active={subTab}
        onChange={setSubTab}
      />

      {subTab === "transactions" && (
        <TransactionsListClient
          transactions={transactions}
          financialAccounts={financialAccounts}
          baseCurrency={baseCurrency}
          exchangeRateSnapshot={exchangeRateSnapshot}
          actorRole={actorRole}
          isAdmin={isAdmin}
        />
      )}
      {subTab === "budgets" && (
        <ExpenseBudgetsClient
          budgets={expenseBudgets}
          baseCurrency={baseCurrency}
          exchangeRateSnapshot={exchangeRateSnapshot}
          isAdmin={isAdmin}
        />
      )}
      {subTab === "recurringExpenses" && <RecurringExpensesClient recurring={recurringExpenses} isAdmin={isAdmin} />}
      {subTab === "recurringIncome" && <RecurringIncomeClient recurring={recurringIncome} isAdmin={isAdmin} />}
      {subTab === "accounts" && <FinancialAccountsClient accounts={financialAccounts} isAdmin={isAdmin} />}
      {subTab === "closedPeriods" && <ClosedPeriodsClient periods={closedPeriods} actorRole={actorRole} />}
    </div>
  );
}
