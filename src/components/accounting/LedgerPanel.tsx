"use client";

import { useState } from "react";
import TransactionsListClient from "@/components/accounting/TransactionsListClient";
import ExpenseBudgetsClient from "@/components/accounting/ExpenseBudgetsClient";
import RecurringExpensesClient from "@/components/accounting/RecurringExpensesClient";
import type { AccountingTransactionRow } from "@/lib/accounting";
import type { ExpenseBudgetRow } from "@/lib/expenseBudgets";
import type { RecurringExpenseRow } from "@/lib/recurringExpenses";
import type { UserRole } from "@/lib/users";
import FolderTabs from "@/components/hud/FolderTabs";

type SubTab = "transactions" | "budgets" | "recurring";

export default function LedgerPanel({
  transactions,
  expenseBudgets,
  recurringExpenses,
  baseCurrency,
  exchangeRates,
  actorRole,
}: {
  transactions: AccountingTransactionRow[];
  expenseBudgets: ExpenseBudgetRow[];
  recurringExpenses: RecurringExpenseRow[];
  baseCurrency: string;
  exchangeRates: Record<string, number>;
  actorRole: UserRole;
}) {
  const [subTab, setSubTab] = useState<SubTab>("transactions");

  return (
    <div>
      <FolderTabs
        tabs={[
          { key: "transactions", label: "Transactions" },
          { key: "budgets", label: "Expense budgets" },
          { key: "recurring", label: "Recurring" },
        ]}
        active={subTab}
        onChange={setSubTab}
      />

      {subTab === "transactions" && (
        <TransactionsListClient
          transactions={transactions}
          baseCurrency={baseCurrency}
          exchangeRates={exchangeRates}
          actorRole={actorRole}
        />
      )}
      {subTab === "budgets" && (
        <ExpenseBudgetsClient budgets={expenseBudgets} baseCurrency={baseCurrency} exchangeRates={exchangeRates} />
      )}
      {subTab === "recurring" && <RecurringExpensesClient recurring={recurringExpenses} />}
    </div>
  );
}
