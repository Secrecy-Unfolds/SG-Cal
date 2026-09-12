import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listIdeas } from "@/lib/ideas";
import IdeasListClient from "@/components/ideas/IdeasListClient";

export default async function IdeasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminLevel(session.role)) redirect("/");

  const ideas = await listIdeas();
  return <IdeasListClient ideas={ideas} />;
}
