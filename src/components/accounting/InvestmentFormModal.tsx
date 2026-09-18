"use client";

import { useState } from "react";
import CurrencySelect from "@/components/CurrencySelect";
import type { InvestorRow } from "@/lib/investors";
import type { InvestmentType } from "@/lib/investorsDisplay";
import { INVESTMENT_TYPE_LABELS, INVESTMENT_TYPES } from "@/lib/investorsDisplay";
import { toMuscatDateInput } from "@/lib/time";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function InvestmentFormModal({
  investor,
  onClose,
  onSaved,
}: {
  investor: InvestorRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [investmentType, setInvestmentType] = useState<InvestmentType>("loan");
  const [date, setDate] = useState(toMuscatDateInput(new Date()));
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("OMR");
  const [terms, setTerms] = useState("");
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
      const res = await fetch("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorId: investor.id,
          investmentType,
          amount: amountNum,
          currency,
          date,
          terms: terms.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save investment");
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
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">New investment</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-black/50 dark:text-white/50">From {investor.name}. Automatically posts to the capital ledger.</p>

        <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm">
          {INVESTMENT_TYPES.map((t) => (
            <span key={t} className="btn-glow flex-1">
              <button
                type="button"
                onClick={() => setInvestmentType(t)}
                className={`w-full btn-skew py-1.5 font-medium transition-colors ${
                  investmentType === t ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
                }`}
              >
                {INVESTMENT_TYPE_LABELS[t]}
              </button>
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Date</label>
            <input
              type="date"
              className={`${inputClass} dark:[color-scheme:dark]`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Currency</label>
            <CurrencySelect className={inputClass} value={currency} onChange={setCurrency} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Amount</label>
          <input type="number" step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Terms</label>
          <input
            className={inputClass}
            placeholder="Interest rate, repayment schedule, equity %, etc."
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
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
