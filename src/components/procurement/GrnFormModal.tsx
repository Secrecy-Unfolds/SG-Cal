"use client";

import { useState } from "react";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function GrnFormModal({
  po,
  onClose,
  onSaved,
}: {
  po: PurchaseOrderRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().slice(0, 10));
  const [quantityReceived, setQuantityReceived] = useState(po.quantity);
  const [conditionNotes, setConditionNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/grn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateReceived, quantityReceived, conditionNotes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to log GRN");
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
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">Log GRN</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-black/40 dark:text-white/40">
          This creates the Inventory item for what actually arrived — using the quantity below,
          not necessarily the full ordered quantity.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Date received</label>
            <input
              type="date"
              className={`${inputClass} dark:[color-scheme:dark]`}
              value={dateReceived}
              onChange={(e) => setDateReceived(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Quantity received</label>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={quantityReceived}
              onChange={(e) => setQuantityReceived(Number(e.target.value) || 0)}
              required
            />
          </div>
        </div>
        {quantityReceived > 0 && quantityReceived < po.quantity && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Partial shipment — {quantityReceived} of {po.quantity} {po.quantity_unit} ordered.
          </p>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium">Condition / discrepancy notes</label>
          <textarea
            className={`${inputClass} min-h-[60px]`}
            value={conditionNotes}
            onChange={(e) => setConditionNotes(e.target.value)}
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
