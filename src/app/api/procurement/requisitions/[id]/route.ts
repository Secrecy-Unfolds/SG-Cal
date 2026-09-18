import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEmailsByIds, isAdminLevel } from "@/lib/users";
import { decideRequisition, deleteRequisition, getRequisitionById } from "@/lib/purchaseRequisitions";
import { sendMailInBackground } from "@/lib/mailer";
import { requisitionDecidedEmail } from "@/lib/procurementEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Any Admin-level can decide — confirmed, not Super-Admin-only.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can decide this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getRequisitionById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Only a pending requisition can be decided" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "status must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const requisition = await decideRequisition(id, { status, decidedBy: session.uid });
  if (!requisition) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (requisition.requested_by) {
    const recipients = await getEmailsByIds([requisition.requested_by]);
    const { subject, html } = requisitionDecidedEmail(requisition, session.username);
    sendMailInBackground({ to: recipients, subject, html });
  }

  return NextResponse.json({ requisition });
}

// The requester can withdraw their own requisition, only while still pending.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getRequisitionById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.requested_by !== session.uid) {
    return NextResponse.json({ error: "You can only withdraw your own requisition" }, { status: 403 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Only a pending requisition can be withdrawn" }, { status: 400 });
  }

  await deleteRequisition(id);
  return NextResponse.json({ ok: true });
}
