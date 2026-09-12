"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import { PO_STATUSES, PO_STATUS_BADGE_CLASS, PO_STATUS_LABELS, type POStatus } from "@/lib/purchaseOrdersDisplay";
import { computeCapitalNeeded, formatDateOnly, formatMoney } from "@/lib/procurementDisplay";
import { HudFrame } from "@/components/hud/HudFrame";

export default function PurchaseOrdersListClient({ orders }: { orders: PurchaseOrderRow[] }) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (orders.length === 0) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        No purchase orders yet — send a Planning product to Procurement from its detail page.
      </p>
    );
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
      <div className="space-y-2">
        {orders.map((po) => (
          <HudFrame
            key={po.id}
            corners="tl-br"
            className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="min-w-0 truncate text-sm font-medium">
                  {po.product_name} <span className="text-black/40 dark:text-white/40">#{po.id}</span>
                </span>
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
            </div>
            <select
              value={po.status}
              disabled={updatingId === po.id}
              onChange={(e) => changeStatus(po.id, e.target.value as POStatus)}
              className="shrink-0 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-xs [color-scheme:light] dark:[color-scheme:dark]"
            >
              {PO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PO_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </HudFrame>
        ))}
      </div>
    </div>
  );
}
