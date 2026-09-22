"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import { isStructureControlled, type JobTitleRow } from "@/lib/orgDisplay";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

function TitleFormModal({
  title,
  onClose,
  onSaved,
}: {
  title?: JobTitleRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!title;
  const [name, setName] = useState(title?.name ?? "");
  const [level, setLevel] = useState(String(title?.level ?? 8));
  const [qualified, setQualified] = useState(title?.qualified_by_department ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("A title name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/org/job-titles/${title!.id}` : "/api/org/job-titles", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), level: Number(level), qualifiedByDepartment: qualified }),
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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">
            {isEdit ? "Edit job title" : "New job title"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Level</label>
          <input
            type="number"
            min={1}
            max={99}
            className={inputClass}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            required
          />
          <p className="text-xs text-black/40 dark:text-white/40">1 is the top of the hierarchy; higher is further down.</p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={qualified} onChange={(e) => setQualified(e.target.checked)} />
          Show with the department, e.g. &ldquo;HR {name.trim() || "Officer"}&rdquo;
        </label>

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

export default function JobTitlesClient({ titles }: { titles: JobTitleRow[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<JobTitleRow | null>(null);
  const [deleting, setDeleting] = useState<JobTitleRow | null>(null);
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
      const res = await fetch(`/api/org/job-titles/${deleting.id}`, { method: "DELETE" });
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
          The hierarchy, top to bottom. Manager, Director, Project Head and Team Lead are assigned through the structure
          itself; CEO and Chief Officer are picked on the employee.
        </p>
        <span className="btn-glow inline-block shrink-0">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
          >
            + New title
          </button>
        </span>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-black/40 dark:text-white/40 border-b border-black/5 dark:border-white/10">
              <th className="py-2 pr-4 font-medium">Level</th>
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">With department</th>
              <th className="py-2 pr-4 font-medium">People</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {titles.map((t) => (
              <tr key={t.id} className="border-b border-black/5 dark:border-white/10 last:border-b-0">
                <td className="py-2 pr-4 text-black/60 dark:text-white/60">{t.level}</td>
                <td className="py-2 pr-4">
                  <span className="font-medium">{t.name}</span>
                  {t.structural_key && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50">
                      {isStructureControlled(t.structural_key) ? "set by structure" : "core"}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-black/60 dark:text-white/60">{t.qualified_by_department ? "Yes" : "—"}</td>
                <td className="py-2 pr-4 text-black/60 dark:text-white/60">{t.member_count}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setEditing(t)}
                    className="text-xs text-accent dark:text-blue-300 hover:underline mr-3"
                  >
                    Edit
                  </button>
                  {!t.structural_key && (
                    <button
                      type="button"
                      onClick={() => setDeleting(t)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <TitleFormModal onClose={() => setShowCreate(false)} onSaved={afterChange} />}
      {editing && <TitleFormModal title={editing} onClose={() => setEditing(null)} onSaved={afterChange} />}
      {deleting && (
        <ConfirmModal
          title="Delete job title"
          message={`Delete "${deleting.name}"? ${
            deleting.member_count > 0
              ? `${deleting.member_count} ${deleting.member_count === 1 ? "person" : "people"} holding it will be left with no title.`
              : "No one holds it."
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
