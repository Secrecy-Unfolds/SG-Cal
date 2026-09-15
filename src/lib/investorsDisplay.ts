// Client-safe Investor/Investment constants/types — no server-only imports.

export type InvestmentType = "equity" | "loan";

export const INVESTMENT_TYPES: InvestmentType[] = ["equity", "loan"];

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  equity: "Equity",
  loan: "Loan",
};

// Equity doesn't get "repaid" like a loan — it gets exited (bought out /
// sold) or written off — so status lifecycles are split per investment_type.
export type LoanInvestmentStatus = "active" | "repaid" | "defaulted";
export type EquityInvestmentStatus = "active" | "exited" | "written_off";
export type InvestmentStatus = LoanInvestmentStatus | EquityInvestmentStatus;

export const INVESTMENT_STATUSES_BY_TYPE: Record<InvestmentType, InvestmentStatus[]> = {
  loan: ["active", "repaid", "defaulted"],
  equity: ["active", "exited", "written_off"],
};

export const INVESTMENT_STATUS_LABELS: Record<InvestmentStatus, string> = {
  active: "Active",
  repaid: "Repaid",
  defaulted: "Defaulted",
  exited: "Exited",
  written_off: "Written off",
};

export const INVESTMENT_STATUS_BADGE_CLASS: Record<InvestmentStatus, string> = {
  active: "bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300",
  repaid: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
  exited: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
  defaulted: "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300",
  written_off: "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300",
};

export function isInvestmentType(value: unknown): value is InvestmentType {
  return value === "equity" || value === "loan";
}

export function isValidStatusForType(type: InvestmentType, status: unknown): status is InvestmentStatus {
  return INVESTMENT_STATUSES_BY_TYPE[type].includes(status as InvestmentStatus);
}
