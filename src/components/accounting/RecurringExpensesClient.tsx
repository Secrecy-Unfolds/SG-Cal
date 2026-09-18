"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import RecurringExpenseFormModal from "@/components/accounting/RecurringExpenseFormModal";
import type { RecurringExpenseRow } from "@/lib/recurringExpenses";
import { RECURRING_EXPENSE_FREQUENCY_LABELS } from "@/lib/accountingDisplay";
import { formatMoney } from "@/lib/procurementDisplay";
import { HudFrame } from "@/components/hud/HudFrame";
import { PaginationControls, usePagination } from "@/components/Pagination";

export default function RecurringExpensesClient({ recurring }: { recurring: RecurringExpenseRow[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<RecurringExpenseRow | null>(null);
  const [deleting, setDeleting] = useState<RecurringExpenseRow | null>(null);
  const [working, setWorking] = useState(false);
  const { pageItems, page, setPage, totalPages } = usePagination(recurring);

  async function handleDelete() {
    if (!deleting) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/recurring-expenses/${deleting.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleting(null);
        router.refresh();
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <span className="btn-glow inline-block">
          <button onClick={() => setShowCreate(true)} className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium">
            + Add Recurring Expense
          </button>
        </span>
      </div>

      {recurring.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No recurring expenses yet.</p>
      ) : (
        <div className="space-y-2">
          {pageItems.map((r) => (
            <HudFrame
              key={r.id}
              corners="tl-br"
              className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-black/5 dark:bg-white/10">
                    {RECURRING_EXPENSE_FREQUENCY_LABELS[r.frequency]}
                  </span>
                  {!r.active && (
                    <span className="shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40">
                      Inactive
                    </span>
                  )}
                  <span className="min-w-0 truncate text-sm font-medium">{r.description || r.category || "—"}</span>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50 truncate">
                  {r.category ? `${r.category} · ` : ""}Next run {r.next_run_date}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-medium">{formatMoney(r.amount, r.currency)}</span>
                <button onClick={() => setEditing(r)} className="text-xs text-accent hover:underline">
                  Edit
                </button>
                <button onClick={() => setDeleting(r)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                  Delete
                </button>
              </div>
            </HudFrame>
          ))}
        </div>
      )}
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />

      {showCreate && (
        <RecurringExpenseFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <RecurringExpenseFormModal
          recurring={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete recurring expense"
          message={`Delete "${deleting.description || deleting.category || "this recurring expense"}"?`}
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
