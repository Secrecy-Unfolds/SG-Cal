"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProductFormModal, { ProductData } from "@/components/procurement/ProductFormModal";
import {
  computeCapitalNeeded,
  formatDateOnly,
  formatMoney,
  PROCUREMENT_STATUS_BADGE_CLASS,
  PROCUREMENT_STATUS_LABELS,
} from "@/lib/procurementDisplay";

export default function ProcurementListClient({ products }: { products: ProductData[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => setShowCreate(true)}
          className="bg-accent text-ink btn-skew btn-glow px-4 py-2 text-sm font-medium"
        >
          + New Product
        </button>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No products yet — add the first one.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/procurement/${p.id}`}
              className="block bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl overflow-hidden hover:border-accent/40"
            >
              <div className="aspect-[16/9] bg-black/5 dark:bg-white/5 flex items-center justify-center">
                {p.picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.picture_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl text-black/20 dark:text-white/20">📦</span>
                )}
              </div>
              <div className="p-3 space-y-1">
                <span
                  className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${PROCUREMENT_STATUS_BADGE_CLASS[p.status]}`}
                >
                  {PROCUREMENT_STATUS_LABELS[p.status]}
                </span>
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  Needed by {formatDateOnly(p.required_by)}
                </div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {formatMoney(
                    computeCapitalNeeded({
                      unitPrice: p.unit_price,
                      quantityNeeded: p.quantity_needed,
                      shippingCost: p.shipping_cost,
                      customsCost: p.customs_cost,
                    }),
                    p.currency
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <ProductFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
