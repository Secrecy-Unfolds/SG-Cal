"use client";

import { useState } from "react";
import { defaultStartDate, startBeforeFloorMessage, type StartFloor } from "@/lib/planTiming";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

// A Stage is a plan_type='process' row with parent_milestone_id set — same
// fields as a standalone Process (see db/schema.sql's comment on `plans`),
// just created through the milestone-scoped route instead of POST
// /api/plans, and with no type picker (a Stage's type is fixed).
export default function StageFormModal({
  milestoneId,
  startFloor = null,
  siblingStages,
  onClose,
  onSaved,
}: {
  milestoneId: number;
  // Earliest date this stage may start on — its Milestone's / Strategy's
  // start. New stages pre-fill with it (or today, if later).
  startFloor?: StartFloor;
  siblingStages: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate(startFloor));
  const [prerequisiteStageId, setPrerequisiteStageId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (startFloor && startDate && startDate < startFloor.date) {
      setError(startBeforeFloorMessage("A stage", startFloor));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/plans/milestones/${milestoneId}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, startDate: startDate || null, prerequisiteStageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save stage");
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
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">New stage</h2>
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
            className={`${inputClass} min-h-[80px]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Start date</label>
          <input
            type="date"
            className={`${inputClass} dark:[color-scheme:dark]`}
            value={startDate}
            min={startFloor?.date}
            onChange={(e) => setStartDate(e.target.value)}
          />
          {startFloor && (
            <p className="text-xs text-black/40 dark:text-white/40">
              Can&rsquo;t start before {startFloor.date} &mdash; the start of {startFloor.label}.
            </p>
          )}
        </div>

        {siblingStages.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Prerequisite stage (optional)</label>
            <select
              className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`}
              value={prerequisiteStageId ?? ""}
              onChange={(e) => setPrerequisiteStageId(e.target.value ? Number(e.target.value) : null)}
            >
              <option className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value="">
                None
              </option>
              {siblingStages.map((s) => (
                <option key={s.id} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-black/40 dark:text-white/40">
              Shows this stage after the prerequisite in the graph. Ordering only &mdash; it doesn&rsquo;t block marking steps done.
            </p>
          </div>
        )}

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
