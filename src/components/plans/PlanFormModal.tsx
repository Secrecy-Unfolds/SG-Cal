"use client";

import { useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import type { PlanRow } from "@/lib/plans";
import { PLAN_TYPES, PLAN_TYPE_LABELS, type PlanType } from "@/lib/planDisplay";
import { startBeforeFloorMessage, type StartFloor } from "@/lib/planTiming";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function PlanFormModal({
  plan,
  defaultPlanType = "process",
  startFloor = null,
  siblingStages,
  onClose,
  onSaved,
  onDeleted,
}: {
  plan?: PlanRow;
  defaultPlanType?: PlanType;
  // Editing a Stage only: the earliest date it may start on (its
  // Milestone's / Strategy's start), and its sibling Stages for the
  // prerequisite picker.
  startFloor?: StartFloor;
  siblingStages?: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEdit = !!plan;

  const [planType, setPlanType] = useState<PlanType>(plan?.plan_type ?? defaultPlanType);
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [startDate, setStartDate] = useState(plan?.start_date ?? "");
  const [prerequisiteStageId, setPrerequisiteStageId] = useState<number | null>(plan?.prerequisite_stage_id ?? null);
  const isStage = !!plan && plan.parent_milestone_id !== null;
  const selectableStages = (siblingStages ?? []).filter((s) => s.id !== plan?.id);
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
      setError(startBeforeFloorMessage("A stage", startFloor));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/plans/${plan!.id}` : "/api/plans", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planType,
          name: name.trim(),
          description,
          startDate: startDate || null,
          ...(isStage ? { prerequisiteStageId } : {}),
        }),
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

  async function handleDelete() {
    if (!plan) return;
    setConfirmingDelete(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/plans/${plan.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete");
        return;
      }
      onDeleted();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  const typeLabel = PLAN_TYPE_LABELS[planType];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">
            {isEdit ? `Edit ${typeLabel.toLowerCase()}` : `New ${typeLabel.toLowerCase()}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        {!isEdit && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Type</label>
            <div className="flex gap-2">
              {PLAN_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPlanType(t)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                    planType === t
                      ? "border-accent bg-accent/10 text-accent dark:text-blue-300"
                      : "border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
                  }`}
                >
                  {PLAN_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        )}

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

        {isStage && selectableStages.length > 0 && (
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
              {selectableStages.map((s) => (
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

        <div className="flex items-center justify-between pt-2">
          {isEdit ? (
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

      {confirmingDelete && plan && (
        <ConfirmModal
          title={`Delete ${typeLabel.toLowerCase()}`}
          message={`Delete "${plan.name}"? This also deletes its steps and their linked Calendar entries.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
