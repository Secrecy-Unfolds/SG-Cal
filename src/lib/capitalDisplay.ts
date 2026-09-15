// Client-safe Capital ledger constants/types — no server-only imports.

export type CapitalSource = "owner" | "loan" | "investor" | "government" | "grant" | "other";

export const CAPITAL_SOURCES: CapitalSource[] = ["owner", "loan", "investor", "government", "grant", "other"];

export const CAPITAL_SOURCE_LABELS: Record<CapitalSource, string> = {
  owner: "Owner contribution",
  loan: "Loan",
  investor: "Investor",
  government: "Government / Royal support",
  grant: "Grant",
  other: "Other",
};

export const CAPITAL_SOURCE_BADGE_CLASS: Record<CapitalSource, string> = {
  owner: "bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300",
  loan: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  investor: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
  government: "bg-violet-500/10 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300",
  grant: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
  other: "bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50",
};

export function isCapitalSource(value: unknown): value is CapitalSource {
  return CAPITAL_SOURCES.includes(value as CapitalSource);
}
