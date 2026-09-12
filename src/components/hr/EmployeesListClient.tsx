"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EmployeeDetailsModal from "@/components/hr/EmployeeDetailsModal";
import type { EmployeeDetails } from "@/lib/hr";
import { formatDateOnly, formatMoney } from "@/lib/procurementDisplay";

export default function EmployeesListClient({ employees }: { employees: EmployeeDetails[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<EmployeeDetails | null>(null);

  return (
    <div>
      <div className="space-y-2">
        {employees.map((e) => (
          <div
            key={e.user_id}
            className="flex items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{e.name || e.username}</div>
              <div className="text-xs text-black/50 dark:text-white/50">
                {[e.position, e.department].filter(Boolean).join(" · ") || "No position/department set"}
              </div>
              <div className="text-xs text-black/40 dark:text-white/40 mt-0.5">
                Joined {formatDateOnly(e.join_date)} · Salary {formatMoney(e.salary, e.salary_currency)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditing(e)}
              className="shrink-0 rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <EmployeeDetailsModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
