import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel, listUsersBasic } from "@/lib/users";
import { listDepartments, listJobTitles } from "@/lib/org";
import { buildOrgChart, loadOrgSnapshot } from "@/lib/orgHierarchy";
import { listProjects, listTeams } from "@/lib/projects";
import OrganizationTabs from "@/components/organization/OrganizationTabs";

export default async function OrganizationPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminLevel(session.role)) redirect("/");

  const [departments, titles, users, snapshot, teams, projects] = await Promise.all([
    listDepartments(),
    listJobTitles(),
    listUsersBasic(),
    loadOrgSnapshot(),
    listTeams(),
    listProjects(),
  ]);
  const { roots, unplaced } = buildOrgChart(snapshot);

  return (
    <OrganizationTabs
      departments={departments}
      titles={titles}
      users={users}
      teams={teams}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      roots={roots}
      unplaced={unplaced}
    />
  );
}
