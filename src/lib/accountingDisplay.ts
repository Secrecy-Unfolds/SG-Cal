// Client-safe Accounting constants/types — no server-only imports.

export type TransactionStatus = "pending" | "approved" | "rejected";

export function isTransactionStatus(value: unknown): value is TransactionStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const TRANSACTION_STATUS_BADGE_CLASS: Record<TransactionStatus, string> = {
  pending: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  approved: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
  rejected: "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300",
};

// A manual expense whose base-currency-converted amount exceeds this (or
// whose currency has no configured exchange rate at all) needs Super-Admin
// approval before it counts — confirmed 2026-09-15/16 via `AskUserQuestion`.
// See lib/accounting.ts's createTransaction().
export const EXPENSE_APPROVAL_THRESHOLD = 200;

// Shared by both recurring_expenses and recurring_income — same frequency
// vocabulary either direction.
export type RecurringExpenseFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export const RECURRING_EXPENSE_FREQUENCIES: RecurringExpenseFrequency[] = ["weekly", "monthly", "quarterly", "yearly"];

export const RECURRING_EXPENSE_FREQUENCY_LABELS: Record<RecurringExpenseFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function isRecurringExpenseFrequency(value: unknown): value is RecurringExpenseFrequency {
  return RECURRING_EXPENSE_FREQUENCIES.includes(value as RecurringExpenseFrequency);
}

export type FinancialAccountType = "bank" | "cash" | "other";

export const FINANCIAL_ACCOUNT_TYPES: FinancialAccountType[] = ["bank", "cash", "other"];

export const FINANCIAL_ACCOUNT_TYPE_LABELS: Record<FinancialAccountType, string> = {
  bank: "Bank",
  cash: "Cash",
  other: "Other",
};

export function isFinancialAccountType(value: unknown): value is FinancialAccountType {
  return FINANCIAL_ACCOUNT_TYPES.includes(value as FinancialAccountType);
}

// Oman's standard VAT rate — pre-fills the editable per-transaction rate
// field when "Taxable" is toggled on. Not used for any live computation;
// the rate that actually applies to a transaction is whatever was stored on
// it at the time (see accounting_transactions.vat_rate).
export const DEFAULT_VAT_RATE = 5;
