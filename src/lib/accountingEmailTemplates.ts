import type { AccountingTransactionRow } from "@/lib/accounting";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import { escapeHtml, introText, wrap } from "@/lib/emailShell";
import { formatMoney } from "@/lib/procurementDisplay";
import { formatMuscatDateOnly } from "@/lib/time";

const EXPENSE_COLOR = "#dc2626";
const INCOME_COLOR = "#16a34a";

function transactionCard(t: AccountingTransactionRow): string {
  const color = t.type === "income" ? INCOME_COLOR : EXPENSE_COLOR;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:4px; background:${color}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(t.description || t.category || "Transaction")}</div>
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

// Sent to Admin-level accounts when a manual entry posts immediately —
// income (never needs approval) or an expense that either cleared the
// threshold check or came from a Super Admin's own authority. Entries that
// go pending instead trigger expenseApprovalNeededEmail above, not this one.
export function transactionCreatedEmail(t: AccountingTransactionRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  const noun = t.type === "income" ? "income" : "expense";
  return {
    subject: `New ${noun} logged: ${t.description || t.category || noun}`,
    html: wrap(
      `${whoSafe} logged a new ${noun} in Accounting`,
      `${noun === "income" ? "Income" : "Expense"} logged`,
      introText(`${whoSafe} added this ${noun} to the Ledger:`) + transactionCard(t)
    ),
  };
}

export function transactionDeletedEmail(t: AccountingTransactionRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  const noun = t.type === "income" ? "income" : "expense";
  return {
    subject: `Removed ${noun}: ${t.description || t.category || noun}`,
    html: wrap(
      `${whoSafe} removed a ${noun} from the Ledger`,
      `${noun === "income" ? "Income" : "Expense"} removed`,
      introText(`${whoSafe} removed this ${noun} from the Ledger. It was:`) + transactionCard(t)
    ),
  };
}

// Sent when a Vendor Invoice auto-posts its linked expense — v2
// Procurement workflow Phase 2 decoupled this from the PO's own status
// (see lib/vendorInvoices.ts) — same "no one filled out a form" framing
// as inventoryItemFromGrnEmail.
export function transactionFromVendorInvoiceEmail(
  t: AccountingTransactionRow,
  po: PurchaseOrderRow,
  who: string
): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `Expense posted from invoice on PO #${po.id}: ${t.description || t.category || "Expense"}`,
    html: wrap(
      `Logging an invoice on PO #${po.id} posted a new Accounting expense`,
      "Expense auto-posted",
      introText(
        `${whoSafe} logged a vendor invoice against Purchase Order #${po.id} (${escapeHtml(po.vendor_name)}), which automatically posted this expense:`
      ) + transactionCard(t)
    ),
  };
}
