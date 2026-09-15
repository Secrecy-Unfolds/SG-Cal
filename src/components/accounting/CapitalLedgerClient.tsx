"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import CapitalEntryFormModal from "@/components/accounting/CapitalEntryFormModal";
import type { CapitalEntryRow } from "@/lib/capital";
import { CAPITAL_SOURCE_BADGE_CLASS, CAPITAL_SOURCE_LABELS } from "@/lib/capitalDisplay";
import { formatMoney } from "@/lib/procurementDisplay";
import { sumBlended } from "@/lib/currencyDisplay";
import { HudFrame } from "@/components/hud/HudFrame";

export default function CapitalLedgerClient({
  entries,
  baseCurrency,
  exchangeRates,
}: {
  entries: CapitalEntryRow[];
  baseCurrency: string;
  exchangeRates: Record<string, number>;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [working, setWorking] = useState(false);

  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      map.set(e.currency, (map.get(e.currency) ?? 0) + parseFloat(e.amount));
    }
    return Array.from(map.entries());
  }, [entries]);

  const blendedTotal = useMemo(() => {
    if (totalsByCurrency.length < 2) return null;
    const rates = new Map(Object.entries(exchangeRates));
    return sumBlended(
      totalsByCurrency.map(([currency, amount]) => ({ currency, amount })),
      baseCurrency,
      rates
    );
  }, [totalsByCurrency, baseCurrency, exchangeRates]);

  async function handleDelete() {
    if (deletingId === null) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/capital/${deletingId}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingId(null);
        router.refresh();
      }
    } finally {
      setWorking(false);
    }
  }

  const deletingEntry = entries.find((e) => e.id === deletingId) ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap gap-4">
          {totalsByCurrency.map(([currency, total]) => (
            <HudFrame
              key={currency}
              corners="all"
              className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl px-4 py-2"
            >
              <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">{currency}</div>
              <div className="text-sm font-medium">{formatMoney(total, currency)}</div>
            </HudFrame>
          ))}
          {blendedTotal && (
            <HudFrame corners="all" className="bg-accent/5 dark:bg-accent/10 border border-accent/20 rounded-xl px-4 py-2">
              <div className="text-xs text-accent uppercase tracking-wide">Blended ({baseCurrency})</div>
              <div className="text-sm font-medium">
                {formatMoney(blendedTotal.total, baseCurrency)}
                {blendedTotal.excludedCurrencies.length > 0 && (
                  <span className="text-black/40 dark:text-white/40 font-normal">
                    {" "}
                    · {blendedTotal.excludedCurrencies.join(", ")} excluded — no rate set
                  </span>
                )}
              </div>
            </HudFrame>
          )}
        </div>
        <span className="btn-glow shrink-0 inline-block">
          <button onClick={() => setShowCreate(true)} className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium">
            + Add Entry
          </button>
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No capital entries yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <HudFrame
              key={e.id}
              corners="tl-br"
              className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${CAPITAL_SOURCE_BADGE_CLASS[e.source]}`}
                  >
                    {CAPITAL_SOURCE_LABELS[e.source]}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium">{e.description || "—"}</span>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50 truncate">{e.date}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-medium">{formatMoney(e.amount, e.currency)}</span>
                <button onClick={() => setDeletingId(e.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                  Delete
                </button>
              </div>
            </HudFrame>
          ))}
        </div>
      )}

      {showCreate && (
        <CapitalEntryFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}

      {deletingEntry && (
        <ConfirmModal
          title="Delete capital entry"
          message={`Delete "${deletingEntry.description || "this entry"}"?`}
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
