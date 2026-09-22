import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { listProducts, listVendors } from "@/lib/procurement";
import { listPurchaseOrders } from "@/lib/purchaseOrders";
import { listRequisitions } from "@/lib/purchaseRequisitions";
import ProcurementTabs from "@/components/procurement/ProcurementTabs";

export default async function ProcurementPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const isAdmin = isAdminLevel(session.role);
  // Organization structure Phase 4 (0.2.18): a plain user whose Department
  // maps to "procurement" can view this page too — VIEW-only, every write
  // stays Admin-level-only (see ProcurementTabs' own isAdmin prop).
  if (!isAdmin && !(await canAccessModule(session, "procurement"))) redirect("/");

  const [products, vendors, purchaseOrders, requisitions] = await Promise.all([
    listProducts(),
    listVendors(),
    listPurchaseOrders(),
    listRequisitions(),
  ]);

  return (
    <ProcurementTabs
      products={products}
      vendors={vendors}
      purchaseOrders={purchaseOrders}
      requisitions={requisitions}
      actorId={session.uid}
      isAdmin={isAdmin}
    />
  );
}
