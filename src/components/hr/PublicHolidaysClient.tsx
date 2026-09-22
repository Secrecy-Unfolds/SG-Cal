"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import type { PublicHoliday } from "@/lib/hrDisplay";
import { formatDateOnly } from "@/lib/procurementDisplay";
import { PaginationControls, usePagination } from "@/components/Pagination";

const inputClass =
  "rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent dark:[color-scheme:dark]";

// Admin-maintained public holidays. They don't count as leave days (along
// with Fri/Sat). A multi-day holiday is entered once as a range.
export default function PublicHolidaysClient({
  holidays,
  readOnly = false,
}: {
  holidays: PublicHoliday[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<PublicHoliday | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { pageItems, page, setPage, totalPages } = usePagination(holidays);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !fromDate) {
      setError("A name and a date are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/hr/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), fromDate, toDate: toDate || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add holiday");
        return;
      }
      setName("");
      setFromDate("");
      setToDate("");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(h: PublicHoliday) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/hr/holidays/${h.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete");
        return;
      }
      setConfirmingDelete(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-black/50 dark:text-white/50">
        Public holidays don&rsquo;t count as leave days (nor do Fridays and Saturdays). For a holiday that lasts several
        days, set both dates.
      </p>

      {!readOnly && (
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Name</label>
          <input
            className={`${inputClass} w-56`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Eid Al Fitr"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">From</label>
          <input type="date" className={inputClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">To (optional)</label>
          <input
            type="date"
            className={inputClass}
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <span className="btn-glow inline-block">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Adding..." : "+ Add"}
          </button>
        </span>
      </form>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {holidays.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No public holidays added yet.</p>
      ) : (
        <div>
          <ul className="divide-y divide-black/5 dark:divide-white/10 border border-black/5 dark:border-white/10 rounded-xl bg-white dark:bg-neutral-900">
            {pageItems.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span>
                  <span className="text-black/60 dark:text-white/60">{formatDateOnly(h.holiday_date)}</span>
                  <span className="ml-3 font-medium">{h.name}</span>
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(h)}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      {confirmingDelete && (
        <ConfirmModal
          title="Remove holiday"
          message={`Remove ${confirmingDelete.name} on ${formatDateOnly(confirmingDelete.holiday_date)}? It will count as a normal working day for leave again.`}
          confirmLabel="Remove"
          loading={deleting}
          onConfirm={() => handleDelete(confirmingDelete)}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}
    </div>
  );
}
