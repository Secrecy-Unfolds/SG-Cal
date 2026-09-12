"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InventoryItemModal from "@/components/inventory/InventoryItemModal";
import type { InventoryItemRow } from "@/lib/inventory";
import { ASSET_TYPE_BADGE_CLASS, ASSET_TYPE_LABELS } from "@/lib/inventoryDisplay";
import { formatDateOnly, formatMoney } from "@/lib/procurementDisplay";
import PageHeader from "@/components/hud/PageHeader";
import { HudFrameButton } from "@/components/hud/HudFrame";

export default function InventoryListClient({ items }: { items: InventoryItemRow[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<InventoryItemRow | null>(null);

  function afterChange() {
    setShowCreate(false);
    setEditing(null);
    router.refresh();
  }

  return (
    <div>
      <PageHeader label="INVENTORY" title="Inventory">
        <button
          onClick={() => setShowCreate(true)}
          className="bg-accent text-ink btn-skew btn-glow px-4 py-2 text-sm font-medium"
        >
          + Add Item
        </button>
      </PageHeader>

      {items.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          No inventory yet — items also appear automatically here once a Purchase Order is marked Received.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <HudFrameButton
              key={item.id}
              corners="tl-br"
              onClick={() => setEditing(item)}
              className="w-full text-left flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4 hover:border-accent/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate min-w-0">{item.name}</span>
                  <span
                    className={`shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${ASSET_TYPE_BADGE_CLASS[item.asset_type]}`}
                  >
                    {ASSET_TYPE_LABELS[item.asset_type]}
                  </span>
                </div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {item.quantity} {item.quantity_unit}
                  {item.location ? ` · ${item.location}` : ""}
                </div>
                <div className="text-xs text-black/40 dark:text-white/40 mt-0.5">
                  Purchased {formatDateOnly(item.purchase_date)} · Current value{" "}
                  {formatMoney(item.current_value, item.currency)}
                </div>
              </div>
            </HudFrameButton>
          ))}
        </div>
      )}

      {showCreate && <InventoryItemModal onClose={() => setShowCreate(false)} onSaved={afterChange} onDeleted={afterChange} />}
      {editing && (
        <InventoryItemModal item={editing} onClose={() => setEditing(null)} onSaved={afterChange} onDeleted={afterChange} />
      )}
    </div>
  );
}
