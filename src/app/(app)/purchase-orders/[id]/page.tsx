import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { getPurchaseOrderById } from "@/lib/purchaseOrders";
import { listGoodsReceiptsForPO } from "@/lib/goodsReceipts";
import { listVendorInvoicesForPO } from "@/lib/vendorInvoices";
import { listPaymentsForInvoice } from "@/lib/vendorPayments";
import PurchaseOrderDetailClient from "@/components/procurement/PurchaseOrderDetailClient";

export default async function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const isAdmin = isAdminLevel(session.role);
  if (!isAdmin && !(await canAccessModule(session, "procurement"))) redirect("/");

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) redirect("/procurement");

  const po = await getPurchaseOrderById(id);
  if (!po) redirect("/procurement");

  const [receipts, invoices] = await Promise.all([listGoodsReceiptsForPO(id), listVendorInvoicesForPO(id)]);
  const paymentLists = await Promise.all(invoices.map((inv) => listPaymentsForInvoice(inv.id)));
  const payments = Object.fromEntries(invoices.map((inv, i) => [inv.id, paymentLists[i]]));

  return (
    <PurchaseOrderDetailClient po={po} receipts={receipts} invoices={invoices} payments={payments} isAdmin={isAdmin} />
  );
}
