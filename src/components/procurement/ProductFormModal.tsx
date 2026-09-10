"use client";

import { useRef, useState } from "react";
import {
  computeCapitalNeeded,
  formatMoney,
  PROCUREMENT_STATUSES,
  PROCUREMENT_STATUS_LABELS,
  ProcurementStatus,
} from "@/lib/procurementDisplay";

export type ProductData = {
  id: number;
  name: string;
  picture_url: string | null;
  description: string;
  required_for: string;
  required_by: string | null;
  quantity_needed: number;
  quantity_unit: string;
  customs_notes: string;
  unit_price: string | null;
  shipping_cost: string | null;
  customs_cost: string | null;
  currency: string;
  purchase_date_expected: string | null;
  expected_arrival: string | null;
  status: ProcurementStatus;
  preference_remarks: string;
};

export default function ProductFormModal({
  product,
  onClose,
  onSaved,
}: {
  product?: ProductData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!product;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(product?.name ?? "");
  const [pictureUrl, setPictureUrl] = useState<string | null>(product?.picture_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState(product?.description ?? "");
  const [requiredFor, setRequiredFor] = useState(product?.required_for ?? "");
  const [requiredBy, setRequiredBy] = useState(product?.required_by ?? "");
  const [quantityNeeded, setQuantityNeeded] = useState(product?.quantity_needed ?? 1);
  const [quantityUnit, setQuantityUnit] = useState(product?.quantity_unit ?? "pcs");
  const [customsNotes, setCustomsNotes] = useState(product?.customs_notes ?? "");
  const [unitPrice, setUnitPrice] = useState(product?.unit_price ?? "");
  const [shippingCost, setShippingCost] = useState(product?.shipping_cost ?? "");
  const [customsCost, setCustomsCost] = useState(product?.customs_cost ?? "");
  const [currency, setCurrency] = useState(product?.currency ?? "OMR");
  const [purchaseDateExpected, setPurchaseDateExpected] = useState(product?.purchase_date_expected ?? "");
  const [expectedArrival, setExpectedArrival] = useState(product?.expected_arrival ?? "");
  const [status, setStatus] = useState<ProcurementStatus>(product?.status ?? "planning");
  const [preferenceRemarks, setPreferenceRemarks] = useState(product?.preference_remarks ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computedCapital = computeCapitalNeeded({
    unitPrice: unitPrice === "" ? null : unitPrice,
    quantityNeeded,
    shippingCost: shippingCost === "" ? null : shippingCost,
    customsCost: customsCost === "" ? null : customsCost,
  });

  async function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/procurement/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to upload picture");
        return;
      }
      setPictureUrl(data.url);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Product name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/procurement/products/${product!.id}` : "/api/procurement/products", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          pictureUrl,
          description,
          requiredFor,
          requiredBy: requiredBy || null,
          quantityNeeded,
          quantityUnit,
          customsNotes,
          unitPrice: unitPrice === "" ? null : Number(unitPrice),
          shippingCost: shippingCost === "" ? null : Number(shippingCost),
          customsCost: customsCost === "" ? null : Number(customsCost),
          currency,
          purchaseDateExpected: purchaseDateExpected || null,
          expectedArrival: expectedArrival || null,
          status,
          preferenceRemarks,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save product");
        return;
      }
      onSaved();
    } catch {
      setError("Request timed out — check your connection and try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? "Edit product" : "New product"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Picture</label>
          <div className="flex items-center gap-3">
            {pictureUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pictureUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-black/10 dark:border-white/10" />
            )}
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePictureChange}
                disabled={uploading}
                className="text-sm w-full"
              />
              {uploading && <p className="text-xs text-black/40 dark:text-white/40 mt-1">Uploading…</p>}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Product name</label>
          <input
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm min-h-[70px] focus:outline-none focus:ring-2 focus:ring-accent"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Required for</label>
            <input
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              value={requiredFor}
              onChange={(e) => setRequiredFor(e.target.value)}
              placeholder="Project / purpose"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Required by</label>
            <input
              type="date"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm [color-scheme:light]"
              value={requiredBy}
              onChange={(e) => setRequiredBy(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Quantity</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              value={quantityNeeded}
              onChange={(e) => setQuantityNeeded(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Unit</label>
            <input
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              value={quantityUnit}
              onChange={(e) => setQuantityUnit(e.target.value)}
              placeholder="pcs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Status</label>
            <select
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm [color-scheme:light]"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProcurementStatus)}
            >
              {PROCUREMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROCUREMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Unit price</label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="Per unit"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Shipping cost</label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Customs cost</label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              value={customsCost}
              onChange={(e) => setCustomsCost(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium">Currency</label>
            <input
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="OMR"
            />
          </div>
          <div className="bg-black/[0.02] dark:bg-white/5 rounded-lg px-3 py-2">
            <div className="text-xs text-black/40 dark:text-white/40">Capital needed (calculated)</div>
            <div className="text-sm font-semibold">{formatMoney(computedCapital, currency)}</div>
          </div>
        </div>
        <p className="text-xs text-black/40 dark:text-white/40 -mt-2">
          Unit price × quantity + shipping cost + customs cost
        </p>

        <div className="space-y-1">
          <label className="text-sm font-medium">Customs notes</label>
          <input
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={customsNotes}
            onChange={(e) => setCustomsNotes(e.target.value)}
            placeholder="Duties %, clearance notes, HS code..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Purchase date (expected)</label>
            <input
              type="date"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm [color-scheme:light]"
              value={purchaseDateExpected}
              onChange={(e) => setPurchaseDateExpected(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Expected arrival</label>
            <input
              type="date"
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm [color-scheme:light]"
              value={expectedArrival}
              onChange={(e) => setExpectedArrival(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Preference remarks</label>
          <textarea
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-accent"
            value={preferenceRemarks}
            onChange={(e) => setPreferenceRemarks(e.target.value)}
            placeholder="Why the preferred vendor was chosen, or anything else worth noting"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
