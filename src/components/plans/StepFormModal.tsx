"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import { muscatInputToUTC, toMuscatDateInput, toMuscatTimeInput } from "@/lib/time";
import type { StepRow } from "@/lib/planSteps";
import type { EventType } from "@/lib/events";
import type { DeliverableKind } from "@/lib/planDeliverablesDisplay";
import { defaultStartDate, startBeforeFloorMessage, type StartFloor } from "@/lib/planTiming";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

type BasicUser = { id: number; username: string };
type StepOption = { id: number; title: string };

export default function StepFormModal({
  planId,
  otherSteps,
  startFloor = null,
  step,
  onClose,
  onSaved,
  onDeleted,
}: {
  planId: number;
  otherSteps: StepOption[];
  // Earliest date this step may start on — the latest start among its
  // plan/Stage/Milestone/Strategy (see lib/planTiming.ts). New steps
  // pre-fill with it (or today, if later); earlier dates can't be picked.
  startFloor?: StartFloor;
  step?: StepRow;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEdit = !!step;
  const initialStart = step ? new Date(step.start_at) : new Date();
  const initialEnd = step?.end_at ? new Date(step.end_at) : null;

  const [stepType, setStepType] = useState<EventType>(step?.step_type ?? "task");
  const [title, setTitle] = useState(step?.title ?? "");
  const [notes, setNotes] = useState(step?.notes ?? "");
  const [date, setDate] = useState(step ? toMuscatDateInput(initialStart) : defaultStartDate(startFloor));
  const [startTime, setStartTime] = useState(toMuscatTimeInput(initialStart));
  const [endTime, setEndTime] = useState(initialEnd ? toMuscatTimeInput(initialEnd) : "");
  const [assigneeId, setAssigneeId] = useState<number | null>(step?.assignee_id ?? null);
  // A Meeting step has attendees instead of an assignee.
  const [attendeeIds, setAttendeeIds] = useState<number[]>(step?.attendees.map((a) => a.id) ?? []);
  const [prerequisiteIds, setPrerequisiteIds] = useState<number[]>(step?.prerequisite_step_ids ?? []);
  const [requiresDeliverable, setRequiresDeliverable] = useState(step?.requires_deliverable ?? false);
  const [newDefs, setNewDefs] = useState<{ kind: DeliverableKind; label: string }[]>([]);
  const [defKind, setDefKind] = useState<DeliverableKind>("text");
  const [defLabel, setDefLabel] = useState("");
  const [allUsers, setAllUsers] = useState<BasicUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTask = stepType === "task";
  const selectableSteps = otherSteps.filter((s) => s.id !== step?.id);

  useEffect(() => {
    fetch("/api/users/basic")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setAllUsers(data.users ?? []))
      .catch(() => setAllUsers([]));
  }, []);

  function addAttendee(id: number) {
    setAttendeeIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function removeAttendee(id: number) {
    setAttendeeIds((prev) => prev.filter((a) => a !== id));
  }

  function togglePrerequisite(id: number) {
    setPrerequisiteIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function addDef() {
    if (!defLabel.trim()) return;
    setNewDefs((prev) => [...prev, { kind: defKind, label: defLabel.trim() }]);
    setDefLabel("");
  }

  function removeDef(index: number) {
    setNewDefs((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (isTask && !endTime) {
      setError("Tasks need a due time");
      return;
    }
    if (isTask && assigneeId === null) {
      setError("Choose who this task is assigned to");
      return;
    }
    if (!isTask && attendeeIds.length === 0) {
      setError("Add at least one attendee");
      return;
    }
    if (startFloor && date < startFloor.date) {
      setError(startBeforeFloorMessage("A step", startFloor));
      return;
    }
    setSaving(true);
    try {
      const startAt = muscatInputToUTC(date, startTime).toISOString();
      const endAt = endTime ? muscatInputToUTC(date, endTime).toISOString() : null;

      const res = await fetch(isEdit ? `/api/plans/steps/${step!.id}` : "/api/plans/steps", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          stepType,
          title: title.trim(),
          notes,
          startAt,
          endAt,
          assigneeId: isTask ? assigneeId : null,
          attendeeIds: isTask ? [] : attendeeIds,
          requiresDeliverable,
          prerequisiteStepIds: prerequisiteIds,
          ...(isEdit ? { newDeliverableDefs: newDefs } : { deliverableDefs: newDefs }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save step");
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
    if (!step) return;
    setConfirmingDelete(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/plans/steps/${step.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete step");
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
          <h2 className="text-lg font-heading font-semibold uppercase tracking-wide">
            {isEdit ? "Edit step" : "New step"}
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
          <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm">
            <span className="btn-glow flex-1">
              <button
                type="button"
                onClick={() => setStepType("task")}
                className={`w-full btn-skew py-1.5 font-medium transition-colors ${
                  isTask ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
                }`}
              >
                Task
              </button>
            </span>
            <span className="btn-glow flex-1">
              <button
                type="button"
                onClick={() => setStepType("meeting")}
                className={`w-full btn-skew py-1.5 font-medium transition-colors ${
                  !isTask ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
                }`}
              >
                Meeting
              </button>
            </span>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium">Title</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Notes</label>
          <textarea className={`${inputClass} min-h-[70px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1 col-span-1">
            <label className="text-sm font-medium">Date</label>
            <input
              type="date"
              className={`${inputClass} dark:[color-scheme:dark]`}
              value={date}
              min={startFloor?.date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1 col-span-1">
            <label className="text-sm font-medium">Start</label>
            <input
              type="time"
              className={`${inputClass} dark:[color-scheme:dark]`}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1 col-span-1">
            <label className="text-sm font-medium">{isTask ? "Due" : "End (optional)"}</label>
            <input
              type="time"
              className={`${inputClass} dark:[color-scheme:dark]`}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required={isTask}
            />
          </div>
        </div>

        {startFloor && (
          <p className="text-xs text-black/40 dark:text-white/40 -mt-2">
            Can&rsquo;t start before {startFloor.date} &mdash; the start of {startFloor.label}.
          </p>
        )}

        {isTask ? (
        <div className="space-y-1">
          <label className="text-sm font-medium">Assigned to</label>
          <select
            required
            className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`}
            value={assigneeId ?? ""}
            onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
          >
            <option className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value="">
              Choose who&rsquo;s responsible…
            </option>
            {allUsers.map((u) => (
              <option key={u.id} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
        </div>
        ) : (
          <div className="space-y-1">
            <label className="text-sm font-medium">Attendees</label>
            {attendeeIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attendeeIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full text-xs font-medium px-2.5 py-1 border bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300 border-accent/30"
                  >
                    {allUsers.find((u) => u.id === id)?.username ?? step?.attendees.find((a) => a.id === id)?.username ?? `#${id}`}
                    <button type="button" onClick={() => removeAttendee(id)} aria-label="Remove attendee" className="hover:text-red-600">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            <select
              className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`}
              value=""
              onChange={(e) => e.target.value && addAttendee(Number(e.target.value))}
            >
              <option className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value="">
                {attendeeIds.length === 0 ? "Add an attendee…" : "Add another attendee…"}
              </option>
              {allUsers
                .filter((u) => !attendeeIds.includes(u.id))
                .map((u) => (
                  <option key={u.id} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value={u.id}>
                    {u.username}
                  </option>
                ))}
            </select>
          </div>
        )}

        {selectableSteps.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Prerequisites</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto border border-black/10 dark:border-white/10 rounded-lg p-2">
              {selectableSteps.map((s) => {
                const selected = prerequisiteIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => togglePrerequisite(s.id)}
                    className={`rounded-full text-xs font-medium px-2.5 py-1 border ${
                      selected
                        ? "bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300 border-accent/30"
                        : "border-black/10 dark:border-white/10 text-black/50 dark:text-white/50 hover:bg-black/[0.03] dark:hover:bg-white/5"
                    }`}
                  >
                    {s.title}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-black/40 dark:text-white/40">
              This step can only be marked done once every selected prerequisite is Done, Skipped, or N/A.
            </p>
          </div>
        )}

        <div className="space-y-2 rounded-lg border border-black/10 dark:border-white/10 p-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={requiresDeliverable}
              onChange={(e) => setRequiresDeliverable(e.target.checked)}
            />
            Requires a deliverable to mark Done
          </label>
          <p className="text-xs text-black/40 dark:text-white/40">
            {isTask
              ? "A text answer, image, or PDF known only after this step happens."
              : "Filling in Minutes of Meeting satisfies this — a text/image/PDF deliverable here is optional and additional."}
          </p>

          {isEdit && step && step.deliverable_defs.length > 0 && (
            <ul className="text-xs text-black/50 dark:text-white/50 space-y-0.5">
              {step.deliverable_defs.map((d) => (
                <li key={d.id}>
                  • {d.label} <span className="text-black/30 dark:text-white/30">({d.kind})</span>
                </li>
              ))}
            </ul>
          )}
          {newDefs.length > 0 && (
            <ul className="text-xs space-y-0.5">
              {newDefs.map((d, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span>
                    • {d.label} <span className="text-black/30 dark:text-white/30">({d.kind})</span>
                  </span>
                  <button type="button" onClick={() => removeDef(i)} className="text-red-600 dark:text-red-400 text-xs">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-1.5">
            <select
              className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-xs [color-scheme:light] dark:[color-scheme:dark]"
              value={defKind}
              onChange={(e) => setDefKind(e.target.value as DeliverableKind)}
            >
              <option className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value="text">
                Text
              </option>
              <option className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value="image">
                Image
              </option>
              <option className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value="pdf">
                PDF
              </option>
            </select>
            <input
              className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Placeholder label, e.g. 'Signed contract'"
              value={defLabel}
              onChange={(e) => setDefLabel(e.target.value)}
            />
            <button
              type="button"
              onClick={addDef}
              className="rounded-lg border border-black/10 dark:border-white/10 px-2.5 py-1.5 text-xs hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              + Add
            </button>
          </div>
        </div>

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

      {confirmingDelete && step && (
        <ConfirmModal
          title="Delete step"
          message={`Delete "${step.title}"? This also deletes its linked Calendar entry.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
