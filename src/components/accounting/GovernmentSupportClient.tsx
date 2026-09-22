"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import GovernmentSupporterFormModal from "@/components/accounting/GovernmentSupporterFormModal";
import GovernmentSupportFormModal from "@/components/accounting/GovernmentSupportFormModal";
import type { GovernmentSupportRow, GovernmentSupporterRow } from "@/lib/governmentSupport";
import { SUPPORTER_TYPE_LABELS } from "@/lib/governmentSupportDisplay";
import { formatMoney } from "@/lib/procurementDisplay";
import { HudFrame } from "@/components/hud/HudFrame";
import { PaginationControls, usePagination } from "@/components/Pagination";

export default function GovernmentSupportClient({
  supporters,
  records,
  isAdmin,
}: {
  supporters: GovernmentSupporterRow[];
  records: GovernmentSupportRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [showCreateSupporter, setShowCreateSupporter] = useState(false);
  const [editingSupporter, setEditingSupporter] = useState<GovernmentSupporterRow | null>(null);
  const [deletingSupporter, setDeletingSupporter] = useState<GovernmentSupporterRow | null>(null);
  const [recordingFor, setRecordingFor] = useState<GovernmentSupporterRow | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteSupporter() {
    if (!deletingSupporter) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/government-supporters/${deletingSupporter.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete supporter");
        return;
      }
      setDeletingSupporter(null);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteRecord() {
    if (deletingRecordId === null) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/government-support/${deletingRecordId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete record");
        return;
      }
      setDeletingRecordId(null);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  const { pageItems, page, setPage, totalPages } = usePagination(supporters);

  return (
    <div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      {isAdmin && (
        <div className="flex justify-end mb-4">
          <span className="btn-glow inline-block">
            <button onClick={() => setShowCreateSupporter(true)} className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium">
              + Add Supporter
            </button>
          </span>
        </div>
      )}

      {supporters.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No government/Royal supporters yet.</p>
      ) : (
        <div className="space-y-3">
          {pageItems.map((supporter) => {
            const supporterRecords = records.filter((r) => r.supporter_id === supporter.id);
            const totalByCurrency = new Map<string, number>();
            for (const r of supporterRecords) {
              totalByCurrency.set(r.currency, (totalByCurrency.get(r.currency) ?? 0) + parseFloat(r.amount));
            }
            return (
              <HudFrame
                key={supporter.id}
                corners="tl-br"
                className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{supporter.name}</div>
                    <div className="text-xs text-black/50 dark:text-white/50 truncate">
                      {SUPPORTER_TYPE_LABELS[supporter.supporter_type]}
                      {supporter.contact ? ` · ${supporter.contact}` : ""}
                    </div>
                    {totalByCurrency.size > 0 && (
                      <div className="text-xs text-black/50 dark:text-white/50 mt-1">
                        Total received:{" "}
                        {Array.from(totalByCurrency.entries())
                          .map(([currency, total]) => formatMoney(total, currency))
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="shrink-0 flex gap-2">
                      <span className="btn-glow inline-block">
                        <button
                          type="button"
                          onClick={() => setRecordingFor(supporter)}
                          className="text-xs btn-skew bg-accent text-ink px-3 py-1.5"
                        >
                          + Support
                        </button>
                      </span>
                      <span className="btn-glow inline-block">
                        <button
                          type="button"
                          onClick={() => setEditingSupporter(supporter)}
                          className="text-xs btn-skew border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5"
                        >
                          Edit
                        </button>
                      </span>
                      <span className="btn-glow-red inline-block">
                        <button
                          type="button"
                          onClick={() => setDeletingSupporter(supporter)}
                          className="text-xs btn-skew border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5"
                        >
                          Delete
                        </button>
                      </span>
                    </div>
                  )}
                </div>

                {supporterRecords.length === 0 ? (
                  <p className="text-xs text-black/40 dark:text-white/40">No support recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {supporterRecords.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-xl border border-black/5 dark:border-white/10 p-3 bg-black/[0.02] dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{formatMoney(r.amount, r.currency)}</div>
                          <div className="text-xs text-black/50 dark:text-white/50 truncate">
                            {r.date}
                            {r.expectations ? ` · ${r.expectations}` : " · No expectation of return"}
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeletingRecordId(r.id)}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline shrink-0"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </HudFrame>
            );
          })}
        </div>
      )}
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />

      {isAdmin && showCreateSupporter && (
        <GovernmentSupporterFormModal
          onClose={() => setShowCreateSupporter(false)}
          onSaved={() => {
            setShowCreateSupporter(false);
            router.refresh();
          }}
        />
      )}
      {isAdmin && editingSupporter && (
        <GovernmentSupporterFormModal
          supporter={editingSupporter}
          onClose={() => setEditingSupporter(null)}
          onSaved={() => {
            setEditingSupporter(null);
            router.refresh();
          }}
        />
      )}
      {isAdmin && recordingFor && (
        <GovernmentSupportFormModal
          supporter={recordingFor}
          onClose={() => setRecordingFor(null)}
          onSaved={() => {
            setRecordingFor(null);
            router.refresh();
          }}
        />
      )}
      {deletingSupporter && (
        <ConfirmModal
          title="Delete supporter"
          message={`Delete "${deletingSupporter.name}"? This also removes their support records (the capital ledger entries stay).`}
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDeleteSupporter}
          onCancel={() => setDeletingSupporter(null)}
        />
      )}
      {deletingRecordId !== null && (
        <ConfirmModal
          title="Delete support record"
          message="Delete this support record? The capital ledger entry it posted stays."
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDeleteRecord}
          onCancel={() => setDeletingRecordId(null)}
        />
      )}
    </div>
  );
}
