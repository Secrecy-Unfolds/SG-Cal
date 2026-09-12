"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import { muscatInputToUTC, toMuscatDateInput, toMuscatTimeInput } from "@/lib/time";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TaskStatus,
  type CurrentUser,
} from "@/lib/eventDisplay";

export type EventType = "meeting" | "task";

export type EventAttendee = { id: number; username: string };

export type EventItem = {
  id: number;
  title: string;
  description: string;
  type: EventType;
  is_tentative: boolean;
  start_at: string;
  end_at: string | null;
  created_by: number | null;
  created_by_username: string | null;
  assignee_id: number | null;
  assignee_username: string | null;
  status: TaskStatus;
  attendees: EventAttendee[];
};

type AssignableUser = { id: number; username: string };

// Guards against a request hanging forever (e.g. a slow upstream) by
// aborting and surfacing a normal error instead of leaving the UI stuck
// showing "Saving..."/"Deleting..." indefinitely.
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export default function EventModal({
  defaultDate,
  defaultType = "meeting",
  currentUser,
  event,
  onClose,
  onSaved,
  onDeleted,
}: {
  defaultDate?: Date;
  defaultType?: EventType;
  currentUser: CurrentUser;
  event?: EventItem;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEdit = !!event;
  const initialStart = event ? new Date(event.start_at) : defaultDate ?? new Date();
  const initialEnd = event?.end_at ? new Date(event.end_at) : null;
  const canPickAnyAssignee = currentUser.role !== "user";
  // Anyone can invite attendees to a meeting they're creating; editing an
  // existing meeting's attendee list is limited to its creator or Admin-level
  // (mirrors canManageAttendees in src/lib/events.ts).
  const canManageAttendees =
    !isEdit || currentUser.role !== "user" || currentUser.uid === event?.created_by;

  const [type, setType] = useState<EventType>(event?.type ?? defaultType);
  const [isTentative, setIsTentative] = useState(event?.is_tentative ?? false);
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [date, setDate] = useState(toMuscatDateInput(initialStart));
  const [toDate, setToDate] = useState(
    event?.is_tentative && initialEnd ? toMuscatDateInput(initialEnd) : toMuscatDateInput(initialStart)
  );
  const [startTime, setStartTime] = useState(toMuscatTimeInput(initialStart));
  const [endTime, setEndTime] = useState(initialEnd ? toMuscatTimeInput(initialEnd) : "");
  const [assigneeId, setAssigneeId] = useState<number | null>(
    event ? event.assignee_id : canPickAnyAssignee ? null : currentUser.uid
  );
  const [status, setStatus] = useState<TaskStatus>(
    event?.status ?? (assigneeId === null ? "backlog" : "pending")
  );
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [allUsers, setAllUsers] = useState<AssignableUser[]>([]);
  // The creator is not an automatic attendee — they're invited like anyone
  // else, so this starts from exactly what the event already has (or empty
  // for a brand-new meeting).
  const [attendees, setAttendees] = useState<EventAttendee[]>(event?.attendees ?? []);
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTask = type === "task";

  useEffect(() => {
    if (!canPickAnyAssignee) return;
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setAssignableUsers(data.users ?? []))
      .catch(() => setAssignableUsers([]));
  }, [canPickAnyAssignee]);

  useEffect(() => {
    fetch("/api/users/basic")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setAllUsers(data.users ?? []))
      .catch(() => setAllUsers([]));
  }, []);

  const attendeeSuggestions = attendeeQuery.trim()
    ? allUsers
        .filter(
          (u) =>
            !attendees.some((a) => a.id === u.id) &&
            u.username.toLowerCase().includes(attendeeQuery.trim().toLowerCase())
        )
        .slice(0, 6)
    : [];

  function addAttendee(u: AssignableUser) {
    setAttendees((prev) => [...prev, u]);
    setAttendeeQuery("");
  }

  function removeAttendee(userId: number) {
    setAttendees((prev) => prev.filter((a) => a.id !== userId));
  }

  function selectType(next: EventType) {
    setType(next);
    if (next === "task") setIsTentative(false);
  }

  function toggleTentative(checked: boolean) {
    setIsTentative(checked);
    if (checked) setToDate(date);
  }

  function changeAssignee(next: number | null) {
    setAssigneeId(next);
    if (next === null) {
      setStatus("backlog");
    } else if (status === "backlog") {
      setStatus("pending");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (isTentative && !toDate) {
      setError("Pick an end date for the range");
      return;
    }
    if (isTentative && toDate < date) {
      setError("Range end must be on or after the start date");
      return;
    }
    if (!isTentative && isTask && !endTime) {
      setError("Tasks need a due time — it's used for the 3-hours-before reminder");
      return;
    }
    setSaving(true);
    try {
      const startAt = isTentative
        ? muscatInputToUTC(date, "00:00").toISOString()
        : muscatInputToUTC(date, startTime).toISOString();
      const endAt = isTentative
        ? muscatInputToUTC(toDate, "23:59").toISOString()
        : endTime
        ? muscatInputToUTC(date, endTime).toISOString()
        : null;

      const res = await fetchWithTimeout(isEdit ? `/api/events/${event!.id}` : "/api/events", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description,
          type,
          isTentative,
          startAt,
          endAt,
          assigneeId: isTask ? assigneeId : null,
          status: isTask ? status : "backlog",
          attendeeIds: !isTask ? attendees.map((a) => a.id) : [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save event");
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
    if (!event) return;
    setConfirmingDelete(false);
    setDeleting(true);
    try {
      const res = await fetchWithTimeout(`/api/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete event");
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
            onClick={() => selectType("meeting")}
            className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
              !isTask ? "bg-accent text-white" : "text-black/50 dark:text-white/50"
            }`}
          >
            Meeting
          </button>
          <button
            type="button"
            onClick={() => selectType("task")}
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

        {!isTask && (
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={isTentative}
              onChange={(e) => toggleTentative(e.target.checked)}
            />
            <span>
              Tentative — not sure of the exact time yet, pick a date range instead
            </span>
          </label>
        )}

        {isTentative ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">From date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm dark:[color-scheme:dark]"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">To date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm dark:[color-scheme:dark]"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                min={date}
                required
              />
            </div>
          </div>
        ) : (
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
        )}

        {isTentative && (
          <p className="text-xs text-black/40 dark:text-white/40 -mt-2">
            This will show up on every day in the range on the calendar, and in
            each of those days&rsquo; digest emails. No fixed time means no
            1-hour-before reminder for this one.
          </p>
        )}
        {!isTentative && isTask && (
          <p className="text-xs text-black/40 dark:text-white/40 -mt-2">
            You&rsquo;ll get a reminder email 3 hours before this due time.
          </p>
        )}
        {!isTentative && !isTask && (
          <p className="text-xs text-black/40 dark:text-white/40 -mt-2">
            You&rsquo;ll get a reminder email 1 hour before this meeting starts.
          </p>
        )}

        {!isTask && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Attendees</label>
            {canManageAttendees ? (
              <div className="space-y-2">
                {attendees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {attendees.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300 text-xs font-medium pl-2.5 pr-1.5 py-1"
                      >
                        {a.username}
                        <button
                          type="button"
                          onClick={() => removeAttendee(a.id)}
                          aria-label={`Remove ${a.username}`}
                          className="text-accent/60 hover:text-red-600 dark:text-blue-300/60 dark:hover:text-red-400"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input
                    className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    value={attendeeQuery}
                    onChange={(e) => setAttendeeQuery(e.target.value)}
                    placeholder="Search people to invite by name..."
                  />
                  {attendeeQuery.trim() && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-lg max-h-40 overflow-y-auto">
                      {attendeeSuggestions.length > 0 ? (
                        attendeeSuggestions.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => addAttendee(u)}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-black/[0.03] dark:hover:bg-white/5"
                          >
                            {u.username}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-black/40 dark:text-white/40">
                          No matching users
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-black/60 dark:text-white/60">
                {event && event.attendees.length > 0
                  ? event.attendees.map((a) => a.username).join(", ")
                  : "No attendees yet"}
                <span className="block text-xs text-black/40 dark:text-white/40 mt-1">
                  Only the creator or an Admin can change who&rsquo;s invited.
                </span>
              </p>
            )}
          </div>
        )}

        {isTask && (
          <div className="space-y-3 rounded-lg border border-black/10 dark:border-white/10 p-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Assigned to</label>
              {canPickAnyAssignee ? (
                <select
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm [color-scheme:light]"
                  value={assigneeId ?? ""}
                  onChange={(e) => changeAssignee(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Unassigned (Backlog)</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username}
                      {u.id === currentUser.uid ? " (you)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={assigneeId === currentUser.uid}
                    onChange={(e) => changeAssignee(e.target.checked ? currentUser.uid : null)}
                  />
                  Assign this task to me
                </label>
              )}
              {!canPickAnyAssignee && (
                <p className="text-xs text-black/40 dark:text-white/40">
                  You can only assign tasks to yourself — leave unchecked to drop it in the Backlog.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              {assigneeId === null ? (
                <div className="text-sm text-black/50 dark:text-white/50 px-1 py-1">
                  Backlog (assign it to set a status)
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {TASK_STATUSES.filter((s) => s !== "backlog").map((s) => {
                    const isClosed = s === "closed";
                    const disabled = isClosed && currentUser.role === "user";
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={disabled}
                        title={disabled ? "Only Admin level can close a task" : undefined}
                        onClick={() => setStatus(s)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          status === s
                            ? "bg-accent text-white border-accent"
                            : "border-black/10 dark:border-white/10 text-black/60 dark:text-white/60 hover:bg-black/[0.03] dark:hover:bg-white/5"
                        } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        {TASK_STATUS_LABELS[s]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
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

      {confirmingDelete && event && (
        <ConfirmModal
          title="Delete event"
          message={`Delete "${event.title}"?`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
