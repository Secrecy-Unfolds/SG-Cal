"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import AttendanceRecordModal from "@/components/hr/AttendanceRecordModal";
import type { AttendanceRecordRow } from "@/lib/hr";
import { formatMuscatDateTime } from "@/lib/time";
import { formatDateOnly } from "@/lib/procurementDisplay";
import { PaginationControls, usePagination } from "@/components/Pagination";

// Employees' attendance, with Admin-level add / edit / remove. A day with no
// record is an absence, so "Remove" is how someone is marked absent.
export default function AttendanceAdminClient({
  records,
  employees,
  readOnly = false,
}: {
  records: AttendanceRecordRow[];
  employees: { id: number; username: string }[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const { pageItems, page, setPage, totalPages } = usePagination(records);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecordRow | null>(null);
  const [removing, setRemoving] = useState<AttendanceRecordRow | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function afterChange() {
    setShowAdd(false);
    setEditing(null);
    router.refresh();
  }

  async function handleRemove() {
    if (!removing) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/hr/attendance/${removing.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to remove the record");
        return;
      }
      setRemoving(null);
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      {!readOnly && (
        <div className="flex justify-end mb-3">
          <span className="btn-glow inline-block">
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
            >
              + Add attendance
            </button>
          </span>
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {records.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No attendance recorded yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-black/40 dark:text-white/40 border-b border-black/5 dark:border-white/10">
                  <th className="py-2 pr-4 font-medium">Employee</th>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Check in</th>
                  <th className="py-2 pr-4 font-medium">Check out</th>
                  {!readOnly && <th className="py-2 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r) => (
                  <tr key={r.id} className="border-b border-black/5 dark:border-white/10 last:border-b-0">
                    <td className="py-2 pr-4">{r.username}</td>
                    <td className="py-2 pr-4 text-black/60 dark:text-white/60">
                      {formatDateOnly(r.work_date)}
                      {r.edited_by_username && (
                        <span
                          className="ml-2 text-[10px] rounded-full px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          title={r.edited_at ? `Edited ${formatMuscatDateTime(new Date(r.edited_at))}` : undefined}
                        >
                          edited by {r.edited_by_username}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-black/60 dark:text-white/60">
                      {formatMuscatDateTime(new Date(r.check_in_at))}
                    </td>
                    <td className="py-2 pr-4 text-black/60 dark:text-white/60">
                      {r.check_out_at ? formatMuscatDateTime(new Date(r.check_out_at)) : "—"}
                    </td>
                    {!readOnly && (
                      <td className="py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEditing(r)}
                          className="text-xs text-accent dark:text-blue-300 hover:underline mr-3"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoving(r)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {!readOnly && showAdd && <AttendanceRecordModal employees={employees} onClose={() => setShowAdd(false)} onSaved={afterChange} />}
      {editing && (
        <AttendanceRecordModal
          employees={employees}
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={afterChange}
        />
      )}
      {removing && (
        <ConfirmModal
          title="Remove attendance"
          message={`Remove ${removing.username}'s record for ${formatDateOnly(
            removing.work_date
          )}? That day will show as absent (no attendance recorded), and they'll be emailed.`}
          confirmLabel="Remove"
          loading={working}
          onConfirm={handleRemove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
