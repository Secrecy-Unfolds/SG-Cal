"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/hud/PageHeader";
import ProjectFormModal from "@/components/projects/ProjectFormModal";
import { PaginationControls, usePagination } from "@/components/Pagination";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_BADGE_CLASS,
  PROJECT_STATUS_LABELS,
  type ProjectRow,
  type ProjectStatus,
} from "@/lib/projectDisplay";
import type { DepartmentRow } from "@/lib/orgDisplay";
import { formatDateOnly, formatMoney } from "@/lib/procurementDisplay";

export default function ProjectsListClient({
  projects,
  departments,
  users,
}: {
  projects: ProjectRow[];
  departments: Pick<DepartmentRow, "id" | "name">[];
  users: { id: number; username: string }[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const filtered = useMemo(
    () => (statusFilter === "all" ? projects : projects.filter((p) => p.status === statusFilter)),
    [projects, statusFilter]
  );
  const { pageItems, page, setPage, totalPages } = usePagination(filtered);

  return (
    <div>
      <PageHeader label="ORGANIZATION" title="Projects">
        <span className="btn-glow inline-block">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
          >
            + New project
          </button>
        </span>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(["all", ...PROJECT_STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full text-xs font-medium px-3 py-1 border ${
              statusFilter === s
                ? "bg-accent text-ink border-accent"
                : "border-black/10 dark:border-white/10 text-black/50 dark:text-white/50 hover:bg-black/[0.03] dark:hover:bg-white/5"
            }`}
          >
            {s === "all" ? "All" : PROJECT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          {projects.length === 0 ? "No projects yet — create the first one." : "No projects with that status."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-black/40 dark:text-white/40 border-b border-black/5 dark:border-white/10">
                  <th className="py-2 pr-4 font-medium">Project</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Department</th>
                  <th className="py-2 pr-4 font-medium">Project Head</th>
                  <th className="py-2 pr-4 font-medium">Dates</th>
                  <th className="py-2 pr-4 font-medium">Budget</th>
                  <th className="py-2 font-medium">Teams / people</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr key={p.id} className="border-b border-black/5 dark:border-white/10 last:border-b-0 align-top">
                    <td className="py-2 pr-4">
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${PROJECT_STATUS_BADGE_CLASS[p.status]}`}
                      >
                        {PROJECT_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-black/60 dark:text-white/60">{p.department_name}</td>
                    <td className="py-2 pr-4 text-black/60 dark:text-white/60">{p.project_head_username ?? "—"}</td>
                    <td className="py-2 pr-4 text-black/60 dark:text-white/60 whitespace-nowrap">
                      {p.start_date ? formatDateOnly(p.start_date) : "—"}
                      {p.target_end_date ? ` → ${formatDateOnly(p.target_end_date)}` : ""}
                    </td>
                    <td className="py-2 pr-4 text-black/60 dark:text-white/60 whitespace-nowrap">
                      {p.budget ? formatMoney(p.budget, p.currency) : "—"}
                    </td>
                    <td className="py-2 text-black/60 dark:text-white/60">
                      {p.team_count} / {p.member_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {showCreate && (
        <ProjectFormModal
          departments={departments}
          users={users}
          onClose={() => setShowCreate(false)}
          onSaved={(id) => {
            setShowCreate(false);
            router.push(`/projects/${id}`);
          }}
        />
      )}
    </div>
  );
}
