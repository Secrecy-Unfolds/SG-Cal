"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RequisitionFormModal from "@/components/procurement/RequisitionFormModal";
import type { PurchaseRequisitionRow } from "@/lib/purchaseRequisitions";
import { REQUISITION_STATUS_BADGE_CLASS, REQUISITION_STATUS_LABELS } from "@/lib/purchaseRequisitionsDisplay";
import { HudFrame } from "@/components/hud/HudFrame";
import { PaginationControls, usePagination } from "@/components/Pagination";

export default function RequisitionsListClient({
  requisitions,
  actorId,
  isAdmin,
}: {
  requisitions: PurchaseRequisitionRow[];
  actorId: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { pageItems, page, setPage, totalPages } = usePagination(requisitions);

  async function decide(id: number, status: "approved" | "rejected") {
    setWorkingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/procurement/requisitions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to decide requisition");
        return;
      }
      router.refresh();
    } finally {
      setWorkingId(null);
    }
  }

  async function withdraw(id: number) {
    setWorkingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/procurement/requisitions/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div>
      {isAdmin && (
        <div className="flex items-center justify-end mb-4">
          <span className="btn-glow inline-block">
            <button
              onClick={() => setShowCreate(true)}
              className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
            >
              + New Requisition
            </button>
          </span>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {requisitions.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No requisitions yet.</p>
      ) : (
        <div className="space-y-2">
          {pageItems.map((r) => (
            <HudFrame
              key={r.id}
              corners="tl-br"
              className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{r.product_name}</span>
                    <span
                      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${REQUISITION_STATUS_BADGE_CLASS[r.status]}`}
                    >
                      {REQUISITION_STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  <div className="text-xs text-black/50 dark:text-white/50 truncate">
                    {r.quantity_needed} {r.quantity_unit}
                    {r.requested_by_username ? ` · Requested by ${r.requested_by_username}` : ""}
                  </div>
                  {r.justification && (
                    <div className="text-xs text-black/40 dark:text-white/40 mt-1">{r.justification}</div>
                  )}
                  {r.status === "approved" && r.product_id && (
                    <Link href={`/procurement/${r.product_id}`} className="text-xs text-accent hover:underline">
                      View product →
                    </Link>
                  )}
                </div>
                <div className="shrink-0 flex gap-2">
                  {isAdmin && r.status === "pending" && (
                    <>
                      <span className="btn-glow inline-block">
                        <button
                          type="button"
                          disabled={workingId === r.id}
                          onClick={() => decide(r.id, "approved")}
                          className="text-xs btn-skew border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      </span>
                      <span className="btn-glow-red inline-block">
                        <button
                          type="button"
                          disabled={workingId === r.id}
                          onClick={() => decide(r.id, "rejected")}
                          className="text-xs btn-skew border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </span>
                      {r.requested_by === actorId && (
                        <button
                          type="button"
                          disabled={workingId === r.id}
                          onClick={() => withdraw(r.id)}
                          className="text-xs text-black/40 dark:text-white/40 hover:underline disabled:opacity-50"
                        >
                          Withdraw
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </HudFrame>
          ))}
        </div>
      )}
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />

      {isAdmin && showCreate && (
        <RequisitionFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
