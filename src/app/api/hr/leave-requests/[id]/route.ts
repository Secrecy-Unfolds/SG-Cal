import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEmailsByIds, isAdminLevel } from "@/lib/users";
import { deleteLeaveRequest, decideLeaveRequest, getLeaveRequestById } from "@/lib/hr";
import { sendMailInBackground } from "@/lib/mailer";
import { leaveRequestDecidedEmail } from "@/lib/hrEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Admin-level only — approve or reject someone's leave request.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can decide this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getLeaveRequestById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "status must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const request = await decideLeaveRequest(id, { status, decidedBy: session.uid });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const recipients = await getEmailsByIds([request.user_id]);
  const { subject, html } = leaveRequestDecidedEmail(request, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ request });
}

// The requester can withdraw their own request, only while it's still pending.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getLeaveRequestById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.user_id !== session.uid) {
    return NextResponse.json({ error: "You can only cancel your own request" }, { status: 403 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Only a pending request can be canceled" }, { status: 400 });
  }

  await deleteLeaveRequest(id);
  return NextResponse.json({ ok: true });
}
