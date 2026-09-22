// Client-safe Project/Team types and constants — no server-only imports
// (lib/projects.ts imports `pg`). Same split as procurementDisplay.ts.

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";

export const PROJECT_STATUSES: ProjectStatus[] = ["planning", "active", "on_hold", "completed", "cancelled"];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PROJECT_STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  planning: "bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60",
  active: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
  on_hold: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  completed: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300",
  cancelled: "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300",
};

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return PROJECT_STATUSES.includes(value as ProjectStatus);
}

export type PersonRef = { id: number; username: string };

export type ProjectRow = {
  id: number;
  name: string;
  description: string;
  status: ProjectStatus;
  start_date: string | null; // "YYYY-MM-DD"
  target_end_date: string | null;
  budget: string | null; // numeric comes back as a string from pg
  currency: string;
  department_id: number;
  department_name: string;
  project_head_id: number | null;
  project_head_username: string | null;
  team_count: number;
  member_count: number; // everyone on the project: team leads + team members + direct members
};

export type TeamRow = {
  id: number;
  project_id: number;
  project_name: string;
  name: string;
  team_lead_id: number | null;
  team_lead_username: string | null;
  members: PersonRef[];
};

export type ProjectDetail = ProjectRow & {
  teams: TeamRow[];
  direct_members: PersonRef[];
};
