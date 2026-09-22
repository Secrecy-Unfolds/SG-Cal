"use client";

import { useState } from "react";
import CurrencySelect from "@/components/CurrencySelect";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type ProjectRow,
  type ProjectStatus,
} from "@/lib/projectDisplay";
import type { DepartmentRow } from "@/lib/orgDisplay";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";
const selectClass = `${inputClass} [color-scheme:light] dark:[color-scheme:dark]`;
const optionClass = "bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100";

export default function ProjectFormModal({
  project,
  departments,
  users,
  onClose,
  onSaved,
}: {
  project?: ProjectRow;
  departments: Pick<DepartmentRow, "id" | "name">[];
  users: { id: number; username: string }[];
  onClose: () => void;
  onSaved: (projectId: number) => void;
}) {
  const isEdit = !!project;
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "planning");
  const [departmentId, setDepartmentId] = useState<number | null>(project?.department_id ?? null);
  const [projectHeadId, setProjectHeadId] = useState<number | null>(project?.project_head_id ?? null);
  const [startDate, setStartDate] = useState(project?.start_date ?? "");
  const [targetEndDate, setTargetEndDate] = useState(project?.target_end_date ?? "");
  const [budget, setBudget] = useState(project?.budget ?? "");
  const [currency, setCurrency] = useState(project?.currency ?? "OMR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("A project name is required");
      return;
    }
    if (!departmentId) {
      setError("Choose the department this project belongs to");
      return;
    }
    if (!projectHeadId) {
      setError("Choose the Project Head");
      return;
    }
    if (startDate && targetEndDate && targetEndDate < startDate) {
      setError("The target end date can't be before the start date");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/projects/${project!.id}` : "/api/projects", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          status,
          departmentId,
          projectHeadId,
          startDate: startDate || null,
          targetEndDate: targetEndDate || null,
          budget: budget === "" ? null : Number(budget),
          currency,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      onSaved(data.project.id);
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
        className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">
            {isEdit ? "Edit project" : "New project"}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Department</label>
            <select
              className={selectClass}
              value={departmentId ?? ""}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
              required
            >
              <option className={optionClass} value="">
                Choose a department…
              </option>
              {departments.map((d) => (
                <option key={d.id} className={optionClass} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Status</label>
            <select
              className={selectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} className={optionClass} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Project Head</label>
          <select
            className={selectClass}
            value={projectHeadId ?? ""}
            onChange={(e) => setProjectHeadId(e.target.value ? Number(e.target.value) : null)}
            required
          >
            <option className={optionClass} value="">
              Choose the Project Head…
            </option>
            {users.map((u) => (
              <option key={u.id} className={optionClass} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
          <p className="text-xs text-black/40 dark:text-white/40">
            Sets their job title to Project Head. They report to the Manager of this department, and can head several
            projects as long as all are in the same department.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Start date</label>
            <input
              type="date"
              className={`${inputClass} dark:[color-scheme:dark]`}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Target end date</label>
            <input
              type="date"
              className={`${inputClass} dark:[color-scheme:dark]`}
              value={targetEndDate}
              min={startDate || undefined}
              onChange={(e) => setTargetEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Budget</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Currency</label>
            <CurrencySelect className={inputClass} value={currency} onChange={setCurrency} />
          </div>
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
