"use client";

import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function RequisitionFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [quantityNeeded, setQuantityNeeded] = useState(1);
  const [quantityUnit, setQuantityUnit] = useState("pcs");
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!productName.trim()) {
      setError("Product name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/procurement/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: productName.trim(),
          description,
          quantityNeeded,
          quantityUnit,
          justification,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to submit requisition");
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
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">New requisition</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-black/40 dark:text-white/40">
          A requisition needs an Admin-level decision before it becomes a real Procurement Planning
          product. Approving it creates that product for you.
        </p>

        <div className="space-y-1">
          <label className="text-sm font-medium">Product name</label>
          <input className={inputClass} value={productName} onChange={(e) => setProductName(e.target.value)} autoFocus required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Quantity needed</label>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={quantityNeeded}
              onChange={(e) => setQuantityNeeded(Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Unit</label>
            <input className={inputClass} value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className={`${inputClass} min-h-[60px]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Justification</label>
          <textarea
            className={`${inputClass} min-h-[60px]`}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Why this is needed"
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
              {saving ? "Submitting..." : "Submit"}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}
