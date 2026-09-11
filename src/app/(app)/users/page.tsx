import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel, listUsers } from "@/lib/users";
import UsersListClient from "@/components/UsersListClient";

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminLevel(session.role)) redirect("/");

  const users = await listUsers();

  return <UsersListClient users={users} actorRole={session.role} actorUid={session.uid} />;
}
