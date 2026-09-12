import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { isPOStatus, updatePurchaseOrderStatus } from "@/lib/purchaseOrders";
import { sendMailInBackground, getAdminLevelRecipientEmails } from "@/lib/mailer";
import { purchaseOrderStatusChangedEmail } from "@/lib/purchaseOrderEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can update this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!isPOStatus(body?.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const order = await updatePurchaseOrderStatus(id, body.status);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const recipients = await getAdminLevelRecipientEmails();
  const { subject, html } = purchaseOrderStatusChangedEmail(order, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ order });
}
