"use client";

import { useState } from "react";
import type { DepartmentRow } from "@/lib/orgDisplay";
import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "@/lib/orgModulesDisplay";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";
const selectClass = `${inputClass} [color-scheme:light] dark:[color-scheme:dark]`;
const optionClass = "bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100";

export default function DepartmentFormModal({
  department,
  users,
  onClose,
  onSaved,
}: {
  department?: DepartmentRow;
  users: { id: number; username: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!department;
  const [name, setName] = useState(department?.name ?? "");
  const [description, setDescription] = useState(department?.description ?? "");
  const [managerId, setManagerId] = useState<number | null>(department?.manager_id ?? null);
  const [directorId, setDirectorId] = useState<number | null>(department?.director_id ?? null);
  const [moduleKeys, setModuleKeys] = useState<ModuleKey[]>(department?.module_keys ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("A department name is required");
      return;
    }
    if (managerId !== null && managerId === directorId) {
      setError("The Manager and the Director must be different people");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/org/departments/${department!.id}` : "/api/org/departments", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, managerId, directorId, moduleKeys }),
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
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">
            {isEdit ? "Edit department" : "New department"}
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
          <label className="text-sm font-medium">Description</label>
          <textarea
            className={`${inputClass} min-h-[70px]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Manager</label>
          <select
            className={selectClass}
            value={managerId ?? ""}
            onChange={(e) => setManagerId(e.target.value ? Number(e.target.value) : null)}
          >
            <option className={optionClass} value="">
              No manager yet
            </option>
            {users.map((u) => (
              <option key={u.id} className={optionClass} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
          <p className="text-xs text-black/40 dark:text-white/40">
            Sets their job title to Manager and places them in this department. One person manages at most one
            department.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Director</label>
          <select
            className={selectClass}
            value={directorId ?? ""}
            onChange={(e) => setDirectorId(e.target.value ? Number(e.target.value) : null)}
          >
            <option className={optionClass} value="">
              No director yet
            </option>
            {users.map((u) => (
              <option key={u.id} className={optionClass} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
          <p className="text-xs text-black/40 dark:text-white/40">
            Sets their job title to Director. A Director can oversee several departments; the Manager reports to them.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Modules this department&rsquo;s plain users can view</label>
          <div className="flex flex-wrap gap-3">
            {MODULE_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={moduleKeys.includes(key)}
                  onChange={(e) =>
                    setModuleKeys((prev) => (e.target.checked ? [...prev, key] : prev.filter((k) => k !== key)))
                  }
                />
                {MODULE_LABELS[key]}
              </label>
            ))}
          </div>
          <p className="text-xs text-black/40 dark:text-white/40">
            A plain (non-Admin-level) person in this department can VIEW these modules — every create/edit/delete
            still needs Admin-level. Leave all unchecked and they only keep Calendar, Profile, Dashboard and any
            plans shared with them.
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
