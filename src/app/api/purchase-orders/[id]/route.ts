import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { isPOStatus, updatePurchaseOrderDelivery, updatePurchaseOrderStatus } from "@/lib/purchaseOrders";
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

  const recipients = await getAdminLevelRecipientEmails("procurement");
  const { subject, html } = purchaseOrderStatusChangedEmail(order, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ order });
}

// Delivery-tracking fields (carrier/tracking reference/quantity received/
// expected arrival) — independent of the status transition PUT handles
// above, no emails (this is informational record-keeping, not an action
// the rest of Admin-level needs to be notified about).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can update this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const carrier = typeof body?.carrier === "string" ? body.carrier.trim() : "";
  const trackingReference = typeof body?.trackingReference === "string" ? body.trackingReference.trim() : "";
  const quantityReceived =
    typeof body?.quantityReceived === "number" && Number.isFinite(body.quantityReceived) ? body.quantityReceived : null;
  const expectedArrival =
    typeof body?.expectedArrival === "string" && body.expectedArrival ? body.expectedArrival : null;

  const order = await updatePurchaseOrderDelivery(id, { carrier, trackingReference, quantityReceived, expectedArrival });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ order });
}
