"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import { PO_STATUSES, PO_STATUS_BADGE_CLASS, PO_STATUS_LABELS, type POStatus } from "@/lib/purchaseOrdersDisplay";
import { computeCapitalNeeded, formatDateOnly, formatMoney } from "@/lib/procurementDisplay";
import { HudFrame } from "@/components/hud/HudFrame";
import DeliveryDetailsModal from "@/components/procurement/DeliveryDetailsModal";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default function PurchaseOrdersListClient({ orders }: { orders: PurchaseOrderRow[] }) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingDelivery, setEditingDelivery] = useState<PurchaseOrderRow | null>(null);
  const [reportStart, setReportStart] = useState(firstOfMonth());
  const [reportEnd, setReportEnd] = useState(new Date().toISOString().slice(0, 10));

  async function changeStatus(id: number, status: POStatus) {
    setUpdatingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to update status");
        return;
      }
      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <HudFrame
        corners="all"
        className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4 mb-4 flex flex-wrap items-end gap-3"
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-black/50 dark:text-white/50">From</label>
          <input
            type="date"
            value={reportStart}
            onChange={(e) => setReportStart(e.target.value)}
            className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-xs [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-black/50 dark:text-white/50">To</label>
          <input
            type="date"
            value={reportEnd}
            onChange={(e) => setReportEnd(e.target.value)}
            className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-xs [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>
        <a
          href={`/api/procurement/reports/pdf?periodStart=${reportStart}&periodEnd=${reportEnd}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent hover:underline"
        >
          Download volume/spend report (PDF)
        </a>
      </HudFrame>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {orders.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          No purchase orders yet — send a Planning product to Procurement from its detail page.
        </p>
      ) : (
      <div className="space-y-2">
        {orders.map((po) => (
          <HudFrame
            key={po.id}
            corners="tl-br"
            className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Link href={`/purchase-orders/${po.id}`} className="min-w-0 truncate text-sm font-medium hover:underline">
                  {po.product_name} <span className="text-black/40 dark:text-white/40">#{po.id}</span>
                </Link>
                <span
                  className={`shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${PO_STATUS_BADGE_CLASS[po.status]}`}
                >
                  {PO_STATUS_LABELS[po.status]}
                </span>
              </div>
              <div className="text-xs text-black/50 dark:text-white/50 truncate">
                Vendor: {po.vendor_name} · Ordered {formatDateOnly(po.order_date)}
              </div>
              <div className="text-xs text-black/40 dark:text-white/40 mt-0.5">
                {po.quantity} {po.quantity_unit} ·{" "}
                {formatMoney(
                  computeCapitalNeeded({
                    unitPrice: po.unit_price,
                    quantityNeeded: po.quantity,
                    shippingCost: po.shipping_cost,
                    customsCost: po.customs_cost,
                  }),
                  po.currency
                )}
              </div>
              <div className="text-xs text-black/40 dark:text-white/40 mt-0.5 truncate">
                {po.expected_arrival ? `Expected ${formatDateOnly(po.expected_arrival)}` : "No expected arrival set"}
                {po.carrier ? ` · ${po.carrier}` : ""}
                {po.tracking_reference ? ` · ${po.tracking_reference}` : ""}
                {po.quantity_received !== null && po.quantity_received < po.quantity && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {" "}
                    · Partial: {po.quantity_received}/{po.quantity} received
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2">
              {po.status === "closed" ? (
                <span className="text-xs text-black/40 dark:text-white/40">Closed — no further edits</span>
              ) : (
                <>
                  <select
                    value={po.status}
                    disabled={updatingId === po.id}
                    onChange={(e) => changeStatus(po.id, e.target.value as POStatus)}
                    className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-xs [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    {PO_STATUSES.map((s) => (
                      <option
                        key={s}
                        className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100"
                        value={s}
                      >
                        {PO_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setEditingDelivery(po)}
                    className="text-xs text-accent hover:underline"
                  >
                    Delivery details
                  </button>
                </>
              )}
              <Link href={`/purchase-orders/${po.id}`} className="text-xs text-accent hover:underline">
                GRN / Invoices / Closure →
              </Link>
            </div>
          </HudFrame>
        ))}
      </div>
      )}

      {editingDelivery && (
        <DeliveryDetailsModal
          po={editingDelivery}
          onClose={() => setEditingDelivery(null)}
          onSaved={() => {
            setEditingDelivery(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
