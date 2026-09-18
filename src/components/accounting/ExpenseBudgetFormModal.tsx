"use client";

import { useState } from "react";
import CurrencySelect from "@/components/CurrencySelect";
import type { ExpenseBudgetRow } from "@/lib/expenseBudgets";
import { toMuscatDateInput } from "@/lib/time";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function ExpenseBudgetFormModal({
  budget,
  onClose,
  onSaved,
}: {
  budget?: ExpenseBudgetRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(budget?.category ?? "");
  const [periodStart, setPeriodStart] = useState(budget?.period_start ?? toMuscatDateInput(new Date()));
  const [periodEnd, setPeriodEnd] = useState(budget?.period_end ?? toMuscatDateInput(new Date()));
  const [amount, setAmount] = useState(budget ? budget.amount : "");
  const [currency, setCurrency] = useState(budget?.currency ?? "OMR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!category.trim()) {
      setError("Category is required");
      return;
    }
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
      const res = await fetch(budget ? `/api/expense-budgets/${budget.id}` : "/api/expense-budgets", {
        method: budget ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: category.trim(), periodStart, periodEnd, amount: amountNum, currency }),
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
          <label className="text-sm font-medium">Category</label>
          <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} autoFocus required />
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
