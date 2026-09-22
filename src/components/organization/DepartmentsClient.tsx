"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import DepartmentFormModal from "@/components/organization/DepartmentFormModal";
import { PaginationControls, usePagination } from "@/components/Pagination";
import type { DepartmentRow } from "@/lib/orgDisplay";
import { MODULE_LABELS } from "@/lib/orgModulesDisplay";

export default function DepartmentsClient({
  departments,
  users,
}: {
  departments: DepartmentRow[];
  users: { id: number; username: string }[];
}) {
  const router = useRouter();
  const { pageItems, page, setPage, totalPages } = usePagination(departments);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [deleting, setDeleting] = useState<DepartmentRow | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function afterChange() {
    setShowCreate(false);
    setEditing(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleting) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/departments/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete");
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

  return (
    <div>
      <div className="flex justify-between items-center gap-3 mb-3">
        <p className="text-xs text-black/50 dark:text-white/50">
          Each department has one Manager and can have a Director (who may oversee several). Naming them sets their job
          title.
        </p>
        <span className="btn-glow inline-block shrink-0">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
          >
            + New department
          </button>
        </span>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {departments.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No departments yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-black/40 dark:text-white/40 border-b border-black/5 dark:border-white/10">
                  <th className="py-2 pr-4 font-medium">Department</th>
                  <th className="py-2 pr-4 font-medium">Manager</th>
                  <th className="py-2 pr-4 font-medium">Director</th>
                  <th className="py-2 pr-4 font-medium">People</th>
                  <th className="py-2 pr-4 font-medium">Modules visible to plain users</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((d) => (
                  <tr key={d.id} className="border-b border-black/5 dark:border-white/10 last:border-b-0 align-top">
                    <td className="py-2 pr-4">
                      <div className="font-medium">{d.name}</div>
                      {d.description && (
                        <div className="text-xs text-black/40 dark:text-white/40 line-clamp-2">{d.description}</div>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-black/60 dark:text-white/60">{d.manager_username ?? "—"}</td>
                    <td className="py-2 pr-4 text-black/60 dark:text-white/60">{d.director_username ?? "—"}</td>
                    <td className="py-2 pr-4 text-black/60 dark:text-white/60">{d.member_count}</td>
                    <td className="py-2 pr-4 text-black/60 dark:text-white/60">
                      {d.module_keys.length > 0 ? d.module_keys.map((k) => MODULE_LABELS[k]).join(", ") : "—"}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditing(d)}
                        className="text-xs text-accent dark:text-blue-300 hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(d)}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {showCreate && <DepartmentFormModal users={users} onClose={() => setShowCreate(false)} onSaved={afterChange} />}
      {editing && (
        <DepartmentFormModal department={editing} users={users} onClose={() => setEditing(null)} onSaved={afterChange} />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete department"
          message={`Delete ${deleting.name}? ${
            deleting.member_count > 0
              ? `${deleting.member_count} ${deleting.member_count === 1 ? "person" : "people"} will be left without a department. `
              : ""
          }${
            deleting.manager_username || deleting.director_username
              ? "Its Manager/Director will lose that job title (they keep their other details)."
              : ""
          }`}
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
