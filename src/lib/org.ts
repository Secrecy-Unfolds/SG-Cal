import { query, withTransaction } from "@/lib/db";
import type { PoolClient } from "pg";
import {
  isStructureControlled,
  type DepartmentRow,
  type JobTitleRow,
  type StructuralKey,
} from "@/lib/orgDisplay";
import { MODULE_KEYS, type ModuleKey } from "@/lib/orgModulesDisplay";

export type { DepartmentRow, JobTitleRow } from "@/lib/orgDisplay";

// ---- Job titles ----

const TITLE_SELECT = `
  SELECT jt.id, jt.name, jt.level, jt.qualified_by_department, jt.structural_key,
         (SELECT COUNT(*)::int FROM employee_details ed WHERE ed.job_title_id = jt.id) AS member_count
  FROM job_titles jt
`;

export async function listJobTitles(): Promise<JobTitleRow[]> {
  const res = await query<JobTitleRow>(`${TITLE_SELECT} ORDER BY jt.level ASC, jt.name ASC`);
  return res.rows;
}

export async function getJobTitleById(id: number): Promise<JobTitleRow | null> {
  const res = await query<JobTitleRow>(`${TITLE_SELECT} WHERE jt.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export async function createJobTitle(input: {
  name: string;
  level: number;
  qualifiedByDepartment: boolean;
}): Promise<{ ok: true; title: JobTitleRow } | { ok: false; error: string }> {
  try {
    const res = await query<{ id: number }>(
      `INSERT INTO job_titles (name, level, qualified_by_department) VALUES ($1, $2, $3) RETURNING id`,
      [input.name, input.level, input.qualifiedByDepartment]
    );
    const title = await getJobTitleById(res.rows[0].id);
    return title ? { ok: true, title } : { ok: false, error: "Failed to load the new title" };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "A job title with that name already exists" };
    throw err;
  }
}

export async function updateJobTitle(
  id: number,
  input: { name: string; level: number; qualifiedByDepartment: boolean }
): Promise<{ ok: true; title: JobTitleRow } | { ok: false; error: string; notFound?: boolean }> {
  try {
    const res = await query(
      `UPDATE job_titles SET name = $1, level = $2, qualified_by_department = $3 WHERE id = $4`,
      [input.name, input.level, input.qualifiedByDepartment, id]
    );
    if ((res.rowCount ?? 0) === 0) return { ok: false, error: "Not found", notFound: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "A job title with that name already exists" };
    throw err;
  }
  const title = await getJobTitleById(id);
  return title ? { ok: true, title } : { ok: false, error: "Not found", notFound: true };
}

// The six structural titles (CEO ... Team Lead) can be renamed but never
// deleted — the hierarchy logic looks them up by key. Anyone holding a
// deleted (non-structural) title is left with none (FK ON DELETE SET NULL).
export async function deleteJobTitle(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const title = await getJobTitleById(id);
  if (!title) return { ok: true };
  if (title.structural_key) {
    return { ok: false, error: `"${title.name}" is part of the hierarchy and can't be deleted — you can rename it` };
  }
  await query(`DELETE FROM job_titles WHERE id = $1`, [id]);
  return { ok: true };
}

async function titleIdByKey(client: PoolClient, key: StructuralKey): Promise<number | null> {
  const res = await client.query<{ id: number }>(`SELECT id FROM job_titles WHERE structural_key = $1`, [key]);
  return res.rows[0]?.id ?? null;
}

// ---- Structural roles (Manager / Director / Project Head / Team Lead) ----
//
// The four titles that mirror a real role in the structure. A person holds at
// most ONE kind of role (they may hold the same kind more than once where the
// structure allows it: a Director of several departments, a Project Head of
// several projects), and the job title always follows the role — set when it's
// given, cleared when the last one of that kind is removed.

export type RoleKey = "manager" | "director" | "project_head" | "team_lead";

const ROLE_LABEL: Record<RoleKey, string> = {
  manager: "Manager",
  director: "Director",
  project_head: "Project Head",
  team_lead: "Team Lead",
};

// Does `userId` still hold this kind of role anywhere?
const HOLDS_SQL: Record<RoleKey, string> = {
  manager: `SELECT 1 FROM departments WHERE manager_id = $1 LIMIT 1`,
  director: `SELECT 1 FROM departments WHERE director_id = $1 LIMIT 1`,
  project_head: `SELECT 1 FROM projects WHERE project_head_id = $1 LIMIT 1`,
  team_lead: `SELECT 1 FROM teams WHERE team_lead_id = $1 LIMIT 1`,
};

// Gives `userId` the title for `role` (creating their employee record if they
// have none yet). A Manager is also placed in the Department they manage.
export async function setStructuralTitle(
  client: PoolClient,
  userId: number,
  role: RoleKey,
  departmentId?: number
): Promise<void> {
  const titleId = await titleIdByKey(client, role);
  if (departmentId !== undefined) {
    await client.query(
      `INSERT INTO employee_details (user_id, department_id, job_title_id, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE SET department_id = $2, job_title_id = $3, updated_at = now()`,
      [userId, departmentId, titleId]
    );
  } else {
    await client.query(
      `INSERT INTO employee_details (user_id, job_title_id, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET job_title_id = $2, updated_at = now()`,
      [userId, titleId]
    );
  }
}

// Clears a person's role title once they no longer hold that kind of role
// anywhere (they may have been given a different title since, which is left
// alone). The rest of their record is untouched.
export async function clearStructuralTitleIfUnused(client: PoolClient, userId: number, role: RoleKey): Promise<void> {
  const still = await client.query(HOLDS_SQL[role], [userId]);
  if (still.rows.length > 0) return;
  const titleId = await titleIdByKey(client, role);
  if (titleId === null) return;
  await client.query(`UPDATE employee_details SET job_title_id = NULL, updated_at = now() WHERE user_id = $1 AND job_title_id = $2`, [
    userId,
    titleId,
  ]);
}

// What structural role (if any) a person currently holds, described for an
// error message ("the Manager of HR").
export async function describeStructuralRole(
  userId: number
): Promise<{ username: string; titleKey: StructuralKey | null; role: RoleKey | null; where: string | null } | null> {
  const user = await query<{ username: string; key: StructuralKey | null }>(
    `SELECT u.username, jt.structural_key AS key
     FROM users u
     LEFT JOIN employee_details ed ON ed.user_id = u.id
     LEFT JOIN job_titles jt ON jt.id = ed.job_title_id
     WHERE u.id = $1`,
    [userId]
  );
  const row = user.rows[0];
  if (!row) return null;
  const base = { username: row.username, titleKey: row.key };

  const mgr = await query<{ name: string }>(`SELECT name FROM departments WHERE manager_id = $1 LIMIT 1`, [userId]);
  if (mgr.rows[0]) return { ...base, role: "manager", where: `the Manager of ${mgr.rows[0].name}` };
  const dir = await query<{ name: string }>(`SELECT name FROM departments WHERE director_id = $1 LIMIT 1`, [userId]);
  if (dir.rows[0]) return { ...base, role: "director", where: `the Director of ${dir.rows[0].name}` };
  const head = await query<{ name: string }>(`SELECT name FROM projects WHERE project_head_id = $1 LIMIT 1`, [userId]);
  if (head.rows[0]) return { ...base, role: "project_head", where: `the Project Head of ${head.rows[0].name}` };
  const lead = await query<{ name: string; project: string }>(
    `SELECT t.name, p.name AS project FROM teams t JOIN projects p ON p.id = t.project_id WHERE t.team_lead_id = $1 LIMIT 1`,
    [userId]
  );
  if (lead.rows[0]) {
    return { ...base, role: "team_lead", where: `the Team Lead of ${lead.rows[0].name} (${lead.rows[0].project})` };
  }
  return { ...base, role: null, where: null };
}

// Where a person currently sits as a member: a Team, or directly on a Project.
export async function describeMembership(
  userId: number
): Promise<{ projectId: number; projectName: string; teamId: number | null; where: string } | null> {
  const team = await query<{ team_id: number; team: string; project_id: number; project: string }>(
    `SELECT t.id AS team_id, t.name AS team, p.id AS project_id, p.name AS project
     FROM team_members tm JOIN teams t ON t.id = tm.team_id JOIN projects p ON p.id = t.project_id
     WHERE tm.user_id = $1`,
    [userId]
  );
  if (team.rows[0]) {
    const r = team.rows[0];
    return { projectId: r.project_id, projectName: r.project, teamId: r.team_id, where: `in the ${r.team} team (${r.project})` };
  }
  const direct = await query<{ project_id: number; project: string }>(
    `SELECT p.id AS project_id, p.name AS project FROM project_members pm JOIN projects p ON p.id = pm.project_id WHERE pm.user_id = $1 LIMIT 1`,
    [userId]
  );
  if (direct.rows[0]) {
    const r = direct.rows[0];
    return { projectId: r.project_id, projectName: r.project, teamId: null, where: `on the ${r.project} project` };
  }
  return null;
}

// Checks that `userId` may take a structural role without breaking the
// one-title-per-person rule. Shared by Departments (Manager/Director) and
// Projects/Teams (Project Head/Team Lead).
export async function validateStructuralRoleHolder(
  userId: number,
  role: RoleKey,
  except?: { departmentId?: number; teamId?: number }
): Promise<string | null> {
  const desc = await describeStructuralRole(userId);
  if (!desc) return "That person doesn't exist";
  const label = ROLE_LABEL[role];

  if (desc.titleKey === "ceo" || desc.titleKey === "chief_officer") {
    return `${desc.username} is ${desc.titleKey === "ceo" ? "the CEO" : "a Chief Officer"} — change their job title before making them a ${label}`;
  }
  if (desc.role && desc.role !== role) {
    return `${desc.username} is already ${desc.where} — a person can only hold one kind of role (Manager, Director, Project Head or Team Lead)`;
  }
  if (role === "manager") {
    const other = await query<{ name: string }>(
      `SELECT name FROM departments WHERE manager_id = $1 AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
      [userId, except?.departmentId ?? null]
    );
    if (other.rows[0]) return `${desc.username} already manages ${other.rows[0].name} — a person manages at most one department`;
  }
  if (role === "team_lead") {
    const other = await query<{ name: string }>(
      `SELECT name FROM teams WHERE team_lead_id = $1 AND ($2::int IS NULL OR id <> $2) LIMIT 1`,
      [userId, except?.teamId ?? null]
    );
    if (other.rows[0]) return `${desc.username} already leads the ${other.rows[0].name} team — a person leads at most one team`;
  }
  // Someone with a role reports up the structure, not to a Team Lead / Project
  // Head, so they can't also be a plain member of a Team or Project.
  const membership = await describeMembership(userId);
  if (membership) {
    return `${desc.username} is ${membership.where} — remove them from it before making them a ${label}`;
  }
  return null;
}

// ---- Departments ----

const DEPARTMENT_SELECT = `
  SELECT d.id, d.name, d.description, d.manager_id, mu.username AS manager_username,
         d.director_id, du.username AS director_username,
         (SELECT COUNT(*)::int FROM employee_details ed WHERE ed.department_id = d.id) AS member_count,
         COALESCE(
           (SELECT json_agg(dm.module_key ORDER BY dm.module_key) FROM department_modules dm WHERE dm.department_id = d.id),
           '[]'
         ) AS module_keys
  FROM departments d
  LEFT JOIN users mu ON mu.id = d.manager_id
  LEFT JOIN users du ON du.id = d.director_id
`;

export async function listDepartments(): Promise<DepartmentRow[]> {
  const res = await query<DepartmentRow>(`${DEPARTMENT_SELECT} ORDER BY d.name ASC`);
  return res.rows;
}

export async function getDepartmentById(id: number): Promise<DepartmentRow | null> {
  const res = await query<DepartmentRow>(`${DEPARTMENT_SELECT} WHERE d.id = $1`, [id]);
  return res.rows[0] ?? null;
}

// Naming a Manager places them in that Department and gives them the Manager
// title; naming a Director gives the Director title (a Director sits above
// several Departments, so no Department is set for them). Whoever held the
// role before has the title cleared.
async function syncDepartmentPeople(
  client: PoolClient,
  departmentId: number,
  next: { managerId: number | null; directorId: number | null },
  prev: { managerId: number | null; directorId: number | null }
) {
  if (next.managerId !== null) await setStructuralTitle(client, next.managerId, "manager", departmentId);
  if (prev.managerId !== null && prev.managerId !== next.managerId) {
    await clearStructuralTitleIfUnused(client, prev.managerId, "manager");
  }
  if (next.directorId !== null) await setStructuralTitle(client, next.directorId, "director");
  if (prev.directorId !== null && prev.directorId !== next.directorId) {
    await clearStructuralTitleIfUnused(client, prev.directorId, "director");
  }
}

type DepartmentInput = {
  name: string;
  description: string;
  managerId: number | null;
  directorId: number | null;
  moduleKeys: ModuleKey[];
};

async function validateDepartmentPeople(input: DepartmentInput, departmentId: number | null): Promise<string | null> {
  if (input.managerId !== null && input.managerId === input.directorId) {
    return "The Manager and the Director of a department must be different people";
  }
  if (input.managerId !== null) {
    const err = await validateStructuralRoleHolder(input.managerId, "manager", { departmentId: departmentId ?? undefined });
    if (err) return err;
  }
  if (input.directorId !== null) {
    const err = await validateStructuralRoleHolder(input.directorId, "director");
    if (err) return err;
  }
  return null;
}

async function syncDepartmentModules(client: PoolClient, departmentId: number, moduleKeys: ModuleKey[]) {
  const unique = Array.from(new Set(moduleKeys)).filter((k) => MODULE_KEYS.includes(k));
  await client.query(`DELETE FROM department_modules WHERE department_id = $1`, [departmentId]);
  if (unique.length > 0) {
    const values = unique.map((_, i) => `($1, $${i + 2})`).join(", ");
    await client.query(`INSERT INTO department_modules (department_id, module_key) VALUES ${values}`, [
      departmentId,
      ...unique,
    ]);
  }
}

export async function createDepartment(
  input: DepartmentInput
): Promise<{ ok: true; department: DepartmentRow } | { ok: false; error: string }> {
  const peopleError = await validateDepartmentPeople(input, null);
  if (peopleError) return { ok: false, error: peopleError };
  try {
    const id = await withTransaction(async (client) => {
      const res = await client.query<{ id: number }>(
        `INSERT INTO departments (name, description, manager_id, director_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [input.name, input.description, input.managerId, input.directorId]
      );
      const newId = res.rows[0].id;
      await syncDepartmentPeople(client, newId, input, { managerId: null, directorId: null });
      await syncDepartmentModules(client, newId, input.moduleKeys);
      return newId;
    });
    const department = await getDepartmentById(id);
    return department ? { ok: true, department } : { ok: false, error: "Failed to load the new department" };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "A department with that name already exists" };
    throw err;
  }
}

export async function updateDepartment(
  id: number,
  input: DepartmentInput
): Promise<{ ok: true; department: DepartmentRow } | { ok: false; error: string; notFound?: boolean }> {
  const existing = await getDepartmentById(id);
  if (!existing) return { ok: false, error: "Not found", notFound: true };
  const peopleError = await validateDepartmentPeople(input, id);
  if (peopleError) return { ok: false, error: peopleError };
  try {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE departments SET name = $1, description = $2, manager_id = $3, director_id = $4, updated_at = now() WHERE id = $5`,
        [input.name, input.description, input.managerId, input.directorId, id]
      );
      await syncDepartmentPeople(client, id, input, { managerId: existing.manager_id, directorId: existing.director_id });
      await syncDepartmentModules(client, id, input.moduleKeys);
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "A department with that name already exists" };
    throw err;
  }
  const department = await getDepartmentById(id);
  return department ? { ok: true, department } : { ok: false, error: "Not found", notFound: true };
}

// Members simply lose their Department (FK ON DELETE SET NULL); the Manager
// and Director lose the matching job title if they no longer hold the role
// anywhere else. A Department that still owns Projects can't be deleted —
// each Project belongs to exactly one Department.
export async function deleteDepartment(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getDepartmentById(id);
  if (!existing) return { ok: true };
  const projects = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM projects WHERE department_id = $1`, [id]);
  if (projects.rows[0].n > 0) {
    return {
      ok: false,
      error: `${existing.name} still has ${projects.rows[0].n} project${projects.rows[0].n === 1 ? "" : "s"} — move or delete them first`,
    };
  }
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM departments WHERE id = $1`, [id]);
    if (existing.manager_id !== null) await clearStructuralTitleIfUnused(client, existing.manager_id, "manager");
    if (existing.director_id !== null) await clearStructuralTitleIfUnused(client, existing.director_id, "director");
  });
  return { ok: true };
}

// ---- An employee's own Department / title assignment ----

// Applied by hr.ts's upsertEmployeeDetails. The structure wins over what the
// form sent: a Department's Manager is always in that Department with the
// Manager title, a Director / Project Head / Team Lead always has their title.
// Otherwise the title is picked by hand, except the structure-controlled ones
// (Manager / Director / Project Head / Team Lead), which can only come from
// the structure. There is one CEO. `reports_to` only means anything for a
// Director (their Chief Officer) and is dropped for everyone else.
export async function resolveEmployeeOrgAssignment(
  userId: number,
  input: { departmentId: number | null; jobTitleId: number | null; reportsToId: number | null }
): Promise<
  | { ok: true; departmentId: number | null; jobTitleId: number | null; reportsToId: number | null }
  | { ok: false; error: string }
> {
  if (input.departmentId !== null) {
    const dept = await getDepartmentById(input.departmentId);
    if (!dept) return { ok: false, error: "That department doesn't exist" };
  }

  const managed = await query<{ id: number; name: string }>(`SELECT id, name FROM departments WHERE manager_id = $1`, [userId]);
  const current = await query<{ job_title_id: number | null }>(
    `SELECT job_title_id FROM employee_details WHERE user_id = $1`,
    [userId]
  );
  const currentTitleId = current.rows[0]?.job_title_id ?? null;

  let departmentId = input.departmentId;
  let jobTitleId = input.jobTitleId;
  let titleKey: StructuralKey | null = null;

  const idByKey = async (key: StructuralKey): Promise<number | null> => {
    const res = await query<{ id: number }>(`SELECT id FROM job_titles WHERE structural_key = $1`, [key]);
    return res.rows[0]?.id ?? null;
  };

  // The structural role the person holds (if any) decides their title.
  let heldRole: RoleKey | null = null;
  if (managed.rows[0]) heldRole = "manager";
  else {
    for (const role of ["director", "project_head", "team_lead"] as RoleKey[]) {
      const held = await query(HOLDS_SQL[role], [userId]);
      if (held.rows.length > 0) {
        heldRole = role;
        break;
      }
    }
  }

  if (heldRole === "manager") {
    if (departmentId !== managed.rows[0].id) {
      return { ok: false, error: `They manage ${managed.rows[0].name} — change that department's manager first` };
    }
  }
  if (heldRole) {
    jobTitleId = await idByKey(heldRole);
    titleKey = heldRole;
  } else if (jobTitleId !== null) {
    const title = await getJobTitleById(jobTitleId);
    if (!title) return { ok: false, error: "That job title doesn't exist" };
    titleKey = title.structural_key;
    if (isStructureControlled(titleKey) && jobTitleId !== currentTitleId) {
      return {
        ok: false,
        error: `"${title.name}" is set through the structure (a Department's Manager or Director, a Project's Head, a Team's Lead) — not picked on the employee`,
      };
    }
    if (titleKey === "ceo") {
      const other = await query<{ username: string }>(
        `SELECT u.username FROM employee_details ed
         JOIN users u ON u.id = ed.user_id
         WHERE ed.job_title_id = $1 AND ed.user_id <> $2 LIMIT 1`,
        [jobTitleId, userId]
      );
      if (other.rows[0]) return { ok: false, error: `${other.rows[0].username} is already the CEO` };
    }
  }

  let reportsToId: number | null = null;
  if (titleKey === "director" && input.reportsToId !== null) {
    const target = await query<{ key: StructuralKey | null }>(
      `SELECT jt.structural_key AS key FROM employee_details ed JOIN job_titles jt ON jt.id = ed.job_title_id WHERE ed.user_id = $1`,
      [input.reportsToId]
    );
    if (target.rows[0]?.key !== "chief_officer") {
      return { ok: false, error: "A Director reports to a Chief Officer — pick someone whose title is Chief Officer" };
    }
    reportsToId = input.reportsToId;
  }

  return { ok: true, departmentId, jobTitleId, reportsToId };
}

// Users currently titled Chief Officer — the picker for a Director's
// "reports to".
export async function listChiefOfficers(): Promise<{ id: number; username: string }[]> {
  const res = await query<{ id: number; username: string }>(
    `SELECT u.id, u.username FROM employee_details ed
     JOIN users u ON u.id = ed.user_id
     JOIN job_titles jt ON jt.id = ed.job_title_id
     WHERE jt.structural_key = 'chief_officer' ORDER BY u.username ASC`
  );
  return res.rows;
}
