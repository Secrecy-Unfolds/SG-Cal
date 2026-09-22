import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEmailsByIds, isAdminLevel } from "@/lib/users";
import { adminDeleteAttendance, adminUpdateAttendance, getAttendanceById } from "@/lib/hr";
import { sendMailInBackground } from "@/lib/mailer";
import { attendanceChangedEmail } from "@/lib/hrEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Admin-level only. Edits a record's times (employee and date stay fixed).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit attendance" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const checkInAt = typeof body?.checkInAt === "string" ? new Date(body.checkInAt) : null;
  const checkOutAt = typeof body?.checkOutAt === "string" && body.checkOutAt ? new Date(body.checkOutAt) : null;
  if (!checkInAt || isNaN(checkInAt.getTime())) {
    return NextResponse.json({ error: "A check-in time is required" }, { status: 400 });
  }
  if (checkOutAt && isNaN(checkOutAt.getTime())) {
    return NextResponse.json({ error: "Invalid check-out time" }, { status: 400 });
  }

  const result = await adminUpdateAttendance(id, { checkInAt, checkOutAt, editedBy: session.uid });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.notFound ? 404 : 400 });

  if (result.record.user_id !== session.uid) {
    const recipients = await getEmailsByIds([result.record.user_id]);
    const { subject, html } = attendanceChangedEmail("edited", result.record, session.username);
    sendMailInBackground({ to: recipients, subject, html });
  }
  return NextResponse.json({ record: result.record });
}

// Admin-level only. Removing a record is how a day is marked absent — a day
// with no row IS an absence in this app.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit attendance" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getAttendanceById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await adminDeleteAttendance(id);

  if (existing.user_id !== session.uid) {
    const recipients = await getEmailsByIds([existing.user_id]);
    const { subject, html } = attendanceChangedEmail("removed", existing, session.username);
    sendMailInBackground({ to: recipients, subject, html });
  }
  return NextResponse.json({ ok: true });
}
