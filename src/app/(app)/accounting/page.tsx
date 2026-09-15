import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listPayrollRuns, listTransactions } from "@/lib/accounting";
import { listExpenseBudgets } from "@/lib/expenseBudgets";
import { listRecurringExpenses } from "@/lib/recurringExpenses";
import { listRecurringIncome } from "@/lib/recurringIncome";
import { listFinancialAccounts } from "@/lib/financialAccounts";
import { listClosedPeriods } from "@/lib/periodClosing";
import { listCapitalEntries } from "@/lib/capital";
import { listCapitalBudgets } from "@/lib/capitalBudgets";
import { listProducts } from "@/lib/procurement";
import { listAllPayouts, listInvestments, listInvestors } from "@/lib/investors";
import { listGovernmentSupport, listGovernmentSupporters } from "@/lib/governmentSupport";
import { getBaseCurrency } from "@/lib/settings";
import { getExchangeRateMap } from "@/lib/exchangeRates";
import AccountingTabs from "@/components/accounting/AccountingTabs";

export default async function AccountingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminLevel(session.role)) redirect("/");

  const [
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
    baseCurrency,
    exchangeRateMap,
  ] = await Promise.all([
    listTransactions(),
    listExpenseBudgets(),
    listRecurringExpenses(),
    listRecurringIncome(),
    listFinancialAccounts(),
    listClosedPeriods(),
    listPayrollRuns(),
    listCapitalEntries(),
    listCapitalBudgets(),
    listProducts(),
    listInvestors(),
    listInvestments(),
    listAllPayouts(),
    listGovernmentSupporters(),
    listGovernmentSupport(),
    getBaseCurrency(),
    getExchangeRateMap(),
  ]);

  // Map isn't serializable across the server/client boundary — pass as a
  // plain object, reconstructed into a Map client-side where needed.
  const exchangeRates = Object.fromEntries(exchangeRateMap);

  return (
    <AccountingTabs
      transactions={transactions}
      expenseBudgets={expenseBudgets}
      recurringExpenses={recurringExpenses}
      recurringIncome={recurringIncome}
      financialAccounts={financialAccounts}
      closedPeriods={closedPeriods}
      payrollRuns={payrollRuns}
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
      actorRole={session.role}
    />
  );
}
