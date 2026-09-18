"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import CapitalBudgetFormModal from "@/components/accounting/CapitalBudgetFormModal";
import type { CapitalBudgetRow } from "@/lib/capitalBudgets";
import type { ProductRow } from "@/lib/procurement";
import { formatMoney } from "@/lib/procurementDisplay";
import { sumBlendedByDate, type ExchangeRateSnapshot } from "@/lib/currencyDisplay";
import { HudFrame } from "@/components/hud/HudFrame";

export default function CapitalBudgetsClient({
  budgets,
  products,
  baseCurrency,
  exchangeRateSnapshot,
}: {
  budgets: CapitalBudgetRow[];
  products: ProductRow[];
  baseCurrency: string;
  exchangeRateSnapshot: ExchangeRateSnapshot;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CapitalBudgetRow | null>(null);
  const [deleting, setDeleting] = useState<CapitalBudgetRow | null>(null);
  const [working, setWorking] = useState(false);

  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, { budgeted: number; actual: number }>();
    for (const b of budgets) {
      const entry = map.get(b.currency) ?? { budgeted: 0, actual: 0 };
      entry.budgeted += parseFloat(b.amount);
      entry.actual += parseFloat(b.actual);
      map.set(b.currency, entry);
    }
    return Array.from(map.entries());
  }, [budgets]);

  // Each budget row blends using the rate in effect for its own period
  // (period_start), not today's rate — same approach as ExpenseBudgetsClient.
  const blended = useMemo(() => {
    if (totalsByCurrency.length < 2) return null;
    const budgeted = sumBlendedByDate(
      budgets.map((b) => ({ currency: b.currency, amount: parseFloat(b.amount), date: b.period_start })),
      baseCurrency,
      exchangeRateSnapshot
    );
    const actual = sumBlendedByDate(
      budgets.map((b) => ({ currency: b.currency, amount: parseFloat(b.actual), date: b.period_start })),
      baseCurrency,
      exchangeRateSnapshot
    );
    return { budgeted, actual };
  }, [totalsByCurrency, budgets, baseCurrency, exchangeRateSnapshot]);

  async function handleDelete() {
    if (!deleting) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/capital-budgets/${deleting.id}`, { method: "DELETE" });
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap gap-4">
          {totalsByCurrency.map(([currency, { budgeted, actual }]) => (
            <HudFrame
              key={currency}
              corners="all"
              className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl px-4 py-2"
            >
              <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">{currency}</div>
              <div className="text-sm">
                Budgeted {formatMoney(budgeted, currency)} · Actual{" "}
                <span className={actual > budgeted ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                  {formatMoney(actual, currency)}
                </span>
              </div>
            </HudFrame>
          ))}
          {blended && (
            <HudFrame corners="all" className="bg-accent/5 dark:bg-accent/10 border border-accent/20 rounded-xl px-4 py-2">
              <div className="text-xs text-accent uppercase tracking-wide">Blended ({baseCurrency})</div>
              <div className="text-sm">
                Budgeted {formatMoney(blended.budgeted.total, baseCurrency)} · Actual{" "}
                <span
                  className={
                    blended.actual.total > blended.budgeted.total
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }
                >
                  {formatMoney(blended.actual.total, baseCurrency)}
                </span>
                {blended.budgeted.excludedCurrencies.length > 0 && (
                  <span className="text-black/40 dark:text-white/40">
                    {" "}
                    · {blended.budgeted.excludedCurrencies.join(", ")} excluded — no rate set
                  </span>
                )}
              </div>
            </HudFrame>
          )}
        </div>
        <span className="btn-glow shrink-0 inline-block">
          <button onClick={() => setShowCreate(true)} className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium">
            + Add Budget
          </button>
        </span>
      </div>

      {budgets.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No budgets yet.</p>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => {
            const amount = parseFloat(b.amount);
            const actual = parseFloat(b.actual);
            const pct = amount > 0 ? Math.min(100, (actual / amount) * 100) : 0;
            const over = actual > amount;
            return (
              <HudFrame
                key={b.id}
                corners="tl-br"
                className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{b.label || (b.product_name ?? "Org-wide budget")}</div>
                    <div className="text-xs text-black/50 dark:text-white/50 truncate">
                      {b.period_start} → {b.period_end}
                      {b.product_name ? ` · ${b.product_name}` : " · Org-wide"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm font-medium ${over ? "text-red-600 dark:text-red-400" : ""}`}>
                      {formatMoney(b.actual, b.currency)} / {formatMoney(b.amount, b.currency)}
                    </span>
                    <button
                      onClick={() => setEditing(b)}
                      className="text-xs text-accent hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleting(b)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${over ? "bg-red-500" : "bg-accent"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </HudFrame>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CapitalBudgetFormModal
          products={products}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <CapitalBudgetFormModal
          budget={editing}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete budget"
          message={`Delete "${deleting.label || deleting.product_name || "this budget"}"?`}
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
