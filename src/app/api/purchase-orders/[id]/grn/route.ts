import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { getPurchaseOrderById } from "@/lib/purchaseOrders";
import { createGoodsReceipt, listGoodsReceiptsForPO } from "@/lib/goodsReceipts";
import { getAdminLevelRecipientEmails, sendMailInBackground } from "@/lib/mailer";
import { getEmailsByIds } from "@/lib/users";
import { getDepartmentLeadershipEmails, resolvePurchaseDepartmentId } from "@/lib/orgNotify";
import { inventoryItemFromGrnEmail } from "@/lib/inventoryEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "procurement"))) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const receipts = await listGoodsReceiptsForPO(id);
  return NextResponse.json({ receipts });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can log a GRN" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const po = await getPurchaseOrderById(id);
  if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const dateReceived = typeof body?.dateReceived === "string" && body.dateReceived ? body.dateReceived : new Date().toISOString().slice(0, 10);
  const quantityReceived = Number.isFinite(body?.quantityReceived) ? body.quantityReceived : NaN;
  const conditionNotes = typeof body?.conditionNotes === "string" ? body.conditionNotes.trim() : "";

  if (!Number.isFinite(quantityReceived) || quantityReceived <= 0) {
    return NextResponse.json({ error: "A positive quantity received is required" }, { status: 400 });
  }

  const { receipt, inventoryItem } = await createGoodsReceipt({
    purchaseOrderId: id,
    dateReceived,
    quantityReceived,
    conditionNotes,
    receivedBy: session.uid,
  });

  // Categorized as "inventory", not "procurement" — see the parallel note
  // in the invoices route for why (this is a new-Inventory-item notice,
  // regardless of what triggered it). Org structure Phase 6 (confirmed
  // 2026-09-22): also always reaches the poster and the Manager + Director of
  // the department this purchase belongs to (the product's Project's
  // department, else the poster's own) — neither is preference-gated, see
  // lib/orgNotify.ts.
  const departmentId = await resolvePurchaseDepartmentId(po.product_id, session.uid);
  const recipients = Array.from(
    new Set([
      ...(await getAdminLevelRecipientEmails("inventory")),
      ...(await getEmailsByIds([session.uid])),
      ...(await getDepartmentLeadershipEmails(departmentId !== null ? [departmentId] : [])),
    ])
  );
  const { subject, html } = inventoryItemFromGrnEmail(inventoryItem, po, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ receipt }, { status: 201 });
}
