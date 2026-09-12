"use client";

import { useState } from "react";
import ProcurementListClient from "@/components/procurement/ProcurementListClient";
import VendorsListClient from "@/components/procurement/VendorsListClient";
import PurchaseOrdersListClient from "@/components/procurement/PurchaseOrdersListClient";
import type { ProductData } from "@/components/procurement/ProductFormModal";
import type { VendorWithProductsRow } from "@/lib/procurement";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import PageHeader from "@/components/hud/PageHeader";
import FolderTabs from "@/components/hud/FolderTabs";

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

      <FolderTabs
        tabs={[
          { key: "products", label: "Products" },
          { key: "vendors", label: "Vendors" },
          { key: "orders", label: "Purchase Orders" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "products" && <ProcurementListClient products={products} />}
      {tab === "vendors" && <VendorsListClient vendors={vendors} />}
      {tab === "orders" && <PurchaseOrdersListClient orders={purchaseOrders} />}
    </div>
  );
}
