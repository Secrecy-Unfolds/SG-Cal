import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel, listUsersBasic } from "@/lib/users";
import { listDepartments } from "@/lib/org";
import { getProjectDetail } from "@/lib/projects";
import ProjectDetailClient from "@/components/projects/ProjectDetailClient";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminLevel(session.role)) redirect("/");

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [project, departments, users] = await Promise.all([getProjectDetail(id), listDepartments(), listUsersBasic()]);
  if (!project) notFound();

  return <ProjectDetailClient project={project} departments={departments} users={users} />;
}
