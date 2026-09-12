"use client";

import { useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import type { InventoryItemRow } from "@/lib/inventory";
import { ASSET_TYPES, ASSET_TYPE_LABELS, type AssetType } from "@/lib/inventoryDisplay";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function InventoryItemModal({
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  item?: InventoryItemRow;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEdit = !!item;

  const [name, setName] = useState(item?.name ?? "");
  const [assetType, setAssetType] = useState<AssetType>(item?.asset_type ?? "consumable");
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [quantityUnit, setQuantityUnit] = useState(item?.quantity_unit ?? "pcs");
  const [purchaseCost, setPurchaseCost] = useState(item?.purchase_cost ?? "");
  const [currency, setCurrency] = useState(item?.currency ?? "OMR");
  const [purchaseDate, setPurchaseDate] = useState(item?.purchase_date ?? "");
  const [currentValue, setCurrentValue] = useState(item?.current_value ?? "");
  const [location, setLocation] = useState(item?.location ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/inventory/${item!.id}` : "/api/inventory", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          assetType,
          quantity,
          quantityUnit,
          purchaseCost: purchaseCost === "" ? null : Number(purchaseCost),
          currency,
          purchaseDate: purchaseDate || null,
          currentValue: currentValue === "" ? null : Number(currentValue),
          location,
          notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save item");
        return;
      }
      onSaved();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    setConfirmingDelete(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/inventory/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete item");
        return;
      }
      onDeleted();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">{isEdit ? "Edit item" : "New item"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Asset type</label>
          <select
            className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`}
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as AssetType)}
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Quantity</label>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Unit</label>
            <input className={inputClass} value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Purchase cost</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={purchaseCost}
              onChange={(e) => setPurchaseCost(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Currency</label>
            <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Purchase date</label>
            <input
              type="date"
              className={`${inputClass} dark:[color-scheme:dark]`}
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Current value</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Location</label>
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Notes</label>
          <textarea className={`${inputClass} min-h-[60px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          {isEdit ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={deleting}
              className="text-sm text-red-600 dark:text-red-400 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-skew btn-glow px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-accent text-ink btn-skew btn-glow px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </form>

      {confirmingDelete && item && (
        <ConfirmModal
          title="Delete item"
          message={`Delete "${item.name}" from inventory?`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
