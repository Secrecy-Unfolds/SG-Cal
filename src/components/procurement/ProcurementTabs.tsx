"use client";

import { useState } from "react";
import ProcurementListClient from "@/components/procurement/ProcurementListClient";
import VendorsListClient from "@/components/procurement/VendorsListClient";
import type { ProductData } from "@/components/procurement/ProductFormModal";
import type { VendorWithProductsRow } from "@/lib/procurement";

type Tab = "products" | "vendors";

export default function ProcurementTabs({
  products,
  vendors,
}: {
  products: ProductData[];
  vendors: VendorWithProductsRow[];
}) {
  const [tab, setTab] = useState<Tab>("products");

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Procurement Planning</h1>

      <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm w-fit mb-4">
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`px-4 py-1.5 rounded-md font-medium transition-colors ${
            tab === "products" ? "bg-accent text-white" : "text-black/50 dark:text-white/50"
          }`}
        >
          Products
        </button>
        <button
          type="button"
          onClick={() => setTab("vendors")}
          className={`px-4 py-1.5 rounded-md font-medium transition-colors ${
            tab === "vendors" ? "bg-accent text-white" : "text-black/50 dark:text-white/50"
          }`}
        >
          Vendors
        </button>
      </div>

      {tab === "products" ? <ProcurementListClient products={products} /> : <VendorsListClient vendors={vendors} />}
    </div>
  );
}
