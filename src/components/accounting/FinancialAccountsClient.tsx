"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import FinancialAccountFormModal from "@/components/accounting/FinancialAccountFormModal";
import type { FinancialAccountRow } from "@/lib/financialAccounts";
import { FINANCIAL_ACCOUNT_TYPE_LABELS } from "@/lib/accountingDisplay";
import { formatMoney } from "@/lib/procurementDisplay";
import { HudFrame } from "@/components/hud/HudFrame";
import { PaginationControls, usePagination } from "@/components/Pagination";

export default function FinancialAccountsClient({ accounts }: { accounts: FinancialAccountRow[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<FinancialAccountRow | null>(null);
  const [deleting, setDeleting] = useState<FinancialAccountRow | null>(null);
  const [working, setWorking] = useState(false);
  const { pageItems, page, setPage, totalPages } = usePagination(accounts);

  async function handleDelete() {
    if (!deleting) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/financial-accounts/${deleting.id}`, { method: "DELETE" });
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
            + Add Account
          </button>
        </span>
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No bank/cash accounts yet — transactions show as &quot;Unassigned&quot;.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pageItems.map((a) => (
            <HudFrame
              key={a.id}
              corners="tl-br"
              className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{a.name}</div>
                  <div className="text-xs text-black/50 dark:text-white/50">
                    {FINANCIAL_ACCOUNT_TYPE_LABELS[a.account_type]} · {a.currency}
                  </div>
                </div>
                <div className="shrink-0 flex gap-2">
                  <button onClick={() => setEditing(a)} className="text-xs text-accent hover:underline">
                    Edit
                  </button>
                  <button onClick={() => setDeleting(a)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                    Delete
                  </button>
                </div>
              </div>
              <div className={`text-lg font-semibold ${parseFloat(a.balance) < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                {formatMoney(a.balance, a.currency)}
              </div>
            </HudFrame>
          ))}
        </div>
      )}
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />

      {showCreate && (
        <FinancialAccountFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <FinancialAccountFormModal
          account={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete account"
          message={`Delete "${deleting.name}"? Transactions linked to it become unassigned, not deleted.`}
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
