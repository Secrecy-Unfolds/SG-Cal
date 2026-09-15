"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import TransactionFormModal from "@/components/accounting/TransactionFormModal";
import type { AccountingTransactionRow } from "@/lib/accounting";
import type { FinancialAccountRow } from "@/lib/financialAccounts";
import type { UserRole } from "@/lib/users";
import { TRANSACTION_STATUS_BADGE_CLASS, TRANSACTION_STATUS_LABELS } from "@/lib/accountingDisplay";
import { formatMoney } from "@/lib/procurementDisplay";
import { sumBlended } from "@/lib/currencyDisplay";
import { HudFrame } from "@/components/hud/HudFrame";

export default function TransactionsListClient({
  transactions,
  financialAccounts,
  baseCurrency,
  exchangeRates,
  actorRole,
}: {
  transactions: AccountingTransactionRow[];
  financialAccounts: FinancialAccountRow[];
  baseCurrency: string;
  exchangeRates: Record<string, number>;
  actorRole: UserRole;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = useMemo(() => transactions.filter((t) => t.status === "pending").length, [transactions]);

  // Per-currency totals stay the source of truth — currency here is free
  // text (same convention as Procurement Planning), so mixing amounts
  // across different currencies into one number without conversion would be
  // misleading. The blended total below is an *additional* figure on top,
  // converted via Settings' manually-entered exchange rates — see
  // docs/erp-v2-roadmap.md's "Currency blending" section. Only 'approved'
  // rows count — a pending or rejected expense hasn't (yet, or won't ever)
  // actually happened, per the expense-approval workflow.
  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const t of transactions) {
      if (t.status !== "approved") continue;
      const entry = map.get(t.currency) ?? { income: 0, expense: 0 };
      entry[t.type] += parseFloat(t.amount);
      map.set(t.currency, entry);
    }
    return Array.from(map.entries());
  }, [transactions]);

  const blendedNet = useMemo(() => {
    if (totalsByCurrency.length < 2) return null; // nothing to blend with only one currency
    const rates = new Map(Object.entries(exchangeRates));
    return sumBlended(
      totalsByCurrency.map(([currency, { income, expense }]) => ({ currency, amount: income - expense })),
      baseCurrency,
      rates
    );
  }, [totalsByCurrency, baseCurrency, exchangeRates]);

  async function handleDelete() {
    if (deletingId === null) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/transactions/${deletingId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete transaction");
        return;
      }
      setDeletingId(null);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  async function handleDecide(status: "approved" | "rejected") {
    if (decidingId === null) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/transactions/${decidingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to decide expense");
        return;
      }
      setDecidingId(null);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  const deletingTransaction = transactions.find((t) => t.id === deletingId) ?? null;

  return (
    <div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

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
          {blendedNet && (
            <HudFrame
              corners="all"
              className="bg-accent/5 dark:bg-accent/10 border border-accent/20 rounded-xl px-4 py-2"
            >
              <div className="text-xs text-accent uppercase tracking-wide">Blended ({baseCurrency})</div>
              <div className="text-sm">
                Net{" "}
                <span className={blendedNet.total >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {formatMoney(blendedNet.total, baseCurrency)}
                </span>
                {blendedNet.excludedCurrencies.length > 0 && (
                  <span className="text-black/40 dark:text-white/40">
                    {" "}
                    · {blendedNet.excludedCurrencies.join(", ")} excluded — no rate set
                  </span>
                )}
              </div>
            </HudFrame>
          )}
          {pendingCount > 0 && (
            <HudFrame corners="all" className="bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 rounded-xl px-4 py-2">
              <div className="text-sm text-amber-700 dark:text-amber-300">
                {pendingCount} expense{pendingCount === 1 ? "" : "s"} pending approval — not in totals yet
              </div>
            </HudFrame>
          )}
        </div>
        <span className="btn-glow shrink-0 inline-block">
          <button
            onClick={() => setShowCreate(true)}
            className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
          >
            + Add Transaction
          </button>
        </span>
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
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className={`shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                      t.type === "income"
                        ? "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300"
                        : "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {t.type === "income" ? "Income" : "Expense"}
                  </span>
                  {t.status !== "approved" && (
                    <span
                      className={`shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${TRANSACTION_STATUS_BADGE_CLASS[t.status]}`}
                    >
                      {TRANSACTION_STATUS_LABELS[t.status]}
                    </span>
                  )}
                  <span className="min-w-0 truncate text-sm font-medium">{t.description || t.category || "—"}</span>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50 truncate">
                  {t.date} {t.category ? `· ${t.category}` : ""}
                  {t.financial_account_name ? ` · ${t.financial_account_name}` : ""}
                  {t.purchase_order_id ? ` · from PO #${t.purchase_order_id}` : ""}
                  {t.payroll_run_id ? " · from a payroll run" : ""}
                  {t.recurring_expense_id ? " · from a recurring expense" : ""}
                  {t.recurring_income_id ? " · from recurring income" : ""}
                  {t.taxable && t.vat_amount ? ` · VAT ${formatMoney(t.vat_amount, t.currency)} (${t.vat_rate}%)` : ""}
                  {t.attachment_url && (
                    <>
                      {" · "}
                      <a href={t.attachment_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        Attachment
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-medium">{formatMoney(t.amount, t.currency)}</span>
                {t.status === "pending" && actorRole === "super_admin" && (
                  <button
                    onClick={() => setDecidingId(t.id)}
                    className="text-xs text-accent hover:underline"
                  >
                    Decide
                  </button>
                )}
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
          financialAccounts={financialAccounts}
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

      {decidingId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4">
            <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">Decide expense</h2>
            <p className="text-sm text-black/60 dark:text-white/60">Approve or reject this pending expense.</p>
            <div className="flex justify-end gap-2 pt-2">
              <span className="btn-glow inline-block">
                <button
                  type="button"
                  onClick={() => setDecidingId(null)}
                  className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
                >
                  Cancel
                </button>
              </span>
              <span className="btn-glow-red inline-block">
                <button
                  type="button"
                  disabled={working}
                  onClick={() => handleDecide("rejected")}
                  className="btn-skew px-4 py-2 text-sm border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 disabled:opacity-50"
                >
                  Reject
                </button>
              </span>
              <span className="btn-glow inline-block">
                <button
                  type="button"
                  disabled={working}
                  onClick={() => handleDecide("approved")}
                  className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Approve
                </button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
