import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listProducts } from "@/lib/procurement";
import ProcurementListClient from "@/components/procurement/ProcurementListClient";

export default async function ProcurementPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminLevel(session.role)) redirect("/");

  const products = await listProducts();

  return <ProcurementListClient products={products} />;
}
