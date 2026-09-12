"use client";

import type { AttendanceRecordRow } from "@/lib/hr";
import { formatMuscatDateTime } from "@/lib/time";
import { formatDateOnly } from "@/lib/procurementDisplay";

export default function AttendanceAdminClient({ records }: { records: AttendanceRecordRow[] }) {
  if (records.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">No attendance recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs text-black/40 dark:text-white/40 border-b border-black/5 dark:border-white/10">
            <th className="py-2 pr-4 font-medium">Employee</th>
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Check in</th>
            <th className="py-2 pr-4 font-medium">Check out</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-black/5 dark:border-white/10 last:border-b-0">
              <td className="py-2 pr-4">{r.username}</td>
              <td className="py-2 pr-4 text-black/60 dark:text-white/60">{formatDateOnly(r.work_date)}</td>
              <td className="py-2 pr-4 text-black/60 dark:text-white/60">
                {formatMuscatDateTime(new Date(r.check_in_at))}
              </td>
              <td className="py-2 pr-4 text-black/60 dark:text-white/60">
                {r.check_out_at ? formatMuscatDateTime(new Date(r.check_out_at)) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
