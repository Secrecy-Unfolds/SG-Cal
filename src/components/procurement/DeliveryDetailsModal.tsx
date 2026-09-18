"use client";

import { useState } from "react";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

// v2 Procurement workflow Phase 1: delivery tracking — carrier/tracking
// reference, expected arrival, and how much actually showed up vs. was
// ordered (a partial shipment). Independent of the status dropdown in
// PurchaseOrdersListClient.tsx, which still owns Ordered/In Transit/
// Received/Cancelled.
export default function DeliveryDetailsModal({
  po,
  onClose,
  onSaved,
}: {
  po: PurchaseOrderRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [carrier, setCarrier] = useState(po.carrier);
  const [trackingReference, setTrackingReference] = useState(po.tracking_reference);
  const [expectedArrival, setExpectedArrival] = useState(po.expected_arrival ?? "");
  const [quantityReceived, setQuantityReceived] = useState(po.quantity_received !== null ? String(po.quantity_received) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier,
          trackingReference,
          expectedArrival: expectedArrival || null,
          quantityReceived: quantityReceived === "" ? null : Number(quantityReceived),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save delivery details");
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
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">Delivery details</h2>
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
            <label className="text-sm font-medium">Carrier</label>
            <input className={inputClass} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. DHL" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Tracking reference</label>
            <input className={inputClass} value={trackingReference} onChange={(e) => setTrackingReference(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Expected arrival</label>
            <input
              type="date"
              className={`${inputClass} dark:[color-scheme:dark]`}
              value={expectedArrival}
              onChange={(e) => setExpectedArrival(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Quantity received</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={quantityReceived}
              onChange={(e) => setQuantityReceived(e.target.value)}
              placeholder={`of ${po.quantity} ordered`}
            />
          </div>
        </div>
        {quantityReceived !== "" && Number(quantityReceived) < po.quantity && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Partial shipment — {quantityReceived} of {po.quantity} {po.quantity_unit} received so far.
          </p>
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
