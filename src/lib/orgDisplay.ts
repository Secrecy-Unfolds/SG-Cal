// Client-safe Organization-structure types/helpers — no server-only imports
// (same split as hrDisplay.ts / eventDisplay.ts: lib/org.ts imports `pg`).

export type StructuralKey = "ceo" | "chief_officer" | "director" | "manager" | "project_head" | "team_lead";

// Titles that mirror a real role in the structure: a Department's Manager or
// Director, a Project's Head, a Team's Lead. They're assigned THROUGH that
// structure (which sets the person's title automatically) and can't be picked
// by hand on an employee — that's what keeps title and structure from
// disagreeing. CEO and Chief Officer have no structural counterpart, so they
// are picked by hand.
export const STRUCTURE_CONTROLLED_KEYS: StructuralKey[] = ["manager", "director", "project_head", "team_lead"];

export function isStructureControlled(key: StructuralKey | null): boolean {
  return key !== null && STRUCTURE_CONTROLLED_KEYS.includes(key);
}

export type JobTitleRow = {
  id: number;
  name: string;
  level: number; // 1 = top of the hierarchy
  qualified_by_department: boolean;
  structural_key: StructuralKey | null;
  member_count: number;
};

export type DepartmentRow = {
  id: number;
  name: string;
  description: string;
  manager_id: number | null;
  manager_username: string | null;
  director_id: number | null;
  director_username: string | null;
  member_count: number;
  // Organization structure Phase 4 — the ERP modules this Department's
  // plain (non-Admin-level) members get VIEW-only access to.
  module_keys: import("@/lib/orgModulesDisplay").ModuleKey[];
};

// "HR Manager" / "IT Officer" for a department-qualified title held by
// someone in a department; otherwise just the title ("Director", "Intern").
export function formatJobTitle(
  title: { name: string; qualified_by_department: boolean } | null,
  departmentName: string | null
): string {
  if (!title) return "";
  return title.qualified_by_department && departmentName ? `${departmentName} ${title.name}` : title.name;
}

export type OrgChartNode = {
  id: number;
  username: string;
  label: string; // formatted title, possibly empty
  department: string;
  children: OrgChartNode[];
};
