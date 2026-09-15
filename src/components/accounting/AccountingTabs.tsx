"use client";

import { useState } from "react";
import LedgerPanel from "@/components/accounting/LedgerPanel";
import PayrollRunsClient from "@/components/accounting/PayrollRunsClient";
import CapitalPanel from "@/components/accounting/CapitalPanel";
import type { AccountingTransactionRow, PayrollRunRow } from "@/lib/accounting";
import type { ExpenseBudgetRow } from "@/lib/expenseBudgets";
import type { RecurringExpenseRow } from "@/lib/recurringExpenses";
import type { CapitalEntryRow } from "@/lib/capital";
import type { CapitalBudgetRow } from "@/lib/capitalBudgets";
import type { InvestmentPayoutRow, InvestmentRow, InvestorRow } from "@/lib/investors";
import type { GovernmentSupportRow, GovernmentSupporterRow } from "@/lib/governmentSupport";
import type { ProductRow } from "@/lib/procurement";
import type { UserRole } from "@/lib/users";
import PageHeader from "@/components/hud/PageHeader";
import FolderTabs from "@/components/hud/FolderTabs";

type Tab = "ledger" | "payroll" | "capital";

export default function AccountingTabs({
  transactions,
  expenseBudgets,
  recurringExpenses,
  payrollRuns,
  capitalEntries,
  capitalBudgets,
  products,
  investors,
  investments,
  payouts,
  governmentSupporters,
  governmentSupport,
  baseCurrency,
  exchangeRates,
  actorRole,
}: {
  transactions: AccountingTransactionRow[];
  expenseBudgets: ExpenseBudgetRow[];
  recurringExpenses: RecurringExpenseRow[];
  payrollRuns: PayrollRunRow[];
  capitalEntries: CapitalEntryRow[];
  capitalBudgets: CapitalBudgetRow[];
  products: ProductRow[];
  investors: InvestorRow[];
  investments: InvestmentRow[];
  payouts: InvestmentPayoutRow[];
  governmentSupporters: GovernmentSupporterRow[];
  governmentSupport: GovernmentSupportRow[];
  baseCurrency: string;
  exchangeRates: Record<string, number>;
  actorRole: UserRole;
}) {
  const [tab, setTab] = useState<Tab>("ledger");

  return (
    <div>
      <PageHeader label="ACCOUNTING" title="Accounting" />

      <FolderTabs
        tabs={[
          { key: "ledger", label: "Ledger" },
          { key: "payroll", label: "Payroll" },
          { key: "capital", label: "Capital" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "ledger" && (
        <LedgerPanel
          transactions={transactions}
          expenseBudgets={expenseBudgets}
          recurringExpenses={recurringExpenses}
          baseCurrency={baseCurrency}
          exchangeRates={exchangeRates}
          actorRole={actorRole}
        />
      )}
      {tab === "payroll" && <PayrollRunsClient runs={payrollRuns} />}
      {tab === "capital" && (
        <CapitalPanel
          capitalEntries={capitalEntries}
          capitalBudgets={capitalBudgets}
          products={products}
          investors={investors}
          investments={investments}
          payouts={payouts}
          governmentSupporters={governmentSupporters}
          governmentSupport={governmentSupport}
          baseCurrency={baseCurrency}
          exchangeRates={exchangeRates}
        />
      )}
    </div>
  );
}
