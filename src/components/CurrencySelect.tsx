"use client";

import { useEffect, useState } from "react";

const OTHER = "__other__";

// Shared currency picker used by every currency field app-wide (Procurement
// Planning, Inventory, Accounting) — see docs/erp-v2-roadmap.md's "Currency
// as a fixed list" item. Backed by the `currencies` table via /api/currencies
// rather than a hardcoded list, so picking "Other" and adding a new code
// makes it a real option for every other field too, not just this one.
export default function CurrencySelect({
  value,
  onChange,
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [addingOther, setAddingOther] = useState(false);
  const [otherValue, setOtherValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/currencies")
      .then((res) => res.json())
      .then((data) => {
        const list: string[] = Array.isArray(data.currencies) ? data.currencies : [];
        setCurrencies(list);
        // A blank starting value (e.g. an "add new rate" row with nothing
        // chosen yet) would otherwise show the <select>'s first option
        // while the caller's own state stays empty — keep them in sync.
        if (!value && list.length > 0) onChange(list[0]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The current value might not be in the fetched list yet (still loading,
  // or a value this specific record has that no longer matches the shared
  // list) — keep it selectable regardless so nothing silently changes.
  const options = value && !currencies.includes(value) ? [value, ...currencies] : currencies;

  async function handleAddOther() {
    const code = otherValue.trim().toUpperCase();
    if (!code) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/currencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add currency");
        return;
      }
      setCurrencies(Array.isArray(data.currencies) ? data.currencies : [...currencies, code]);
      onChange(code);
      setAddingOther(false);
      setOtherValue("");
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <select
        className={className}
        disabled={disabled}
        value={addingOther ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setAddingOther(true);
            return;
          }
          setAddingOther(false);
          onChange(e.target.value);
        }}
      >
        {options.map((code) => (
          <option key={code} value={code} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
            {code}
          </option>
        ))}
        <option value={OTHER} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
          Other…
        </option>
      </select>
      {addingOther && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={otherValue}
            onChange={(e) => setOtherValue(e.target.value)}
            placeholder="e.g. JPY"
            maxLength={8}
            className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="button"
            onClick={handleAddOther}
            disabled={saving || !otherValue.trim()}
            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
