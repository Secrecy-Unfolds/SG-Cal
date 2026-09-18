"use client";

import { useState } from "react";
import CurrencySelect from "@/components/CurrencySelect";
import type { CustomerRow } from "@/lib/customers";
import type { InvoiceLineItemRow, IssuedInvoiceRow } from "@/lib/invoices";
import { formatMoney } from "@/lib/procurementDisplay";
import { toMuscatDateInput } from "@/lib/time";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

type DraftLine = { description: string; quantity: string; unitPrice: string };

function toDraftLines(lineItems?: InvoiceLineItemRow[]): DraftLine[] {
  if (!lineItems || lineItems.length === 0) return [{ description: "", quantity: "1", unitPrice: "" }];
  return lineItems.map((li) => ({ description: li.description, quantity: li.quantity, unitPrice: li.unit_price }));
}

export default function InvoiceFormModal({
  invoice,
  lineItems,
  customers,
  onClose,
  onSaved,
}: {
  invoice?: IssuedInvoiceRow;
  lineItems?: InvoiceLineItemRow[];
  customers: CustomerRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerId, setCustomerId] = useState<string>(invoice ? String(invoice.customer_id) : customers[0] ? String(customers[0].id) : "");
  const [currency, setCurrency] = useState(invoice?.currency ?? "OMR");
  const [date, setDate] = useState(invoice?.date ?? toMuscatDateInput(new Date()));
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? "");
  const [lines, setLines] = useState<DraftLine[]>(toDraftLines(lineItems));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = lines.reduce((sum, l) => {
    const qty = Number(l.quantity);
    const price = Number(l.unitPrice);
    return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
  }, 0);

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerId) {
      setError("Select a customer");
      return;
    }
    const parsedLines = lines.map((l) => ({
      description: l.description.trim(),
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
    }));
    if (parsedLines.some((l) => !Number.isFinite(l.quantity) || l.quantity <= 0 || !Number.isFinite(l.unitPrice) || l.unitPrice < 0)) {
      setError("Each line needs a positive quantity and a non-negative unit price");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(invoice ? `/api/invoices/${invoice.id}` : "/api/invoices", {
        method: invoice ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(customerId),
          currency,
          date,
          dueDate: dueDate || null,
          lineItems: parsedLines,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save invoice");
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
        className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">{invoice ? "Edit invoice" : "New invoice"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Customer</label>
            <select className={inputClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customers.length === 0 && (
                <option value="" className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
                  No customers yet
                </option>
              )}
              {customers.map((c) => (
                <option key={c.id} value={c.id} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Currency</label>
            <CurrencySelect className={inputClass} value={currency} onChange={setCurrency} />
          </div>
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
            <label className="text-sm font-medium">Due date (optional)</label>
            <input
              type="date"
              className={`${inputClass} dark:[color-scheme:dark]`}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Line items</label>
          {lines.map((line, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                className={`${inputClass} flex-1 min-w-[140px]`}
                placeholder="Description"
                value={line.description}
                onChange={(e) => updateLine(i, { description: e.target.value })}
              />
              <input
                type="number"
                step="0.01"
                className={`${inputClass} w-20`}
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => updateLine(i, { quantity: e.target.value })}
              />
              <input
                type="number"
                step="0.01"
                className={`${inputClass} w-28`}
                placeholder="Unit price"
                value={line.unitPrice}
                onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
              />
              <span className="text-xs text-black/50 dark:text-white/50 w-24 text-right shrink-0">
                {formatMoney((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), currency)}
              </span>
              <button
                type="button"
                onClick={() => removeLine(i)}
                disabled={lines.length === 1}
                className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-30 shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={addLine} className="text-xs text-accent hover:underline">
            + Add line
          </button>
        </div>

        <div className="flex justify-end text-sm font-semibold">Total: {formatMoney(total, currency)}</div>

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
              disabled={saving || customers.length === 0}
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
