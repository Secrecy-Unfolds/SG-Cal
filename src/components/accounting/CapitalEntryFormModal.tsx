"use client";

import { useState } from "react";
import CurrencySelect from "@/components/CurrencySelect";
import type { CapitalSource } from "@/lib/capitalDisplay";
import { CAPITAL_SOURCE_LABELS } from "@/lib/capitalDisplay";
import { toMuscatDateInput } from "@/lib/time";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

// Investor and government-support money is created via the Investors /
// Government support sub-tabs instead, so it stays linked back to its
// source record — see lib/capital.ts's postCapitalEntry().
const MANUAL_SOURCES: CapitalSource[] = ["owner", "loan", "grant", "other"];

export default function CapitalEntryFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [source, setSource] = useState<CapitalSource>("owner");
  const [date, setDate] = useState(toMuscatDateInput(new Date()));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("OMR");
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
      const res = await fetch("/api/capital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, date, description: description.trim(), amount: amountNum, currency }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save capital entry");
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
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">New capital entry</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Source</label>
          <select
            className={inputClass}
            value={source}
            onChange={(e) => setSource(e.target.value as CapitalSource)}
          >
            {MANUAL_SOURCES.map((s) => (
              <option key={s} value={s} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
                {CAPITAL_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
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
          <label className="text-sm font-medium">Description</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Amount</label>
          <input type="number" step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} required />
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
