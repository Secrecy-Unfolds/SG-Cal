"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import TransactionFormModal from "@/components/accounting/TransactionFormModal";
import type { AccountingTransactionRow } from "@/lib/accounting";
import { formatMoney } from "@/lib/procurementDisplay";
import { HudFrame } from "@/components/hud/HudFrame";

export default function TransactionsListClient({ transactions }: { transactions: AccountingTransactionRow[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [working, setWorking] = useState(false);

  // Totals are kept per-currency rather than summed naively — currency here
  // is free text (same convention as Procurement Planning), so mixing
  // amounts across different currencies into one number would be misleading.
  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const t of transactions) {
      const entry = map.get(t.currency) ?? { income: 0, expense: 0 };
      entry[t.type] += parseFloat(t.amount);
      map.set(t.currency, entry);
    }
    return Array.from(map.entries());
  }, [transactions]);

  async function handleDelete() {
    if (deletingId === null) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/accounting/transactions/${deletingId}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingId(null);
        router.refresh();
      }
    } finally {
      setWorking(false);
    }
  }

  const deletingTransaction = transactions.find((t) => t.id === deletingId) ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap gap-4">
          {totalsByCurrency.map(([currency, { income, expense }]) => (
            <HudFrame
              key={currency}
              corners="all"
              className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl px-4 py-2"
            >
              <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">{currency}</div>
              <div className="text-sm">
                Income {formatMoney(income, currency)} · Expense {formatMoney(expense, currency)} · Net{" "}
                <span className={income - expense >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {formatMoney(income - expense, currency)}
                </span>
              </div>
            </HudFrame>
          ))}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-accent text-ink btn-skew btn-glow px-4 py-2 text-sm font-medium shrink-0"
        >
          + Add Transaction
        </button>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No transactions yet.</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <HudFrame
              key={t.id}
              corners="tl-br"
              className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                      t.type === "income"
                        ? "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300"
                        : "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {t.type === "income" ? "Income" : "Expense"}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium">{t.description || t.category || "—"}</span>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50 truncate">
                  {t.date} {t.category ? `· ${t.category}` : ""}
                  {t.purchase_order_id ? ` · from PO #${t.purchase_order_id}` : ""}
                  {t.payroll_run_id ? " · from a payroll run" : ""}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-medium">{formatMoney(t.amount, t.currency)}</span>
                <button
                  onClick={() => setDeletingId(t.id)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Delete
                </button>
              </div>
            </HudFrame>
          ))}
        </div>
      )}

      {showCreate && (
        <TransactionFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}

      {deletingTransaction && (
        <ConfirmModal
          title="Delete transaction"
          message={`Delete "${deletingTransaction.description || deletingTransaction.category || "this transaction"}"?`}
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
