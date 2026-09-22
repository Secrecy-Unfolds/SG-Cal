"use client";

import { useState } from "react";
import type { AttendanceRecordRow } from "@/lib/hr";
import { muscatInputToUTC, toMuscatDateInput, toMuscatTimeInput } from "@/lib/time";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent dark:[color-scheme:dark]";

// Admin adds a day's record for an employee (create) or corrects the times
// of an existing one (edit — the employee and date are fixed). Times are
// entered in Muscat time and sent as ISO instants.
export default function AttendanceRecordModal({
  employees,
  record,
  onClose,
  onSaved,
}: {
  employees: { id: number; username: string }[];
  record?: AttendanceRecordRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!record;
  const today = toMuscatDateInput(new Date());
  const [userId, setUserId] = useState<number | null>(record?.user_id ?? null);
  const [workDate, setWorkDate] = useState(record?.work_date ?? today);
  const [checkIn, setCheckIn] = useState(record ? toMuscatTimeInput(new Date(record.check_in_at)) : "");
  const [checkOut, setCheckOut] = useState(
    record?.check_out_at ? toMuscatTimeInput(new Date(record.check_out_at)) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEdit && !userId) {
      setError("Choose an employee");
      return;
    }
    if (!checkIn) {
      setError("A check-in time is required");
      return;
    }
    if (checkOut && checkOut <= checkIn) {
      setError("Check-out must be after check-in");
      return;
    }
    setSaving(true);
    try {
      const checkInAt = muscatInputToUTC(workDate, checkIn).toISOString();
      const checkOutAt = checkOut ? muscatInputToUTC(workDate, checkOut).toISOString() : null;
      const res = await fetch(isEdit ? `/api/hr/attendance/${record!.id}` : "/api/hr/attendance", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { checkInAt, checkOutAt } : { userId, workDate, checkInAt, checkOutAt }),
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
        className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">
            {isEdit ? "Edit attendance" : "Add attendance"}
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
          <label className="text-sm font-medium">Employee</label>
          {isEdit ? (
            <div className="text-sm">{record!.username}</div>
          ) : (
            <select
              className={`${inputClass} [color-scheme:light]`}
              value={userId ?? ""}
              onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : null)}
              autoFocus
            >
              <option className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value="">
                Choose an employee…
              </option>
              {employees.map((u) => (
                <option key={u.id} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Date</label>
          {isEdit ? (
            <div className="text-sm">{workDate}</div>
          ) : (
            <input
              type="date"
              className={inputClass}
              value={workDate}
              max={today}
              onChange={(e) => setWorkDate(e.target.value)}
              required
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Check in</label>
            <input type="time" className={inputClass} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Check out</label>
            <input type="time" className={inputClass} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-black/40 dark:text-white/40">
          Times are Muscat time. Leave check-out blank if they haven&rsquo;t checked out. To mark someone absent, remove
          their record for that day instead.
        </p>

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
