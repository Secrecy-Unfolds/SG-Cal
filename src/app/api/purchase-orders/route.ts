import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createPurchaseOrderFromProduct, listPurchaseOrders } from "@/lib/purchaseOrders";
import { sendMailInBackground, getAdminLevelRecipientEmails } from "@/lib/mailer";
import { purchaseOrderCreatedEmail } from "@/lib/purchaseOrderEmailTemplates";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const orders = await listPurchaseOrders();
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can send products to Procurement" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const productId = typeof body?.productId === "number" ? body.productId : null;
  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const result = await createPurchaseOrderFromProduct(productId, session.uid);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const recipients = await getAdminLevelRecipientEmails();
  const { subject, html } = purchaseOrderCreatedEmail(result.po);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ order: result.po }, { status: 201 });
}
