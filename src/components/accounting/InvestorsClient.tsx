"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import InvestorFormModal from "@/components/accounting/InvestorFormModal";
import InvestmentFormModal from "@/components/accounting/InvestmentFormModal";
import PayoutFormModal from "@/components/accounting/PayoutFormModal";
import type { InvestmentPayoutRow, InvestmentRow, InvestorRow } from "@/lib/investors";
import {
  INVESTMENT_STATUSES_BY_TYPE,
  INVESTMENT_STATUS_BADGE_CLASS,
  INVESTMENT_STATUS_LABELS,
  INVESTMENT_TYPE_LABELS,
} from "@/lib/investorsDisplay";
import { formatMoney } from "@/lib/procurementDisplay";
import { HudFrame } from "@/components/hud/HudFrame";
import { PaginationControls, usePagination } from "@/components/Pagination";

export default function InvestorsClient({
  investors,
  investments,
  payouts,
  isAdmin,
}: {
  investors: InvestorRow[];
  investments: InvestmentRow[];
  payouts: InvestmentPayoutRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [showCreateInvestor, setShowCreateInvestor] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<InvestorRow | null>(null);
  const [deletingInvestor, setDeletingInvestor] = useState<InvestorRow | null>(null);
  const [investingFor, setInvestingFor] = useState<InvestorRow | null>(null);
  const [payoutFor, setPayoutFor] = useState<InvestmentRow | null>(null);
  const [deletingInvestment, setDeletingInvestment] = useState<InvestmentRow | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteInvestor() {
    if (!deletingInvestor) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/investors/${deletingInvestor.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete investor");
        return;
      }
      setDeletingInvestor(null);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteInvestment() {
    if (!deletingInvestment) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/investments/${deletingInvestment.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete investment");
        return;
      }
      setDeletingInvestment(null);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  async function handleStatusChange(investment: InvestmentRow, status: string) {
    setError(null);
    const res = await fetch(`/api/investments/${investment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update status");
      return;
    }
    router.refresh();
  }

  const { pageItems, page, setPage, totalPages } = usePagination(investors);

  return (
    <div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      {isAdmin && (
        <div className="flex justify-end mb-4">
          <span className="btn-glow inline-block">
            <button onClick={() => setShowCreateInvestor(true)} className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium">
              + Add Investor
            </button>
          </span>
        </div>
      )}

      {investors.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No investors yet.</p>
      ) : (
        <div className="space-y-3">
          {pageItems.map((investor) => {
            const investorInvestments = investments.filter((i) => i.investor_id === investor.id);
            const investorPayouts = payouts.filter((p) => investorInvestments.some((i) => i.id === p.investment_id));

            // Net position per currency — invested minus paid out. Per-
            // currency only, same convention as TransactionsListClient's
            // totals (the Capital ledger tab carries the blended figure).
            const netByCurrency = new Map<string, number>();
            for (const inv of investorInvestments) {
              netByCurrency.set(inv.currency, (netByCurrency.get(inv.currency) ?? 0) + parseFloat(inv.amount));
            }
            for (const payout of investorPayouts) {
              netByCurrency.set(payout.currency, (netByCurrency.get(payout.currency) ?? 0) - parseFloat(payout.amount));
            }

            return (
              <HudFrame
                key={investor.id}
                corners="tl-br"
                className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{investor.name}</div>
                    <div className="text-xs text-black/50 dark:text-white/50 truncate">
                      {[investor.entity_type, investor.contact].filter(Boolean).join(" · ") || "No further details"}
                    </div>
                    {netByCurrency.size > 0 && (
                      <div className="text-xs text-black/50 dark:text-white/50 mt-1">
                        Net position:{" "}
                        {Array.from(netByCurrency.entries())
                          .map(([currency, net]) => formatMoney(net, currency))
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="shrink-0 flex gap-2">
                      <span className="btn-glow inline-block">
                        <button
                          type="button"
                          onClick={() => setInvestingFor(investor)}
                          className="text-xs btn-skew bg-accent text-ink px-3 py-1.5"
                        >
                          + Investment
                        </button>
                      </span>
                      <span className="btn-glow inline-block">
                        <button
                          type="button"
                          onClick={() => setEditingInvestor(investor)}
                          className="text-xs btn-skew border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5"
                        >
                          Edit
                        </button>
                      </span>
                      <span className="btn-glow-red inline-block">
                        <button
                          type="button"
                          onClick={() => setDeletingInvestor(investor)}
                          className="text-xs btn-skew border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5"
                        >
                          Delete
                        </button>
                      </span>
                    </div>
                  )}
                </div>

                {investorInvestments.length === 0 ? (
                  <p className="text-xs text-black/40 dark:text-white/40">No investments recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {investorInvestments.map((inv) => {
                      const investmentPayouts = payouts.filter((p) => p.investment_id === inv.id);
                      const paidOut = investmentPayouts.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                      return (
                        <div
                          key={inv.id}
                          className="rounded-xl border border-black/5 dark:border-white/10 p-3 bg-black/[0.02] dark:bg-white/[0.02]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-black/5 dark:bg-white/10">
                                {INVESTMENT_TYPE_LABELS[inv.investment_type]}
                              </span>
                              <span
                                className={`shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${INVESTMENT_STATUS_BADGE_CLASS[inv.status]}`}
                              >
                                {INVESTMENT_STATUS_LABELS[inv.status]}
                              </span>
                              <span className="text-sm font-medium truncate">{formatMoney(inv.amount, inv.currency)}</span>
                              <span className="text-xs text-black/40 dark:text-white/40 truncate">{inv.date}</span>
                            </div>
                            {isAdmin && (
                              <div className="flex items-center gap-2 shrink-0">
                                <select
                                  className="text-xs rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent"
                                  value={inv.status}
                                  onChange={(e) => handleStatusChange(inv, e.target.value)}
                                >
                                  {INVESTMENT_STATUSES_BY_TYPE[inv.investment_type].map((s) => (
                                    <option key={s} value={s} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
                                      {INVESTMENT_STATUS_LABELS[s]}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => setPayoutFor(inv)}
                                  className="text-xs text-accent hover:underline"
                                >
                                  + Payout
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingInvestment(inv)}
                                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                          {inv.terms && <div className="text-xs text-black/50 dark:text-white/50 mt-1">{inv.terms}</div>}
                          {investmentPayouts.length > 0 && (
                            <div className="text-xs text-black/50 dark:text-white/50 mt-2">
                              Paid out: {formatMoney(paidOut, inv.currency)} across {investmentPayouts.length} payout
                              {investmentPayouts.length === 1 ? "" : "s"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </HudFrame>
            );
          })}
        </div>
      )}
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />

      {isAdmin && showCreateInvestor && (
        <InvestorFormModal
          onClose={() => setShowCreateInvestor(false)}
          onSaved={() => {
            setShowCreateInvestor(false);
            router.refresh();
          }}
        />
      )}
      {isAdmin && editingInvestor && (
        <InvestorFormModal
          investor={editingInvestor}
          onClose={() => setEditingInvestor(null)}
          onSaved={() => {
            setEditingInvestor(null);
            router.refresh();
          }}
        />
      )}
      {isAdmin && investingFor && (
        <InvestmentFormModal
          investor={investingFor}
          onClose={() => setInvestingFor(null)}
          onSaved={() => {
            setInvestingFor(null);
            router.refresh();
          }}
        />
      )}
      {isAdmin && payoutFor && (
        <PayoutFormModal
          investment={payoutFor}
          onClose={() => setPayoutFor(null)}
          onSaved={() => {
            setPayoutFor(null);
            router.refresh();
          }}
        />
      )}
      {deletingInvestor && (
        <ConfirmModal
          title="Delete investor"
          message={`Delete "${deletingInvestor.name}"? This also removes their investments and payouts (the capital ledger entries stay).`}
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDeleteInvestor}
          onCancel={() => setDeletingInvestor(null)}
        />
      )}
      {deletingInvestment && (
        <ConfirmModal
          title="Delete investment"
          message="Delete this investment? The capital ledger entry it posted stays."
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDeleteInvestment}
          onCancel={() => setDeletingInvestment(null)}
        />
      )}
    </div>
  );
}
