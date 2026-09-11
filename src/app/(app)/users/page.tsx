import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel, listUsers, ROLE_LABELS } from "@/lib/users";
import AddUserForm from "@/components/AddUserForm";
import { formatMuscat } from "@/lib/time";

const ROLE_BADGE_CLASS: Record<string, string> = {
  super_admin: "bg-violet-500/10 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300",
  admin: "bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300",
  user: "bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60",
};

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminLevel(session.role)) redirect("/");

  const users = await listUsers();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Manage Users</h1>
      <p className="text-sm text-black/50 dark:text-white/50 mb-6">
        Admins and Super Admins can see this page. Admins can only add User
        accounts; only the Super Admin can add Admins.
      </p>

      <div className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl overflow-hidden mb-6">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/5 dark:border-white/10 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{u.username}</div>
              <div className="text-xs text-black/50 dark:text-white/50 truncate">{u.email}</div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${ROLE_BADGE_CLASS[u.role]}`}
              >
                {ROLE_LABELS[u.role]}
              </span>
              <span className="text-[11px] text-black/40 dark:text-white/40">
                Joined {formatMuscat(new Date(u.created_at), { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        ))}
      </div>

      <AddUserForm actorRole={session.role} />
    </div>
  );
}
