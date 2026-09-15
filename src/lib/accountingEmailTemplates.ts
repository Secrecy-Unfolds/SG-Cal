import type { AccountingTransactionRow } from "@/lib/accounting";
import { escapeHtml, introText, wrap } from "@/lib/emailShell";
import { formatMoney } from "@/lib/procurementDisplay";
import { formatMuscatDateOnly } from "@/lib/time";

const EXPENSE_COLOR = "#dc2626";

function transactionCard(t: AccountingTransactionRow): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:4px; background:${EXPENSE_COLOR}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(t.description || t.category || "Expense")}</div>
          <div style="font-size:13px; color:#6b7280; margin-top:2px;">${formatMuscatDateOnly(new Date(t.date))}${
    t.category ? ` &middot; ${escapeHtml(t.category)}` : ""
  }</div>
          <div style="margin-top:6px; font-size:14px; font-weight:600; color:#111827;">${escapeHtml(formatMoney(t.amount, t.currency))}</div>
        </td>
      </tr>
    </table>`;
}

// Sent to Super Admins when a manual expense over the approval threshold
// (or in an unconvertible currency) is created — see
// lib/accounting.ts's createTransaction()/decideTransactionStatus().
export function expenseApprovalNeededEmail(t: AccountingTransactionRow, submittedBy: string): { subject: string; html: string } {
  const who = escapeHtml(submittedBy);
  return {
    subject: `Expense needs approval: ${t.description || t.category || "Expense"}`,
    html: wrap(
      `${who} submitted an expense that needs your approval`,
      "Expense needs approval",
      introText(`${who} submitted this expense, which is over the approval threshold and needs a Super Admin's decision:`) +
        transactionCard(t)
    ),
  };
}

export function expenseDecidedEmail(t: AccountingTransactionRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  const verb = t.status === "approved" ? "approved" : "rejected";
  return {
    subject: `Expense ${verb}`,
    html: wrap(
      `${whoSafe} ${verb} your expense`,
      `Expense ${verb}`,
      introText(`${whoSafe} ${verb} this expense:`) + transactionCard(t)
    ),
  };
}
