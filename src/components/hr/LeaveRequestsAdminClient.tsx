"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import type { LeaveRequestRow } from "@/lib/hr";
import { LEAVE_STATUS_BADGE_CLASS, LEAVE_STATUS_LABELS } from "@/lib/hrDisplay";
import { formatDateOnly } from "@/lib/procurementDisplay";
import { HudFrame } from "@/components/hud/HudFrame";

type PendingDecision = { request: LeaveRequestRow; status: "approved" | "rejected" };

export default function LeaveRequestsAdminClient({ requests }: { requests: LeaveRequestRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide() {
    if (!pending) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/hr/leave-requests/${pending.request.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: pending.status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save decision");
        return;
      }
      setPending(null);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {requests.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No leave requests yet.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <HudFrame
              key={r.id}
              corners="tl-br"
              className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="min-w-0 truncate text-sm font-medium">{r.username}</span>
                  <span
                    className={`shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${LEAVE_STATUS_BADGE_CLASS[r.status]}`}
                  >
                    {LEAVE_STATUS_LABELS[r.status]}
                  </span>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {formatDateOnly(r.start_date)}
                  {r.start_date !== r.end_date ? ` – ${formatDateOnly(r.end_date)}` : ""}
                </div>
                {r.reason && <div className="text-xs text-black/40 dark:text-white/40 mt-1">{r.reason}</div>}
                {r.status !== "pending" && r.decided_by_username && (
                  <div className="text-xs text-black/40 dark:text-white/40 mt-1">
                    Decided by {r.decided_by_username}
                  </div>
                )}
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2 shrink-0">
                  <span className="btn-glow inline-block">
                    <button
                      type="button"
                      onClick={() => setPending({ request: r, status: "approved" })}
                      className="btn-skew border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs text-green-700 dark:text-green-300 hover:bg-black/[0.03] dark:hover:bg-white/5"
                    >
                      Approve
                    </button>
                  </span>
                  <span className="btn-glow inline-block">
                    <button
                      type="button"
                      onClick={() => setPending({ request: r, status: "rejected" })}
                      className="btn-skew border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-black/[0.03] dark:hover:bg-white/5"
                    >
                      Reject
                    </button>
                  </span>
                </div>
              )}
            </HudFrame>
          ))}
        </div>
      )}

      {pending && (
        <ConfirmModal
          title={pending.status === "approved" ? "Approve leave request" : "Reject leave request"}
          message={`${pending.status === "approved" ? "Approve" : "Reject"} ${pending.request.username}'s request for ${formatDateOnly(
            pending.request.start_date
          )}${pending.request.start_date !== pending.request.end_date ? ` – ${formatDateOnly(pending.request.end_date)}` : ""}?`}
          confirmLabel={pending.status === "approved" ? "Approve" : "Reject"}
          danger={pending.status === "rejected"}
          loading={working}
          onConfirm={decide}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
