"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldCheck, User as UserIcon, UserPlus } from "lucide-react";
import AddUserForm from "@/components/AddUserForm";
import ConfirmModal from "@/components/ConfirmModal";
import EditUserDetailsModal from "@/components/EditUserDetailsModal";
import EmployeeDetailsModal from "@/components/hr/EmployeeDetailsModal";
import { HudFrame } from "@/components/hud/HudFrame";
import StatTile from "@/components/hud/StatTile";
import { formatMuscat } from "@/lib/time";
import type { UserRole, UserSummary } from "@/lib/users";
import type { EmployeeDetails } from "@/lib/hr";
import { formatDateOnly, formatMoney } from "@/lib/procurementDisplay";

// Mirrors lib/users.ts's canEditUserDetails — duplicated here for the same
// client-bundle reason as ROLE_LABELS below.
function canEditUserDetails(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === "super_admin") return targetRole !== "super_admin";
  if (actorRole === "admin") return targetRole === "user";
  return false;
}

// Mirrors lib/users.ts's ROLE_LABELS — duplicated here (not imported) since
// that module pulls in `pg` via lib/db.ts and this is a client component;
// same pattern already used in AppShell.tsx.
const ROLE_LABELS: Record<UserRole, string> = {
  user: "User",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  super_admin: "bg-violet-500/10 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300",
  admin: "bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300",
  user: "bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60",
};

// Admin and Super Admin are shown as one "Admin" card — the app already
// treats them as equivalent everywhere access is gated (isAdminLevel).
const STATS: { label: string; icon: typeof UserIcon; roles: UserRole[] }[] = [
  { label: "User", icon: UserIcon, roles: ["user"] },
  { label: "Admin", icon: ShieldCheck, roles: ["admin", "super_admin"] },
];

function Avatar({ user, size = 40 }: { user: Pick<UserSummary, "picture_url" | "name" | "username">; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {user.picture_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.picture_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <UserIcon size={size * 0.5} className="text-black/30 dark:text-white/30" />
      )}
    </div>
  );
}

function ViewUserModal({ user, onClose }: { user: UserSummary; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">User details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-4">
          <Avatar user={user} size={56} />
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">{user.name || user.username}</div>
            <span
              className={`inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${ROLE_BADGE_CLASS[user.role]}`}
            >
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-black/5 dark:border-white/10">
          {[
            ["Username", user.username],
            ["Email", user.email],
            ["Phone number", user.phone || "—"],
            ["Joined", formatMuscat(new Date(user.created_at), { day: "2-digit", month: "short", year: "numeric" })],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">{label}</div>
              <div className="text-sm">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateRoleModal({
  user,
  actorRole,
  onClose,
  onSaved,
}: {
  user: UserSummary;
  actorRole: "admin" | "super_admin";
  onClose: () => void;
  onSaved: () => void;
}) {
  const options: UserRole[] = actorRole === "super_admin" ? ["user", "admin"] : ["user"];
  const [role, setRole] = useState<UserRole>(options.includes(user.role) ? user.role : options[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to update role");
        return;
      }
      onSaved();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">Update role</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-black/60 dark:text-white/60">
          {user.name || user.username}&rsquo;s role is currently{" "}
          <span className="font-medium">{ROLE_LABELS[user.role]}</span>.
        </p>

        <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setRole(opt)}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                role === opt ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
              }`}
            >
              {ROLE_LABELS[opt]}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || role === user.role}
            className="bg-accent text-ink [clip-path:polygon(6%_0,100%_0,94%_100%,0_100%)] px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersListClient({
  users,
  employees,
  actorRole,
  actorUid,
}: {
  users: UserSummary[];
  employees: EmployeeDetails[];
  actorRole: "admin" | "super_admin";
  actorUid: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<UserSummary | null>(null);
  const [editingRole, setEditingRole] = useState<UserSummary | null>(null);
  const [editingDetails, setEditingDetails] = useState<UserSummary | null>(null);
  const [editingHr, setEditingHr] = useState<EmployeeDetails | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmingReset, setConfirmingReset] = useState<UserSummary | null>(null);

  const employeeByUserId = useMemo(() => new Map(employees.map((e) => [e.user_id, e])), [employees]);

  async function handleResetPassword(u: UserSummary) {
    setConfirmingReset(null);
    setActionMessage(null);
    setResettingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}/reset-password`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMessage({ type: "error", text: data.error ?? "Failed to reset password" });
        return;
      }
      setActionMessage({ type: "success", text: `New password sent to ${u.email}.` });
    } catch {
      setActionMessage({ type: "error", text: "Network error — check your connection and try again." });
    } finally {
      setResettingId(null);
    }
  }

  const statCounts = useMemo(
    () => STATS.map((stat) => users.filter((u) => stat.roles.includes(u.role)).length),
    [users]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const emp = employeeByUserId.get(u.id);
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (emp?.position ?? "").toLowerCase().includes(q) ||
        (emp?.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, employeeByUserId, query]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm text-black/50 dark:text-white/50">
          Admins and Super Admins can see this page. Admins can only add/promote User accounts; only the Super Admin
          can add Admins.
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="shrink-0 flex items-center gap-2 bg-accent text-ink [clip-path:polygon(6%_0,100%_0,94%_100%,0_100%)] px-4 py-2 text-sm font-medium"
        >
          <UserPlus size={16} />
          Add User
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {STATS.map((stat, i) => (
          <StatTile key={stat.label} icon={stat.icon} value={statCounts[i]} label={stat.label} />
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, username, or email"
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {actionMessage && (
        <p
          className={`text-sm mb-4 ${
            actionMessage.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {actionMessage.text}
        </p>
      )}

      <HudFrame corners="all" className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50 px-4 py-6 text-center">No users match your search.</p>
        ) : (
          filtered.map((u) => {
            const isSelf = u.id === actorUid;
            const canUpdateRole = !isSelf && u.role !== "super_admin";
            const canEditDetails = !isSelf && canEditUserDetails(actorRole, u.role);
            const canResetPassword = !isSelf && actorRole === "super_admin";
            const emp = employeeByUserId.get(u.id);
            return (
              <div
                key={u.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-black/5 dark:border-white/10 last:border-b-0"
              >
                <Avatar user={u} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{u.name || u.username}</div>
                  <div className="text-xs text-black/50 dark:text-white/50 truncate">
                    @{u.username} · {u.email}
                    {u.phone ? ` · ${u.phone}` : ""}
                  </div>
                  <div className="text-xs text-black/40 dark:text-white/40 truncate mt-0.5">
                    {emp && (emp.position || emp.department)
                      ? [emp.position, emp.department].filter(Boolean).join(" · ")
                      : "No position/department set"}
                    {emp?.salary ? ` · ${formatMoney(emp.salary, emp.salary_currency)}` : ""}
                    {emp?.join_date ? ` · Joined ${formatDateOnly(emp.join_date)}` : ""}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${ROLE_BADGE_CLASS[u.role]}`}
                >
                  {ROLE_LABELS[u.role]}
                </span>
                <div className="shrink-0 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setViewing(u)}
                    className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5"
                  >
                    View
                  </button>
                  {canEditDetails && (
                    <button
                      type="button"
                      onClick={() => setEditingDetails(u)}
                      className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5"
                    >
                      Edit details
                    </button>
                  )}
                  {emp && (
                    <button
                      type="button"
                      onClick={() => setEditingHr(emp)}
                      className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5"
                    >
                      Edit HR details
                    </button>
                  )}
                  {canUpdateRole && (
                    <button
                      type="button"
                      onClick={() => setEditingRole(u)}
                      className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5"
                    >
                      Update type
                    </button>
                  )}
                  {canResetPassword && (
                    <button
                      type="button"
                      onClick={() => setConfirmingReset(u)}
                      disabled={resettingId === u.id}
                      className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-50"
                    >
                      {resettingId === u.id ? "Resetting..." : "Reset password"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </HudFrame>

      {adding && <AddUserForm actorRole={actorRole} onClose={() => setAdding(false)} />}
      {viewing && <ViewUserModal user={viewing} onClose={() => setViewing(null)} />}
      {editingDetails && (
        <EditUserDetailsModal
          user={editingDetails}
          onClose={() => setEditingDetails(null)}
          onSaved={() => {
            setEditingDetails(null);
            router.refresh();
          }}
        />
      )}
      {editingRole && (
        <UpdateRoleModal
          user={editingRole}
          actorRole={actorRole}
          onClose={() => setEditingRole(null)}
          onSaved={() => {
            setEditingRole(null);
            router.refresh();
          }}
        />
      )}
      {editingHr && (
        <EmployeeDetailsModal
          employee={editingHr}
          onClose={() => setEditingHr(null)}
          onSaved={() => {
            setEditingHr(null);
            router.refresh();
          }}
        />
      )}
      {confirmingReset && (
        <ConfirmModal
          title="Reset password"
          message={`Reset ${confirmingReset.name || confirmingReset.username}'s password? A new temporary password will be emailed to ${confirmingReset.email}.`}
          confirmLabel="Reset password"
          loading={resettingId === confirmingReset.id}
          onConfirm={() => handleResetPassword(confirmingReset)}
          onCancel={() => setConfirmingReset(null)}
        />
      )}
    </div>
  );
}
