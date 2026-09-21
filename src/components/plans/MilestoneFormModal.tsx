"use client";

import { useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import type { MilestoneRow } from "@/lib/planMilestones";
import { defaultStartDate, startBeforeFloorMessage, type StartFloor } from "@/lib/planTiming";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function MilestoneFormModal({
  strategyPlanId,
  otherMilestones,
  milestone,
  startFloor = null,
  onClose,
  onSaved,
  onDeleted,
}: {
  strategyPlanId: number;
  // Earliest date this milestone may start on — its Strategy's start. New
  // milestones pre-fill with it (or today, if later).
  startFloor?: StartFloor;
  otherMilestones: MilestoneRow[];
  milestone?: MilestoneRow;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const isEdit = !!milestone;
  const selectableMilestones = otherMilestones.filter((m) => m.id !== milestone?.id);

  const [name, setName] = useState(milestone?.name ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [startDate, setStartDate] = useState(isEdit ? milestone?.start_date ?? "" : defaultStartDate(startFloor));
  const [prerequisiteId, setPrerequisiteId] = useState<number | null>(milestone?.prerequisite_milestone_id ?? null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (startFloor && startDate && startDate < startFloor.date) {
      setError(startBeforeFloorMessage("A milestone", startFloor));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/plans/milestones/${milestone!.id}` : `/api/plans/${strategyPlanId}/milestones`, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          startDate: startDate || null,
          prerequisiteMilestoneId: prerequisiteId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save milestone");
        return;
      }
      onSaved();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!milestone || !onDeleted) return;
    setConfirmingDelete(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/plans/milestones/${milestone.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete milestone");
        return;
      }
      onDeleted();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setDeleting(false);
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
            {isEdit ? "Edit milestone" : "New milestone"}
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

        {selectableMilestones.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Prerequisite milestone (optional)</label>
            <select
              className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`}
              value={prerequisiteId ?? ""}
              onChange={(e) => setPrerequisiteId(e.target.value ? Number(e.target.value) : null)}
            >
              <option className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value="">
                None — no ordering constraint
              </option>
              {selectableMilestones.map((m) => (
                <option key={m.id} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-black/40 dark:text-white/40">
              If set, this milestone&rsquo;s stages can&rsquo;t be marked done until the prerequisite reaches 100%.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          {isEdit && onDeleted ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={deleting}
              className="text-sm text-red-600 dark:text-red-400 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
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
        </div>
      </form>

      {confirmingDelete && milestone && (
        <ConfirmModal
          title="Delete milestone"
          message={`Delete "${milestone.name}"? This also deletes its stages, their steps, and linked Calendar entries.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
