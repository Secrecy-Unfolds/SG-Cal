"use client";

import { useState } from "react";
import { muscatInputToUTC, toMuscatDateInput, toMuscatTimeInput } from "@/lib/time";

export type EventType = "meeting" | "task";

export type EventItem = {
  id: number;
  title: string;
  description: string;
  type: EventType;
  start_at: string;
  end_at: string | null;
  created_by_username: string | null;
};

export default function EventModal({
  defaultDate,
  defaultType = "meeting",
  event,
  onClose,
  onSaved,
  onDeleted,
}: {
  defaultDate?: Date;
  defaultType?: EventType;
  event?: EventItem;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEdit = !!event;
  const initialStart = event ? new Date(event.start_at) : defaultDate ?? new Date();
  const initialEnd = event?.end_at ? new Date(event.end_at) : null;

  const [type, setType] = useState<EventType>(event?.type ?? defaultType);
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [date, setDate] = useState(toMuscatDateInput(initialStart));
  const [startTime, setStartTime] = useState(toMuscatTimeInput(initialStart));
  const [endTime, setEndTime] = useState(initialEnd ? toMuscatTimeInput(initialEnd) : "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTask = type === "task";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (isTask && !endTime) {
      setError("Tasks need a due time — it's used for the 3-hours-before reminder");
      return;
    }
    setSaving(true);
    try {
      const startAt = muscatInputToUTC(date, startTime).toISOString();
      const endAt = endTime ? muscatInputToUTC(date, endTime).toISOString() : null;

      const res = await fetch(isEdit ? `/api/events/${event!.id}` : "/api/events", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description, type, startAt, endAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save event");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    if (!confirm(`Delete "${event.title}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete event");
        return;
      }
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? `Edit ${isTask ? "task" : "meeting"}` : `New ${isTask ? "task" : "meeting"}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm">
          <button
            type="button"
            onClick={() => setType("meeting")}
            className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
              !isTask ? "bg-accent text-white" : "text-black/50 dark:text-white/50"
            }`}
          >
            Meeting
          </button>
          <button
            type="button"
            onClick={() => setType("task")}
            className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
              isTask ? "bg-accent text-white" : "text-black/50 dark:text-white/50"
            }`}
          >
            Task
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Title</label>
          <input
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1 col-span-1">
            <label className="text-sm font-medium">Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm dark:[color-scheme:dark]"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1 col-span-1">
            <label className="text-sm font-medium">Start</label>
            <input
              type="time"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm dark:[color-scheme:dark]"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1 col-span-1">
            <label className="text-sm font-medium">{isTask ? "Due" : "End (optional)"}</label>
            <input
              type="time"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm dark:[color-scheme:dark]"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required={isTask}
            />
          </div>
        </div>
        {isTask && (
          <p className="text-xs text-black/40 dark:text-white/40 -mt-2">
            You'll get a reminder email 3 hours before this due time.
          </p>
        )}
        {!isTask && (
          <p className="text-xs text-black/40 dark:text-white/40 -mt-2">
            You'll get a reminder email 1 hour before this meeting starts.
          </p>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium">Description / agenda</label>
          <textarea
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-accent"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details, agenda, links..."
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-600 dark:text-red-400 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
