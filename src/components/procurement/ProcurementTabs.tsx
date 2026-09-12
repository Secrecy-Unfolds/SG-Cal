"use client";

import { useState } from "react";
import ProcurementListClient from "@/components/procurement/ProcurementListClient";
import VendorsListClient from "@/components/procurement/VendorsListClient";
import PurchaseOrdersListClient from "@/components/procurement/PurchaseOrdersListClient";
import type { ProductData } from "@/components/procurement/ProductFormModal";
import type { VendorWithProductsRow } from "@/lib/procurement";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import PageHeader from "@/components/hud/PageHeader";

type Tab = "products" | "vendors" | "orders";

export default function ProcurementTabs({
  products,
  vendors,
  purchaseOrders,
}: {
  products: ProductData[];
  vendors: VendorWithProductsRow[];
  purchaseOrders: PurchaseOrderRow[];
}) {
  const [tab, setTab] = useState<Tab>("products");

  return (
    <div>
      <PageHeader label="PROCUREMENT" title="Procurement Planning" />

      <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm w-fit mb-4">
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`px-4 py-1.5 rounded-md font-mono text-xs font-semibold uppercase tracking-wide transition-colors ${
            tab === "products" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
          }`}
        >
          Products
        </button>
        <button
          type="button"
          onClick={() => setTab("vendors")}
          className={`px-4 py-1.5 rounded-md font-mono text-xs font-semibold uppercase tracking-wide transition-colors ${
            tab === "vendors" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
          }`}
        >
          Vendors
        </button>
        <button
          type="button"
          onClick={() => setTab("orders")}
          className={`px-4 py-1.5 rounded-md font-mono text-xs font-semibold uppercase tracking-wide transition-colors ${
            tab === "orders" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
          }`}
        >
          Purchase Orders
        </button>
      </div>

      {tab === "products" && <ProcurementListClient products={products} />}
      {tab === "vendors" && <VendorsListClient vendors={vendors} />}
      {tab === "orders" && <PurchaseOrdersListClient orders={purchaseOrders} />}
    </div>
  );
}
