import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listPayrollRuns, listTransactions } from "@/lib/accounting";
import AccountingTabs from "@/components/accounting/AccountingTabs";

export default async function AccountingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminLevel(session.role)) redirect("/");

  const [transactions, payrollRuns] = await Promise.all([listTransactions(), listPayrollRuns()]);

  return <AccountingTabs transactions={transactions} payrollRuns={payrollRuns} />;
}
