"use client";

import { useRef, useState } from "react";
import type { TransactionType } from "@/lib/accounting";
import type { FinancialAccountRow } from "@/lib/financialAccounts";
import { DEFAULT_VAT_RATE } from "@/lib/accountingDisplay";
import { toMuscatDateInput } from "@/lib/time";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function TransactionFormModal({
  financialAccounts,
  onClose,
  onSaved,
}: {
  financialAccounts: FinancialAccountRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(toMuscatDateInput(new Date()));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("OMR");
  const [type, setType] = useState<TransactionType>("expense");
  const [category, setCategory] = useState("");
  const [financialAccountId, setFinancialAccountId] = useState<string>("");
  const [taxable, setTaxable] = useState(false);
  const [vatRate, setVatRate] = useState(String(DEFAULT_VAT_RATE));
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/accounting/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to upload attachment");
        return;
      }
      setAttachmentUrl(data.url);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter a positive amount");
      return;
    }
    const vatRateNum = taxable ? Number(vatRate) : null;
    if (taxable && (!Number.isFinite(vatRateNum) || vatRateNum! < 0)) {
      setError("Enter a valid VAT rate");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/accounting/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          description: description.trim(),
          amount: amountNum,
          currency,
          type,
          category: category.trim(),
          financialAccountId: financialAccountId ? Number(financialAccountId) : null,
          attachmentUrl,
          taxable,
          vatRate: vatRateNum,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save transaction");
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
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">New transaction</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm">
          <span className="btn-glow flex-1">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`w-full btn-skew py-1.5 font-medium transition-colors ${
                type === "expense" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
              }`}
            >
              Expense
            </button>
          </span>
          <span className="btn-glow flex-1">
            <button
              type="button"
              onClick={() => setType("income")}
              className={`w-full btn-skew py-1.5 font-medium transition-colors ${
                type === "income" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
              }`}
            >
              Income
            </button>
          </span>
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
            <label className="text-sm font-medium">Category</label>
            <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
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
            <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Account (optional)</label>
          <select className={inputClass} value={financialAccountId} onChange={(e) => setFinancialAccountId(e.target.value)}>
            <option value="" className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
              Unassigned
            </option>
            {financialAccounts.map((a) => (
              <option key={a.id} value={a.id} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Attachment (optional)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleAttachmentChange}
            disabled={uploading}
            className="w-full text-sm"
          />
          {uploading && <p className="text-xs text-black/40 dark:text-white/40 mt-1">Uploading…</p>}
          {attachmentUrl && !uploading && <p className="text-xs text-green-600 dark:text-green-400 mt-1">Attached</p>}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} />
            Taxable (VAT)
          </label>
          {taxable && (
            <div className="space-y-1">
              <label className="text-sm font-medium">VAT rate (%)</label>
              <input type="number" step="0.01" className={inputClass} value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
            </div>
          )}
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
              disabled={saving || uploading}
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
