"use client";

import { useEffect, useState } from "react";
import type { BalanceSummaryRow, ProfitAndLossRow } from "@/lib/financialStatements";
import { formatMoney } from "@/lib/procurementDisplay";
import { sumBlendedByDate, type ExchangeRateSnapshot } from "@/lib/currencyDisplay";
import { toMuscatDateInput } from "@/lib/time";
import { HudFrame } from "@/components/hud/HudFrame";

const inputClass =
  "rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent dark:[color-scheme:dark]";

function firstOfMonth(): string {
  const now = new Date();
  return toMuscatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

export default function StatementsClient({
  baseCurrency,
  exchangeRateSnapshot,
}: {
  baseCurrency: string;
  exchangeRateSnapshot: ExchangeRateSnapshot;
}) {
  const [periodStart, setPeriodStart] = useState(firstOfMonth());
  const [periodEnd, setPeriodEnd] = useState(toMuscatDateInput(new Date()));
  const [profitAndLoss, setProfitAndLoss] = useState<ProfitAndLossRow[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<BalanceSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/financial-statements?periodStart=${periodStart}&periodEnd=${periodEnd}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Failed to load statements");
          return;
        }
        setProfitAndLoss(data.profitAndLoss);
        setBalanceSummary(data.balanceSummary);
      })
      .catch(() => {
        if (!cancelled) setError("Network error — check your connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [periodStart, periodEnd]);

  // P&L blends at the period's own end date (its "as of" point); the
  // balance summary is always "as of today" already, so it blends at
  // today's rate — both via the same historical resolver, so a past
  // period's PnL doesn't shift after the current rate changes again.
  const today = toMuscatDateInput(new Date());
  const blendedPnl =
    profitAndLoss.length > 1
      ? sumBlendedByDate(
          profitAndLoss.map((r) => ({ currency: r.currency, amount: r.net, date: periodEnd })),
          baseCurrency,
          exchangeRateSnapshot
        )
      : null;
  const blendedBalance =
    balanceSummary.length > 1
      ? sumBlendedByDate(
          balanceSummary.map((r) => ({ currency: r.currency, amount: r.netPosition, date: today })),
          baseCurrency,
          exchangeRateSnapshot
        )
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="space-y-1">
          <label className="text-xs font-medium text-black/50 dark:text-white/50">From</label>
          <input type="date" className={inputClass} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-black/50 dark:text-white/50">To</label>
          <input type="date" className={inputClass} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
        <span className="btn-glow inline-block">
          <a
            href={`/api/financial-statements/pdf?periodStart=${periodStart}&periodEnd=${periodEnd}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
          >
            Download PDF
          </a>
        </span>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}
      {loading && <p className="text-sm text-black/40 dark:text-white/40 mb-4">Loading…</p>}

      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
        Profit &amp; loss — {periodStart} → {periodEnd}
      </div>
      {profitAndLoss.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50 mb-6">No approved transactions in this period.</p>
      ) : (
        <div className="flex flex-wrap gap-3 mb-6">
          {profitAndLoss.map((r) => (
            <HudFrame
              key={r.currency}
              corners="all"
              className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl px-4 py-2"
            >
              <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">{r.currency}</div>
              <div className="text-sm">
                Income {formatMoney(r.income, r.currency)} · Expense {formatMoney(r.expense, r.currency)} · Net{" "}
                <span className={r.net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {formatMoney(r.net, r.currency)}
                </span>
              </div>
              {(r.vatCollected > 0 || r.vatPaid > 0) && (
                <div className="text-xs text-black/50 dark:text-white/50 mt-1">
                  VAT collected {formatMoney(r.vatCollected, r.currency)} · VAT paid {formatMoney(r.vatPaid, r.currency)} · Net owed{" "}
                  {formatMoney(r.vatCollected - r.vatPaid, r.currency)}
                </div>
              )}
            </HudFrame>
          ))}
          {blendedPnl && (
            <HudFrame corners="all" className="bg-accent/5 dark:bg-accent/10 border border-accent/20 rounded-xl px-4 py-2">
              <div className="text-xs text-accent uppercase tracking-wide">Blended ({baseCurrency})</div>
              <div className="text-sm">
                Net{" "}
                <span className={blendedPnl.total >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {formatMoney(blendedPnl.total, baseCurrency)}
                </span>
              </div>
            </HudFrame>
          )}
        </div>
      )}

      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
        Balance summary — as of today
      </div>
      {balanceSummary.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No inventory, account, or loan data yet.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {balanceSummary.map((r) => (
            <HudFrame
              key={r.currency}
              corners="all"
              className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl px-4 py-2"
            >
              <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">{r.currency}</div>
              <div className="text-sm">
                Inventory {formatMoney(r.inventoryValue, r.currency)} + Cash/Bank {formatMoney(r.cashAndBankBalance, r.currency)} −
                Loans {formatMoney(r.outstandingLoans, r.currency)} = Net{" "}
                <span className={r.netPosition >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {formatMoney(r.netPosition, r.currency)}
                </span>
              </div>
            </HudFrame>
          ))}
          {blendedBalance && (
            <HudFrame corners="all" className="bg-accent/5 dark:bg-accent/10 border border-accent/20 rounded-xl px-4 py-2">
              <div className="text-xs text-accent uppercase tracking-wide">Blended ({baseCurrency})</div>
              <div className="text-sm">
                Net{" "}
                <span
                  className={blendedBalance.total >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
                >
                  {formatMoney(blendedBalance.total, baseCurrency)}
                </span>
              </div>
            </HudFrame>
          )}
        </div>
      )}
    </div>
  );
}
