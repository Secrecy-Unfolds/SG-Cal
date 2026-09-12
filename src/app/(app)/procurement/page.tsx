import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listProducts, listVendors } from "@/lib/procurement";
import { listPurchaseOrders } from "@/lib/purchaseOrders";
import ProcurementTabs from "@/components/procurement/ProcurementTabs";

export default async function ProcurementPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminLevel(session.role)) redirect("/");

  const [products, vendors, purchaseOrders] = await Promise.all([
    listProducts(),
    listVendors(),
    listPurchaseOrders(),
  ]);

  return <ProcurementTabs products={products} vendors={vendors} purchaseOrders={purchaseOrders} />;
}
