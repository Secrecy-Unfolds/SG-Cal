// Client-safe module-access types/constants — no server-only imports
// (lib/orgModules.ts imports `pg`). Organization structure Phase 4 (module
// slice, confirmed 2026-09-22): a Department maps to zero or more of these;
// a plain user in that Department gets VIEW-only access to the module.
//
// Deliberately only the four "line of business" modules — Organization and
// Projects stay Admin-level-only regardless of department, since they're
// structural/admin surfaces, not something a Department "does".
export const MODULE_KEYS = ["procurement", "inventory", "accounting", "hr"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  procurement: "Procurement",
  inventory: "Inventory",
  accounting: "Accounting",
  hr: "HR",
};

export function isModuleKey(value: unknown): value is ModuleKey {
  return MODULE_KEYS.includes(value as ModuleKey);
}
