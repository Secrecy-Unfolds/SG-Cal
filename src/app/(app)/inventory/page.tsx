import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { listInventoryItems } from "@/lib/inventory";
import InventoryListClient from "@/components/inventory/InventoryListClient";

export default async function InventoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const isAdmin = isAdminLevel(session.role);
  // Organization structure Phase 4 (0.2.19): a plain user whose Department
  // maps to "inventory" can view this page too — VIEW-only.
  if (!isAdmin && !(await canAccessModule(session, "inventory"))) redirect("/");

  const items = await listInventoryItems();
  return <InventoryListClient items={items} isAdmin={isAdmin} />;
}
