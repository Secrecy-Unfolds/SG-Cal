"use client";

import { useState } from "react";
import ProcurementListClient from "@/components/procurement/ProcurementListClient";
import VendorsListClient from "@/components/procurement/VendorsListClient";
import PurchaseOrdersListClient from "@/components/procurement/PurchaseOrdersListClient";
import RequisitionsListClient from "@/components/procurement/RequisitionsListClient";
import type { ProductData } from "@/components/procurement/ProductFormModal";
import type { VendorWithProductsRow } from "@/lib/procurement";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import type { PurchaseRequisitionRow } from "@/lib/purchaseRequisitions";
import PageHeader from "@/components/hud/PageHeader";
import FolderTabs from "@/components/hud/FolderTabs";

type Tab = "products" | "vendors" | "orders" | "requisitions";

export default function ProcurementTabs({
  products,
  vendors,
  purchaseOrders,
  requisitions,
  actorId,
}: {
  products: ProductData[];
  vendors: VendorWithProductsRow[];
  purchaseOrders: PurchaseOrderRow[];
  requisitions: PurchaseRequisitionRow[];
  actorId: number;
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
          { key: "requisitions", label: "Requisitions" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "products" && <ProcurementListClient products={products} />}
      {tab === "vendors" && <VendorsListClient vendors={vendors} />}
      {tab === "orders" && <PurchaseOrdersListClient orders={purchaseOrders} />}
      {tab === "requisitions" && <RequisitionsListClient requisitions={requisitions} actorId={actorId} />}
    </div>
  );
}
