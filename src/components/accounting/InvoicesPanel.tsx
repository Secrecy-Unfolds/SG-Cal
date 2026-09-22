"use client";

import { useState } from "react";
import InvoicesClient from "@/components/accounting/InvoicesClient";
import CustomersClient from "@/components/accounting/CustomersClient";
import type { CustomerRow } from "@/lib/customers";
import type { IssuedInvoiceRow } from "@/lib/invoices";
import FolderTabs from "@/components/hud/FolderTabs";

type SubTab = "invoices" | "customers";

export default function InvoicesPanel({
  invoices,
  customers,
  isAdmin,
}: {
  invoices: IssuedInvoiceRow[];
  customers: CustomerRow[];
  isAdmin: boolean;
}) {
  const [subTab, setSubTab] = useState<SubTab>("invoices");

  return (
    <div>
      <FolderTabs
        tabs={[
          { key: "invoices", label: "Invoices" },
          { key: "customers", label: "Customers" },
        ]}
        active={subTab}
        onChange={setSubTab}
      />

      {subTab === "invoices" && <InvoicesClient invoices={invoices} customers={customers} isAdmin={isAdmin} />}
      {subTab === "customers" && <CustomersClient customers={customers} isAdmin={isAdmin} />}
    </div>
  );
}
