import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listProducts, listVendors } from "@/lib/procurement";
import ProcurementTabs from "@/components/procurement/ProcurementTabs";

export default async function ProcurementPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminLevel(session.role)) redirect("/");

  const [products, vendors] = await Promise.all([listProducts(), listVendors()]);

  return <ProcurementTabs products={products} vendors={vendors} />;
}
