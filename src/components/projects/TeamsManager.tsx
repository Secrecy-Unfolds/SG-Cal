"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import type { TeamRow } from "@/lib/projectDisplay";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";
const selectClass = `${inputClass} [color-scheme:light] dark:[color-scheme:dark]`;
const optionClass = "bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100";

type User = { id: number; username: string };

function TeamFormModal({
  team,
  fixedProjectId,
  projects,
  users,
  onClose,
  onSaved,
}: {
  team?: TeamRow;
  fixedProjectId?: number;
  projects: { id: number; name: string }[];
  users: User[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!team;
  const [projectId, setProjectId] = useState<number | null>(team?.project_id ?? fixedProjectId ?? null);
  const [name, setName] = useState(team?.name ?? "");
  const [teamLeadId, setTeamLeadId] = useState<number | null>(team?.team_lead_id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEdit && !projectId) {
      setError("Choose the project this team belongs to");
      return;
    }
    if (!name.trim()) {
      setError("A team name is required");
      return;
    }
    if (!teamLeadId) {
      setError("Choose the Team Lead");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/teams/${team!.id}` : "/api/teams", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { name: name.trim(), teamLeadId } : { projectId, name: name.trim(), teamLeadId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
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
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">{isEdit ? "Edit team" : "New team"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        {!isEdit && !fixedProjectId && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Project</label>
            <select
              className={selectClass}
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
            >
              <option className={optionClass} value="">
                Choose a project…
              </option>
              {projects.map((p) => (
                <option key={p.id} className={optionClass} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Team Lead</label>
          <select
            className={selectClass}
            value={teamLeadId ?? ""}
            onChange={(e) => setTeamLeadId(e.target.value ? Number(e.target.value) : null)}
          >
            <option className={optionClass} value="">
              Choose the Team Lead…
            </option>
            {users.map((u) => (
              <option key={u.id} className={optionClass} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
          <p className="text-xs text-black/40 dark:text-white/40">
            Sets their job title to Team Lead. They report to the Project Head; the team&rsquo;s members report to them.
            A person leads at most one team.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <span className="btn-glow inline-block">
            <button
              type="button"
              onClick={onClose}
              className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Cancel
            </button>
          </span>
          <span className="btn-glow inline-block">
            <button
              type="submit"
              disabled={saving}
              className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}

function AddMemberRow({
  users,
  onAdd,
  placeholder,
}: {
  users: User[];
  onAdd: (userId: number) => Promise<string | null>;
  placeholder: string;
}) {
  const [userId, setUserId] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!userId) return;
    setWorking(true);
    setError(null);
    const err = await onAdd(Number(userId));
    if (err) setError(err);
    else setUserId("");
    setWorking(false);
  }

  return (
    <div>
      <div className="flex gap-2 mt-2">
        <select
          className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-xs [color-scheme:light] dark:[color-scheme:dark]"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option className={optionClass} value="">
            {placeholder}
          </option>
          {users.map((u) => (
            <option key={u.id} className={optionClass} value={u.id}>
              {u.username}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!userId || working}
          className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-40"
        >
          {working ? "Adding..." : "+ Add"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
}

// Teams of one Project (fixedProjectId) or of every Project (the Organization
// page's Teams tab). Admin-level: create/edit/delete a team, add/remove its
// members. The server enforces the rules (one team per person, one project per
// person, no double roles) and its messages are shown as-is.
export default function TeamsManager({
  teams,
  projects,
  users,
  fixedProjectId,
}: {
  teams: TeamRow[];
  projects: { id: number; name: string }[];
  users: User[];
  fixedProjectId?: number;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TeamRow | null>(null);
  const [deleting, setDeleting] = useState<TeamRow | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function afterChange() {
    setShowCreate(false);
    setEditing(null);
    router.refresh();
  }

  async function addMember(teamId: number, userId: number): Promise<string | null> {
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) return (await res.json().catch(() => ({}))).error ?? "Failed to add";
    router.refresh();
    return null;
  }

  async function removeMember(teamId: number, userId: number) {
    setError(null);
    const res = await fetch(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to remove");
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!deleting) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Failed to delete");
        return;
      }
      setDeleting(null);
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setWorking(false);
    }
  }

  const canCreate = fixedProjectId !== undefined || projects.length > 0;

  return (
    <div>
      <div className="flex justify-between items-center gap-3 mb-3">
        <p className="text-xs text-black/50 dark:text-white/50">
          A team belongs to one project and has one Team Lead. A person is in one team, and on one project, at a time.
        </p>
        {canCreate && (
          <span className="btn-glow inline-block shrink-0">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
            >
              + New team
            </button>
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {teams.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          {canCreate ? "No teams yet." : "No teams yet — create a project first."}
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {teams.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-neutral-900 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{t.name}</div>
                  {!fixedProjectId && (
                    <div className="text-xs text-black/40 dark:text-white/40 truncate">{t.project_name}</div>
                  )}
                  <div className="text-xs text-black/60 dark:text-white/60 mt-1">
                    Lead: <span className="font-medium">{t.team_lead_username ?? "— none —"}</span>
                  </div>
                </div>
                <div className="shrink-0 flex gap-3">
                  <button type="button" onClick={() => setEditing(t)} className="text-xs text-accent dark:text-blue-300 hover:underline">
                    Edit
                  </button>
                  <button type="button" onClick={() => setDeleting(t)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-3">
                {t.members.length === 0 ? (
                  <p className="text-xs text-black/40 dark:text-white/40">No members yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {t.members.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 rounded-full text-xs px-2.5 py-1 bg-black/5 dark:bg-white/10"
                      >
                        {m.username}
                        <button
                          type="button"
                          onClick={() => removeMember(t.id, m.id)}
                          aria-label={`Remove ${m.username}`}
                          className="text-black/40 dark:text-white/40 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <AddMemberRow users={users} placeholder="Add a member…" onAdd={(uid) => addMember(t.id, uid)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <TeamFormModal
          fixedProjectId={fixedProjectId}
          projects={projects}
          users={users}
          onClose={() => setShowCreate(false)}
          onSaved={afterChange}
        />
      )}
      {editing && (
        <TeamFormModal
          team={editing}
          projects={projects}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={afterChange}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete team"
          message={`Delete the ${deleting.name} team? ${
            deleting.members.length > 0
              ? `Its ${deleting.members.length} member${deleting.members.length === 1 ? " is" : "s are"} removed from the team and from the project (add them back if needed). `
              : ""
          }The Team Lead loses that job title.`}
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

export { AddMemberRow };
