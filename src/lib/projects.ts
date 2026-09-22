import { query, withTransaction } from "@/lib/db";
import {
  clearStructuralTitleIfUnused,
  describeMembership,
  describeStructuralRole,
  getDepartmentById,
  isUniqueViolation,
  setStructuralTitle,
  validateStructuralRoleHolder,
} from "@/lib/org";
import type { PersonRef, ProjectDetail, ProjectRow, ProjectStatus, TeamRow } from "@/lib/projectDisplay";

export type { ProjectDetail, ProjectRow, TeamRow } from "@/lib/projectDisplay";

// ---- Projects ----

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.status, p.start_date, p.target_end_date, p.budget, p.currency,
         p.department_id, d.name AS department_name,
         p.project_head_id, hu.username AS project_head_username,
         (SELECT COUNT(*)::int FROM teams t WHERE t.project_id = p.id) AS team_count,
         (
           (SELECT COUNT(*) FROM teams t WHERE t.project_id = p.id AND t.team_lead_id IS NOT NULL)
           + (SELECT COUNT(*) FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE t.project_id = p.id)
           + (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id)
         )::int AS member_count
  FROM projects p
  JOIN departments d ON d.id = p.department_id
  LEFT JOIN users hu ON hu.id = p.project_head_id
`;

export async function listProjects(): Promise<ProjectRow[]> {
  const res = await query<ProjectRow>(`${PROJECT_SELECT} ORDER BY p.created_at DESC`);
  return res.rows;
}

export async function getProjectById(id: number): Promise<ProjectRow | null> {
  const res = await query<ProjectRow>(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
  return res.rows[0] ?? null;
}

const TEAM_SELECT = `
  SELECT t.id, t.project_id, p.name AS project_name, t.name, t.team_lead_id, lu.username AS team_lead_username,
         COALESCE(
           (SELECT json_agg(json_build_object('id', u.id, 'username', u.username) ORDER BY u.username)
            FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = t.id),
           '[]'
         ) AS members
  FROM teams t
  JOIN projects p ON p.id = t.project_id
  LEFT JOIN users lu ON lu.id = t.team_lead_id
`;

export async function listTeams(projectId?: number): Promise<TeamRow[]> {
  const res = projectId
    ? await query<TeamRow>(`${TEAM_SELECT} WHERE t.project_id = $1 ORDER BY t.name ASC`, [projectId])
    : await query<TeamRow>(`${TEAM_SELECT} ORDER BY p.name ASC, t.name ASC`);
  return res.rows;
}

export async function getTeamById(id: number): Promise<TeamRow | null> {
  const res = await query<TeamRow>(`${TEAM_SELECT} WHERE t.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function getProjectDetail(id: number): Promise<ProjectDetail | null> {
  const project = await getProjectById(id);
  if (!project) return null;
  const [teams, direct] = await Promise.all([
    listTeams(id),
    query<PersonRef>(
      `SELECT u.id, u.username FROM project_members pm JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 ORDER BY u.username ASC`,
      [id]
    ),
  ]);
  return { ...project, teams, direct_members: direct.rows };
}

export type ProjectInput = {
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string | null;
  targetEndDate: string | null;
  budget: number | null;
  currency: string;
  departmentId: number;
  projectHeadId: number;
};

// A Project Head can head several Projects, but they all have to be in the
// same Department — the Head reports to that Department's Manager, and that
// has to be one person.
async function validateProject(input: ProjectInput, projectId: number | null): Promise<string | null> {
  if (input.startDate && input.targetEndDate && input.targetEndDate < input.startDate) {
    return "The target end date can't be before the start date";
  }
  if (input.budget !== null && !(input.budget >= 0)) return "The budget can't be negative";
  if (!(await getDepartmentById(input.departmentId))) return "That department doesn't exist";

  const roleError = await validateStructuralRoleHolder(input.projectHeadId, "project_head");
  if (roleError) return roleError;

  const other = await query<{ name: string; dept: string }>(
    `SELECT p.name, d.name AS dept FROM projects p JOIN departments d ON d.id = p.department_id
     WHERE p.project_head_id = $1 AND p.department_id <> $2 AND ($3::int IS NULL OR p.id <> $3) LIMIT 1`,
    [input.projectHeadId, input.departmentId, projectId]
  );
  if (other.rows[0]) {
    const head = await describeStructuralRole(input.projectHeadId);
    return `${head?.username ?? "They"} already heads ${other.rows[0].name} in ${other.rows[0].dept} — a Project Head's projects must all be in one department`;
  }
  return null;
}

export async function createProject(
  input: ProjectInput,
  createdBy: number
): Promise<{ ok: true; project: ProjectRow } | { ok: false; error: string }> {
  const error = await validateProject(input, null);
  if (error) return { ok: false, error };
  try {
    const id = await withTransaction(async (client) => {
      const res = await client.query<{ id: number }>(
        `INSERT INTO projects (name, description, status, start_date, target_end_date, budget, currency, department_id, project_head_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          input.name,
          input.description,
          input.status,
          input.startDate,
          input.targetEndDate,
          input.budget,
          input.currency,
          input.departmentId,
          input.projectHeadId,
          createdBy,
        ]
      );
      await setStructuralTitle(client, input.projectHeadId, "project_head");
      return res.rows[0].id;
    });
    const project = await getProjectById(id);
    return project ? { ok: true, project } : { ok: false, error: "Failed to load the new project" };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "A project with that name already exists" };
    throw err;
  }
}

export async function updateProject(
  id: number,
  input: ProjectInput
): Promise<{ ok: true; project: ProjectRow } | { ok: false; error: string; notFound?: boolean }> {
  const existing = await getProjectById(id);
  if (!existing) return { ok: false, error: "Not found", notFound: true };
  const error = await validateProject(input, id);
  if (error) return { ok: false, error };
  try {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE projects SET name = $1, description = $2, status = $3, start_date = $4, target_end_date = $5,
                budget = $6, currency = $7, department_id = $8, project_head_id = $9, updated_at = now()
         WHERE id = $10`,
        [
          input.name,
          input.description,
          input.status,
          input.startDate,
          input.targetEndDate,
          input.budget,
          input.currency,
          input.departmentId,
          input.projectHeadId,
          id,
        ]
      );
      await setStructuralTitle(client, input.projectHeadId, "project_head");
      if (existing.project_head_id !== null && existing.project_head_id !== input.projectHeadId) {
        await clearStructuralTitleIfUnused(client, existing.project_head_id, "project_head");
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "A project with that name already exists" };
    throw err;
  }
  const project = await getProjectById(id);
  return project ? { ok: true, project } : { ok: false, error: "Not found", notFound: true };
}

// Deletes the Project with its Teams and memberships (FK cascades); the Head
// and every Team Lead lose the matching title if they hold no such role
// elsewhere.
export async function deleteProject(id: number): Promise<void> {
  const project = await getProjectById(id);
  if (!project) return;
  const teams = await listTeams(id);
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM projects WHERE id = $1`, [id]);
    if (project.project_head_id !== null) await clearStructuralTitleIfUnused(client, project.project_head_id, "project_head");
    for (const t of teams) {
      if (t.team_lead_id !== null) await clearStructuralTitleIfUnused(client, t.team_lead_id, "team_lead");
    }
  });
}

// ---- Teams ----

export async function createTeam(input: {
  projectId: number;
  name: string;
  teamLeadId: number;
}): Promise<{ ok: true; team: TeamRow } | { ok: false; error: string }> {
  if (!(await getProjectById(input.projectId))) return { ok: false, error: "That project doesn't exist" };
  const roleError = await validateStructuralRoleHolder(input.teamLeadId, "team_lead");
  if (roleError) return { ok: false, error: roleError };
  try {
    const id = await withTransaction(async (client) => {
      const res = await client.query<{ id: number }>(
        `INSERT INTO teams (project_id, name, team_lead_id) VALUES ($1, $2, $3) RETURNING id`,
        [input.projectId, input.name, input.teamLeadId]
      );
      await setStructuralTitle(client, input.teamLeadId, "team_lead");
      return res.rows[0].id;
    });
    const team = await getTeamById(id);
    return team ? { ok: true, team } : { ok: false, error: "Failed to load the new team" };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "This project already has a team with that name" };
    throw err;
  }
}

export async function updateTeam(
  id: number,
  input: { name: string; teamLeadId: number }
): Promise<{ ok: true; team: TeamRow } | { ok: false; error: string; notFound?: boolean }> {
  const existing = await getTeamById(id);
  if (!existing) return { ok: false, error: "Not found", notFound: true };
  const roleError = await validateStructuralRoleHolder(input.teamLeadId, "team_lead", { teamId: id });
  if (roleError) return { ok: false, error: roleError };
  try {
    await withTransaction(async (client) => {
      await client.query(`UPDATE teams SET name = $1, team_lead_id = $2, updated_at = now() WHERE id = $3`, [
        input.name,
        input.teamLeadId,
        id,
      ]);
      await setStructuralTitle(client, input.teamLeadId, "team_lead");
      if (existing.team_lead_id !== null && existing.team_lead_id !== input.teamLeadId) {
        await clearStructuralTitleIfUnused(client, existing.team_lead_id, "team_lead");
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "This project already has a team with that name" };
    throw err;
  }
  const team = await getTeamById(id);
  return team ? { ok: true, team } : { ok: false, error: "Not found", notFound: true };
}

// Members simply leave the Team (they fall back to the Department Manager as
// their boss until placed again); the Lead loses the Team Lead title.
export async function deleteTeam(id: number): Promise<void> {
  const team = await getTeamById(id);
  if (!team) return;
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM teams WHERE id = $1`, [id]);
    if (team.team_lead_id !== null) await clearStructuralTitleIfUnused(client, team.team_lead_id, "team_lead");
  });
}

// ---- Membership: at most one Project per person ----

// People with a structural role (Manager / Director / Project Head / Team
// Lead) or the CEO / Chief Officer title report up the structure, not to a
// Team Lead or Project Head — so they can't be plain members.
async function memberBlocker(userId: number): Promise<string | null> {
  const desc = await describeStructuralRole(userId);
  if (!desc) return "That person doesn't exist";
  if (desc.titleKey === "ceo" || desc.titleKey === "chief_officer") {
    return `${desc.username} is ${desc.titleKey === "ceo" ? "the CEO" : "a Chief Officer"} and can't be a project or team member`;
  }
  if (desc.role) return `${desc.username} is ${desc.where} and can't also be a plain project or team member`;
  return null;
}

export async function addTeamMember(teamId: number, userId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const team = await getTeamById(teamId);
  if (!team) return { ok: false, error: "Team not found" };
  const blocker = await memberBlocker(userId);
  if (blocker) return { ok: false, error: blocker };

  const membership = await describeMembership(userId);
  const name = (await describeStructuralRole(userId))?.username ?? "They";
  if (membership) {
    if (membership.projectId !== team.project_id) {
      return { ok: false, error: `${name} is already ${membership.where} — a person is on at most one project` };
    }
    if (membership.teamId !== null) {
      return {
        ok: false,
        error:
          membership.teamId === teamId
            ? `${name} is already in this team`
            : `${name} is already ${membership.where} — a person is in one team only`,
      };
    }
  }
  await withTransaction(async (client) => {
    // Moving from "on the project directly" into a team of that same project.
    await client.query(`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`, [team.project_id, userId]);
    await client.query(`INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)`, [teamId, userId]);
  });
  return { ok: true };
}

export async function removeTeamMember(teamId: number, userId: number): Promise<void> {
  await query(`DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`, [teamId, userId]);
}

export async function addProjectMember(
  projectId: number,
  userId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await getProjectById(projectId))) return { ok: false, error: "Project not found" };
  const blocker = await memberBlocker(userId);
  if (blocker) return { ok: false, error: blocker };

  const membership = await describeMembership(userId);
  const name = (await describeStructuralRole(userId))?.username ?? "They";
  if (membership) {
    return {
      ok: false,
      error:
        membership.projectId === projectId
          ? `${name} is already ${membership.where}`
          : `${name} is already ${membership.where} — a person is on at most one project`,
    };
  }
  await query(`INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [projectId, userId]);
  return { ok: true };
}

export async function removeProjectMember(projectId: number, userId: number): Promise<void> {
  await query(`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`, [projectId, userId]);
}
