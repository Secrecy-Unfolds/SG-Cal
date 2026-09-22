"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import PageHeader from "@/components/hud/PageHeader";
import ProjectFormModal from "@/components/projects/ProjectFormModal";
import TeamsManager, { AddMemberRow } from "@/components/projects/TeamsManager";
import {
  PROJECT_STATUS_BADGE_CLASS,
  PROJECT_STATUS_LABELS,
  type ProjectDetail,
} from "@/lib/projectDisplay";
import type { DepartmentRow } from "@/lib/orgDisplay";
import { formatDateOnly, formatMoney } from "@/lib/procurementDisplay";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

export default function ProjectDetailClient({
  project,
  departments,
  users,
}: {
  project: ProjectDetail;
  departments: Pick<DepartmentRow, "id" | "name">[];
  users: { id: number; username: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Failed to delete");
        setConfirmingDelete(false);
        return;
      }
      router.push("/projects");
    } catch {
      setError("Network error — check your connection and try again.");
      setConfirmingDelete(false);
    } finally {
      setWorking(false);
    }
  }

  async function addDirectMember(userId: number): Promise<string | null> {
    const res = await fetch(`/api/projects/${project.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) return (await res.json().catch(() => ({}))).error ?? "Failed to add";
    router.refresh();
    return null;
  }

  async function removeDirectMember(userId: number) {
    setError(null);
    const res = await fetch(`/api/projects/${project.id}/members/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to remove");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <Link href="/projects" className="text-xs text-accent dark:text-blue-300 hover:underline">
        ← Back to Projects
      </Link>
      <PageHeader label={`PROJECT · ${project.department_name.toUpperCase()}`} title={project.name}>
        <div className="flex gap-2">
          <span className="btn-glow inline-block">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Edit
            </button>
          </span>
          <span className="btn-glow-red inline-block">
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="btn-skew border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-4 py-2 text-sm font-medium"
            >
              Delete
            </button>
          </span>
        </div>
      </PageHeader>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      <div className="rounded-2xl border border-black/5 dark:border-white/10 p-4 mb-6 bg-white dark:bg-neutral-900">
        <span
          className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 mb-3 ${PROJECT_STATUS_BADGE_CLASS[project.status]}`}
        >
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Department" value={project.department_name} />
          <Field label="Project Head" value={project.project_head_username ?? ""} />
          <Field
            label="Budget"
            value={project.budget ? formatMoney(project.budget, project.currency) : ""}
          />
          <Field label="Start date" value={project.start_date ? formatDateOnly(project.start_date) : ""} />
          <Field
            label="Target end date"
            value={project.target_end_date ? formatDateOnly(project.target_end_date) : ""}
          />
          <Field label="People on the project" value={String(project.member_count)} />
        </div>
        {project.description && <p className="text-sm mt-4 whitespace-pre-wrap">{project.description}</p>}
      </div>

      <h2 className="font-heading font-semibold text-base uppercase tracking-wide mb-2">Teams</h2>
      <div className="mb-8">
        <TeamsManager
          teams={project.teams}
          projects={[{ id: project.id, name: project.name }]}
          users={users}
          fixedProjectId={project.id}
        />
      </div>

      <h2 className="font-heading font-semibold text-base uppercase tracking-wide mb-1">Directly on the project</h2>
      <p className="text-xs text-black/50 dark:text-white/50 mb-3">
        People on this project without a team report to the Project Head.
      </p>
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-neutral-900 p-4">
        {project.direct_members.length === 0 ? (
          <p className="text-xs text-black/40 dark:text-white/40">No one is directly on the project.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {project.direct_members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 rounded-full text-xs px-2.5 py-1 bg-black/5 dark:bg-white/10"
              >
                {m.username}
                <button
                  type="button"
                  onClick={() => removeDirectMember(m.id)}
                  aria-label={`Remove ${m.username}`}
                  className="text-black/40 dark:text-white/40 hover:text-red-600"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <AddMemberRow users={users} placeholder="Add a person…" onAdd={addDirectMember} />
      </div>

      {editing && (
        <ProjectFormModal
          project={project}
          departments={departments}
          users={users}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}
      {confirmingDelete && (
        <ConfirmModal
          title="Delete project"
          message={`Delete ${project.name}? Its ${project.teams.length} team${project.teams.length === 1 ? "" : "s"} and all memberships are removed, and the Project Head and Team Leads lose those job titles.`}
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
