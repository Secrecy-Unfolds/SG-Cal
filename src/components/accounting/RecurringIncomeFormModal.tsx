"use client";

import { useState } from "react";
import CurrencySelect from "@/components/CurrencySelect";
import type { RecurringIncomeRow } from "@/lib/recurringIncome";
import type { RecurringExpenseFrequency } from "@/lib/accountingDisplay";
import { RECURRING_EXPENSE_FREQUENCIES, RECURRING_EXPENSE_FREQUENCY_LABELS } from "@/lib/accountingDisplay";
import { toMuscatDateInput } from "@/lib/time";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function RecurringIncomeFormModal({
  recurring,
  onClose,
  onSaved,
}: {
  recurring?: RecurringIncomeRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(recurring?.description ?? "");
  const [category, setCategory] = useState(recurring?.category ?? "");
  const [amount, setAmount] = useState(recurring ? recurring.amount : "");
  const [currency, setCurrency] = useState(recurring?.currency ?? "OMR");
  const [frequency, setFrequency] = useState<RecurringExpenseFrequency>(recurring?.frequency ?? "monthly");
  const [nextRunDate, setNextRunDate] = useState(recurring?.next_run_date ?? toMuscatDateInput(new Date()));
  const [active, setActive] = useState(recurring?.active ?? true);
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
    setSaving(true);
    try {
      const res = await fetch(recurring ? `/api/recurring-income/${recurring.id}` : "/api/recurring-income", {
        method: recurring ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          category: category.trim(),
          amount: amountNum,
          currency,
          frequency,
          nextRunDate,
          ...(recurring ? { active } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save recurring income");
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
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">
            {recurring ? "Edit recurring income" : "New recurring income"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Category</label>
            <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Frequency</label>
            <select className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringExpenseFrequency)}>
              {RECURRING_EXPENSE_FREQUENCIES.map((f) => (
                <option key={f} value={f} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
                  {RECURRING_EXPENSE_FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
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

        <div className="space-y-1">
          <label className="text-sm font-medium">{recurring ? "Next run date" : "First run date"}</label>
          <input
            type="date"
            className={`${inputClass} dark:[color-scheme:dark]`}
            value={nextRunDate}
            onChange={(e) => setNextRunDate(e.target.value)}
            required
          />
        </div>

        {recurring && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
        )}

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
