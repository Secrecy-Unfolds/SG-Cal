import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel, listUsersBasic } from "@/lib/users";
import { listDepartments } from "@/lib/org";
import { listProjects } from "@/lib/projects";
import ProjectsListClient from "@/components/projects/ProjectsListClient";

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Admin-level only for now — Project Heads / members get their own view with
  // the visibility phase (docs/org-structure-plan.md, Phase 4).
  if (!isAdminLevel(session.role)) redirect("/");

  const [projects, departments, users] = await Promise.all([listProjects(), listDepartments(), listUsersBasic()]);
  return <ProjectsListClient projects={projects} departments={departments} users={users} />;
}
