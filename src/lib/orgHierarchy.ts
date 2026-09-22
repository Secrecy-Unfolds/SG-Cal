import { query } from "@/lib/db";
import { formatJobTitle, type OrgChartNode, type StructuralKey } from "@/lib/orgDisplay";

// The reporting chain (docs/org-structure-plan.md, "Reporting chain"), derived
// from Department / Project / Team structure — never stored per person except a
// Director's Chief Officer:
//   CEO -> (nobody)                       Chief Officer -> the CEO
//   Director -> reports_to_id (their Chief Officer)
//   a Department's Manager -> that Department's Director
//   a Team Lead -> the Head of the Team's Project
//   a Project Head -> the Manager of the Project's Department
//   a Team member -> their Team Lead
//   a Project member with no Team -> the Project Head
//   everyone else -> the Manager of their Department
// Where a link is missing (a Team with no Lead, a Project with no Head) the
// chain falls through to the next one up, ending at the Project's Department
// Manager, so nobody dangles just because one seat is empty.

type Person = {
  id: number;
  username: string;
  titleKey: StructuralKey | null;
  titleName: string | null;
  titleQualified: boolean;
  departmentId: number | null;
  departmentName: string | null;
  reportsToId: number | null;
};

type Department = { id: number; managerId: number | null; directorId: number | null };
type ProjectNode = { id: number; departmentId: number; headId: number | null };
type TeamNode = { id: number; projectId: number; leadId: number | null };

export type OrgSnapshot = {
  people: Map<number, Person>;
  // person id -> the one person directly above them (null = nobody)
  boss: Map<number, number | null>;
};

export async function loadOrgSnapshot(): Promise<OrgSnapshot> {
  const [peopleRes, deptRes, projectRes, teamRes, teamMemberRes, projectMemberRes] = await Promise.all([
    query<{
      id: number;
      username: string;
      title_key: StructuralKey | null;
      title_name: string | null;
      title_qualified: boolean | null;
      department_id: number | null;
      department_name: string | null;
      reports_to_id: number | null;
    }>(
      `SELECT u.id, u.username, jt.structural_key AS title_key, jt.name AS title_name,
              jt.qualified_by_department AS title_qualified,
              ed.department_id, d.name AS department_name, ed.reports_to_id
       FROM users u
       LEFT JOIN employee_details ed ON ed.user_id = u.id
       LEFT JOIN job_titles jt ON jt.id = ed.job_title_id
       LEFT JOIN departments d ON d.id = ed.department_id
       ORDER BY u.username ASC`
    ),
    query<{ id: number; manager_id: number | null; director_id: number | null }>(
      `SELECT id, manager_id, director_id FROM departments`
    ),
    query<{ id: number; department_id: number; project_head_id: number | null }>(
      `SELECT id, department_id, project_head_id FROM projects ORDER BY id ASC`
    ),
    query<{ id: number; project_id: number; team_lead_id: number | null }>(
      `SELECT id, project_id, team_lead_id FROM teams`
    ),
    query<{ team_id: number; user_id: number }>(`SELECT team_id, user_id FROM team_members`),
    query<{ project_id: number; user_id: number }>(`SELECT project_id, user_id FROM project_members`),
  ]);

  const people = new Map<number, Person>();
  for (const r of peopleRes.rows) {
    people.set(r.id, {
      id: r.id,
      username: r.username,
      titleKey: r.title_key,
      titleName: r.title_name,
      titleQualified: !!r.title_qualified,
      departmentId: r.department_id,
      departmentName: r.department_name,
      reportsToId: r.reports_to_id,
    });
  }
  const departments = new Map<number, Department>(
    deptRes.rows.map((d) => [d.id, { id: d.id, managerId: d.manager_id, directorId: d.director_id }])
  );

  const projects = new Map<number, ProjectNode>(
    projectRes.rows.map((r) => [r.id, { id: r.id, departmentId: r.department_id, headId: r.project_head_id }])
  );
  const teams = new Map<number, TeamNode>(
    teamRes.rows.map((r) => [r.id, { id: r.id, projectId: r.project_id, leadId: r.team_lead_id }])
  );
  const teamOfMember = new Map<number, number>(teamMemberRes.rows.map((r) => [r.user_id, r.team_id]));
  const projectOfDirect = new Map<number, number>(projectMemberRes.rows.map((r) => [r.user_id, r.project_id]));
  const teamOfLead = new Map<number, number>();
  for (const t of teams.values()) if (t.leadId !== null) teamOfLead.set(t.leadId, t.id);
  const firstProjectOfHead = new Map<number, number>(); // lowest project id wins (a head's projects share one department)
  for (const pr of projects.values()) {
    if (pr.headId !== null && !firstProjectOfHead.has(pr.headId)) firstProjectOfHead.set(pr.headId, pr.id);
  }
  const projectManager = (projectId: number): number | null => {
    const pr = projects.get(projectId);
    return pr ? departments.get(pr.departmentId)?.managerId ?? null : null;
  };
  // Above a Team member / direct member: the Head, else the Department Manager.
  const projectBoss = (projectId: number): number | null =>
    projects.get(projectId)?.headId ?? projectManager(projectId);

  // "The" CEO: the (first) person titled CEO. More than one shouldn't happen —
  // the title can only be given to one person — but don't crash if it does.
  const ceoId = [...people.values()].find((p) => p.titleKey === "ceo")?.id ?? null;
  const managerOf = new Map<number, Department>(); // manager user id -> their department
  for (const d of departments.values()) if (d.managerId !== null) managerOf.set(d.managerId, d);

  const boss = new Map<number, number | null>();
  for (const p of people.values()) {
    let bossId: number | null = null;
    if (p.titleKey === "ceo") {
      bossId = null;
    } else if (p.titleKey === "chief_officer") {
      bossId = ceoId;
    } else if (p.titleKey === "director") {
      bossId = p.reportsToId;
    } else if (managerOf.has(p.id)) {
      bossId = managerOf.get(p.id)!.directorId;
    } else if (teamOfLead.has(p.id)) {
      bossId = projectBoss(teams.get(teamOfLead.get(p.id)!)!.projectId);
    } else if (firstProjectOfHead.has(p.id)) {
      bossId = projectManager(firstProjectOfHead.get(p.id)!);
    } else if (teamOfMember.has(p.id)) {
      const team = teams.get(teamOfMember.get(p.id)!)!;
      bossId = team.leadId ?? projectBoss(team.projectId);
    } else if (projectOfDirect.has(p.id)) {
      bossId = projectBoss(projectOfDirect.get(p.id)!);
    } else if (p.departmentId !== null) {
      bossId = departments.get(p.departmentId)?.managerId ?? null;
    }
    boss.set(p.id, bossId === p.id ? null : bossId);
  }
  return { people, boss };
}

export function getReportsTo(snapshot: OrgSnapshot, userId: number): number | null {
  return snapshot.boss.get(userId) ?? null;
}

// Everyone below `userId`, at any depth (the whole subtree of the reporting
// chain). The visited-set makes a corrupt loop harmless.
export function getSubordinateIds(snapshot: OrgSnapshot, userId: number): number[] {
  const children = new Map<number, number[]>();
  for (const [id, bossId] of snapshot.boss) {
    if (bossId === null) continue;
    const list = children.get(bossId) ?? [];
    list.push(id);
    children.set(bossId, list);
  }
  const result: number[] = [];
  const seen = new Set<number>([userId]);
  const stack = [...(children.get(userId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return result;
}

// The org chart: everyone placed in the reporting chain as a tree, plus the
// people who aren't placed in it yet (no Department / title, so nobody above
// them and nobody below them).
export function buildOrgChart(snapshot: OrgSnapshot): { roots: OrgChartNode[]; unplaced: OrgChartNode[] } {
  const nodes = new Map<number, OrgChartNode>();
  for (const p of snapshot.people.values()) {
    nodes.set(p.id, {
      id: p.id,
      username: p.username,
      label: formatJobTitle(
        p.titleName ? { name: p.titleName, qualified_by_department: p.titleQualified } : null,
        p.departmentName
      ),
      department: p.departmentName ?? "",
      children: [],
    });
  }
  const roots: OrgChartNode[] = [];
  const unplaced: OrgChartNode[] = [];
  for (const [id, node] of nodes) {
    const bossId = snapshot.boss.get(id) ?? null;
    const parent = bossId !== null ? nodes.get(bossId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // A root with nobody under it and no title isn't part of the structure.
  const placedRoots: OrgChartNode[] = [];
  for (const r of roots) {
    if (r.children.length === 0 && !r.label) unplaced.push(r);
    else placedRoots.push(r);
  }
  // Defensive: anyone unreachable from a root (a corrupt reporting loop) is
  // listed as unplaced rather than silently missing from the chart.
  const reachable = new Set<number>();
  const walk = (n: OrgChartNode) => {
    if (reachable.has(n.id)) return;
    reachable.add(n.id);
    n.children.forEach(walk);
  };
  [...placedRoots, ...unplaced].forEach(walk);
  for (const [id, node] of nodes) if (!reachable.has(id)) unplaced.push({ ...node, children: [] });
  return { roots: placedRoots, unplaced };
}
