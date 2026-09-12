"use client";

import { useState } from "react";
import TransactionsListClient from "@/components/accounting/TransactionsListClient";
import PayrollRunsClient from "@/components/accounting/PayrollRunsClient";
import type { AccountingTransactionRow, PayrollRunRow } from "@/lib/accounting";
import PageHeader from "@/components/hud/PageHeader";

type Tab = "ledger" | "payroll";

export default function AccountingTabs({
  transactions,
  payrollRuns,
}: {
  transactions: AccountingTransactionRow[];
  payrollRuns: PayrollRunRow[];
}) {
  const [tab, setTab] = useState<Tab>("ledger");

  return (
    <div>
      <PageHeader label="ACCOUNTING" title="Accounting" />

      <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm w-fit mb-4">
        <button
          type="button"
          onClick={() => setTab("ledger")}
          className={`px-4 py-1.5 rounded-md font-mono text-xs font-semibold uppercase tracking-wide transition-colors ${
            tab === "ledger" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
          }`}
        >
          Ledger
        </button>
        <button
          type="button"
          onClick={() => setTab("payroll")}
          className={`px-4 py-1.5 rounded-md font-mono text-xs font-semibold uppercase tracking-wide transition-colors ${
            tab === "payroll" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
          }`}
        >
          Payroll
        </button>
      </div>

      {tab === "ledger" && <TransactionsListClient transactions={transactions} />}
      {tab === "payroll" && <PayrollRunsClient runs={payrollRuns} />}
    </div>
  );
}
