"use client";

import { useState } from "react";
import CapitalLedgerClient from "@/components/accounting/CapitalLedgerClient";
import InvestorsClient from "@/components/accounting/InvestorsClient";
import GovernmentSupportClient from "@/components/accounting/GovernmentSupportClient";
import CapitalBudgetsClient from "@/components/accounting/CapitalBudgetsClient";
import type { CapitalEntryRow } from "@/lib/capital";
import type { CapitalBudgetRow } from "@/lib/capitalBudgets";
import type { InvestmentPayoutRow, InvestmentRow, InvestorRow } from "@/lib/investors";
import type { GovernmentSupportRow, GovernmentSupporterRow } from "@/lib/governmentSupport";
import type { ProductRow } from "@/lib/procurement";
import FolderTabs from "@/components/hud/FolderTabs";

type SubTab = "entries" | "budgets" | "investors" | "government";

export default function CapitalPanel({
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
}: {
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
}) {
  const [subTab, setSubTab] = useState<SubTab>("entries");

  return (
    <div>
      <FolderTabs
        tabs={[
          { key: "entries", label: "Capital ledger" },
          { key: "budgets", label: "Budgets" },
          { key: "investors", label: "Investors" },
          { key: "government", label: "Government support" },
        ]}
        active={subTab}
        onChange={setSubTab}
      />

      {subTab === "entries" && (
        <CapitalLedgerClient entries={capitalEntries} baseCurrency={baseCurrency} exchangeRates={exchangeRates} />
      )}
      {subTab === "budgets" && (
        <CapitalBudgetsClient budgets={capitalBudgets} products={products} baseCurrency={baseCurrency} exchangeRates={exchangeRates} />
      )}
      {subTab === "investors" && <InvestorsClient investors={investors} investments={investments} payouts={payouts} />}
      {subTab === "government" && (
        <GovernmentSupportClient supporters={governmentSupporters} records={governmentSupport} />
      )}
    </div>
  );
}
