"use client";

import { useState } from "react";
import CurrencySelect from "@/components/CurrencySelect";
import type { CapitalBudgetRow } from "@/lib/capitalBudgets";
import type { ProductRow } from "@/lib/procurement";
import { toMuscatDateInput } from "@/lib/time";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function CapitalBudgetFormModal({
  budget,
  products,
  onClose,
  onSaved,
}: {
  budget?: CapitalBudgetRow;
  products: ProductRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(budget?.label ?? "");
  const [periodStart, setPeriodStart] = useState(budget?.period_start ?? toMuscatDateInput(new Date()));
  const [periodEnd, setPeriodEnd] = useState(budget?.period_end ?? toMuscatDateInput(new Date()));
  const [productId, setProductId] = useState<string>(budget?.product_id ? String(budget.product_id) : "");
  const [amount, setAmount] = useState(budget ? budget.amount : "");
  const [currency, setCurrency] = useState(budget?.currency ?? "OMR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter a positive amount");
      return;
    }
    if (periodEnd < periodStart) {
      setError("Period end must be on or after period start");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(budget ? `/api/capital-budgets/${budget.id}` : "/api/capital-budgets", {
        method: budget ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          periodStart,
          periodEnd,
          productId: productId ? Number(productId) : null,
          amount: amountNum,
          currency,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save budget");
        return;
      }
      onSaved();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">{budget ? "Edit budget" : "New budget"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Label</label>
          <input
            className={inputClass}
            placeholder="Q3 2026, October marketing spend, etc."
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Period start</label>
            <input
              type="date"
              className={`${inputClass} dark:[color-scheme:dark]`}
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Period end</label>
            <input
              type="date"
              className={`${inputClass} dark:[color-scheme:dark]`}
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Product (optional)</label>
          <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="" className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
              Org-wide — all Procurement spend
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Amount</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Currency</label>
            <CurrencySelect className={inputClass} value={currency} onChange={setCurrency} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <span className="btn-glow inline-block">
            <button
              type="button"
              onClick={onClose}
              className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Cancel
            </button>
          </span>
          <span className="btn-glow inline-block">
            <button
              type="submit"
              disabled={saving}
              className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}
