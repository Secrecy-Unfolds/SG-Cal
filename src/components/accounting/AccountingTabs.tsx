"use client";

import { useState } from "react";
import TransactionsListClient from "@/components/accounting/TransactionsListClient";
import PayrollRunsClient from "@/components/accounting/PayrollRunsClient";
import type { AccountingTransactionRow, PayrollRunRow } from "@/lib/accounting";
import PageHeader from "@/components/hud/PageHeader";
import FolderTabs from "@/components/hud/FolderTabs";

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

      <FolderTabs
        tabs={[
          { key: "ledger", label: "Ledger" },
          { key: "payroll", label: "Payroll" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "ledger" && <TransactionsListClient transactions={transactions} />}
      {tab === "payroll" && <PayrollRunsClient runs={payrollRuns} />}
    </div>
  );
}
