"use client";

import { useState } from "react";
import LedgerPanel from "@/components/accounting/LedgerPanel";
import PayrollRunsClient from "@/components/accounting/PayrollRunsClient";
import CapitalPanel from "@/components/accounting/CapitalPanel";
import StatementsClient from "@/components/accounting/StatementsClient";
import InvoicesPanel from "@/components/accounting/InvoicesPanel";
import type { AccountingTransactionRow, PayrollRunRow } from "@/lib/accounting";
import type { CustomerRow } from "@/lib/customers";
import type { IssuedInvoiceRow } from "@/lib/invoices";
import type { ExpenseBudgetRow } from "@/lib/expenseBudgets";
import type { RecurringExpenseRow } from "@/lib/recurringExpenses";
import type { RecurringIncomeRow } from "@/lib/recurringIncome";
import type { FinancialAccountRow } from "@/lib/financialAccounts";
import type { ClosedPeriodRow } from "@/lib/periodClosing";
import type { CapitalEntryRow } from "@/lib/capital";
import type { CapitalBudgetRow } from "@/lib/capitalBudgets";
import type { InvestmentPayoutRow, InvestmentRow, InvestorRow } from "@/lib/investors";
import type { GovernmentSupportRow, GovernmentSupporterRow } from "@/lib/governmentSupport";
import type { ProductRow } from "@/lib/procurement";
import type { UserRole } from "@/lib/users";
import PageHeader from "@/components/hud/PageHeader";
import FolderTabs from "@/components/hud/FolderTabs";

type Tab = "ledger" | "payroll" | "capital" | "statements" | "invoices";

export default function AccountingTabs({
  transactions,
  expenseBudgets,
  recurringExpenses,
  recurringIncome,
  financialAccounts,
  closedPeriods,
  payrollRuns,
  capitalEntries,
  capitalBudgets,
  products,
  investors,
  investments,
  payouts,
  governmentSupporters,
  governmentSupport,
  invoices,
  customers,
  baseCurrency,
  exchangeRates,
  actorRole,
}: {
  transactions: AccountingTransactionRow[];
  expenseBudgets: ExpenseBudgetRow[];
  recurringExpenses: RecurringExpenseRow[];
  recurringIncome: RecurringIncomeRow[];
  financialAccounts: FinancialAccountRow[];
  closedPeriods: ClosedPeriodRow[];
  payrollRuns: PayrollRunRow[];
  capitalEntries: CapitalEntryRow[];
  capitalBudgets: CapitalBudgetRow[];
  products: ProductRow[];
  investors: InvestorRow[];
  investments: InvestmentRow[];
  payouts: InvestmentPayoutRow[];
  governmentSupporters: GovernmentSupporterRow[];
  governmentSupport: GovernmentSupportRow[];
  invoices: IssuedInvoiceRow[];
  customers: CustomerRow[];
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
          { key: "statements", label: "Statements" },
          { key: "invoices", label: "Invoices" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "ledger" && (
        <LedgerPanel
          transactions={transactions}
          expenseBudgets={expenseBudgets}
          recurringExpenses={recurringExpenses}
          recurringIncome={recurringIncome}
          financialAccounts={financialAccounts}
          closedPeriods={closedPeriods}
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
      {tab === "statements" && <StatementsClient baseCurrency={baseCurrency} exchangeRates={exchangeRates} />}
      {tab === "invoices" && <InvoicesPanel invoices={invoices} customers={customers} />}
    </div>
  );
}
