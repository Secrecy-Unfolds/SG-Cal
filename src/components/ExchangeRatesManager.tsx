"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HudFrame } from "@/components/hud/HudFrame";
import SectionLabel from "@/components/hud/SectionLabel";
import ConfirmModal from "@/components/ConfirmModal";
import type { ExchangeRateRow } from "@/lib/exchangeRates";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm";

// Manual, Admin-entered exchange rates — not a live FX API. See
// docs/erp-v2-roadmap.md's "Currency blending" section. Each rate is "how
// many units of the base currency is 1 unit of this currency worth" — the
// base currency itself never needs a row (implicit rate of 1).
export default function ExchangeRatesManager({
  baseCurrency,
  initialRates,
}: {
  baseCurrency: string;
  initialRates: ExchangeRateRow[];
}) {
  const router = useRouter();
  const [editingRates, setEditingRates] = useState<Record<string, string>>({});
  const [newCurrency, setNewCurrency] = useState("");
  const [newRate, setNewRate] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveRate(currency: string, rateToBase: string) {
    const rate = Number(rateToBase);
    if (!Number.isFinite(rate) || rate <= 0) {
      setError("Rate must be a positive number");
      return;
    }
    setError(null);
    setSaving(currency);
    try {
      const res = await fetch("/api/settings/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, rateToBase: rate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save rate");
        return;
      }
      setEditingRates((prev) => {
        const next = { ...prev };
        delete next[currency];
        return next;
      });
      setNewCurrency("");
      setNewRate("");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(null);
    }
  }

  async function handleDelete(currency: string) {
    setConfirmingDelete(null);
    setSaving(currency);
    try {
      const res = await fetch(`/api/settings/exchange-rates/${encodeURIComponent(currency)}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setSaving(null);
    }
  }

  return (
    <HudFrame
      corners="all"
      className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-4"
    >
      <div>
        <SectionLabel>Currency blending</SectionLabel>
        <h2 className="font-heading font-semibold text-sm uppercase tracking-wide">Exchange rates</h2>
        <p className="text-xs text-black/40 dark:text-white/40 mt-1">
          How many {baseCurrency} one unit of another currency is worth.
          Manually entered, not a live feed — update these whenever real
          rates move meaningfully. A currency with no rate here is excluded
          from blended totals, not guessed at 1:1.
        </p>
      </div>

      {initialRates.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          No exchange rates set yet — {baseCurrency} amounts blend fine on their own, but other
          currencies won&rsquo;t be included in blended totals until you add a rate for each.
        </p>
      ) : (
        <div className="space-y-2">
          {initialRates.map((r) => {
            const editingValue = editingRates[r.currency];
            const isEditing = editingValue !== undefined;
            return (
              <div
                key={r.currency}
                className="flex flex-wrap items-center gap-3 border border-black/5 dark:border-white/10 rounded-lg px-3 py-2"
              >
                <span className="text-sm font-medium w-16 shrink-0">{r.currency}</span>
                <span className="text-xs text-black/40 dark:text-white/40 shrink-0">1 {r.currency} =</span>
                <input
                  type="number"
                  step="0.000001"
                  min={0}
                  className={`${inputClass} flex-1 min-w-[100px]`}
                  value={isEditing ? editingValue : r.rate_to_base}
                  onChange={(e) => setEditingRates((prev) => ({ ...prev, [r.currency]: e.target.value }))}
                />
                <span className="text-xs text-black/40 dark:text-white/40 shrink-0">{baseCurrency}</span>
                <div className="flex gap-2 shrink-0">
                  <span className="btn-glow inline-block">
                    <button
                      type="button"
                      disabled={saving === r.currency || !isEditing}
                      onClick={() => saveRate(r.currency, editingValue)}
                      className="btn-skew border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-50"
                    >
                      Save
                    </button>
                  </span>
                  <span className="btn-glow-red inline-block">
                    <button
                      type="button"
                      disabled={saving === r.currency}
                      onClick={() => setConfirmingDelete(r.currency)}
                      className="btn-skew border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-black/5 dark:border-white/10">
        <div className="space-y-1">
          <label className="text-xs font-medium">Currency</label>
          <input
            className={`${inputClass} w-24`}
            placeholder="USD"
            value={newCurrency}
            onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Rate to {baseCurrency}</label>
          <input
            type="number"
            step="0.000001"
            min={0}
            className={`${inputClass} w-32`}
            placeholder="0.385"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
          />
        </div>
        <span className="btn-glow inline-block">
          <button
            type="button"
            disabled={!newCurrency.trim() || !newRate || saving === newCurrency.trim()}
            onClick={() => saveRate(newCurrency.trim(), newRate)}
            className="btn-skew bg-accent text-ink px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Add
          </button>
        </span>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {confirmingDelete && (
        <ConfirmModal
          title="Remove exchange rate"
          message={`Remove the exchange rate for ${confirmingDelete}? Transactions in that currency will be excluded from blended totals until a new rate is set.`}
          confirmLabel="Remove"
          loading={saving === confirmingDelete}
          onConfirm={() => handleDelete(confirmingDelete)}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}
    </HudFrame>
  );
}
