import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listInventoryItems } from "@/lib/inventory";
import InventoryListClient from "@/components/inventory/InventoryListClient";

export default async function InventoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminLevel(session.role)) redirect("/");

  const items = await listInventoryItems();
  return <InventoryListClient items={items} />;
}
