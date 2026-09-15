// Client-safe Government/Royal support constants/types — no server-only imports.

export type SupporterType = "ministry" | "department" | "royal_family" | "other";

export const SUPPORTER_TYPES: SupporterType[] = ["ministry", "department", "royal_family", "other"];

export const SUPPORTER_TYPE_LABELS: Record<SupporterType, string> = {
  ministry: "Ministry",
  department: "Government department",
  royal_family: "Royal family",
  other: "Other",
};

export function isSupporterType(value: unknown): value is SupporterType {
  return SUPPORTER_TYPES.includes(value as SupporterType);
}
