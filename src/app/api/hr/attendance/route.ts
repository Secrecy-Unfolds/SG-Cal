import { NextRequest, NextResponse } from "next/server";
import { getEmailsByIds } from "@/lib/users";
import { sendMailInBackground } from "@/lib/mailer";
import { attendanceChangedEmail } from "@/lib/hrEmailTemplates";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { adminCreateAttendance, listAllAttendance, listAttendanceForUser } from "@/lib/hr";

export const runtime = "nodejs";

// Own records by default; ?scope=all (Admin-level only) returns everyone's.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = new URL(req.url).searchParams.get("scope");
  if (scope === "all") {
    if (!isAdminLevel(session.role) && !(await canAccessModule(session, "hr"))) {
      return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
    }
    const records = await listAllAttendance();
    return NextResponse.json({ records });
  }

  const records = await listAttendanceForUser(session.uid);
  return NextResponse.json({ records });
}

// Admin-level only: add a day's record for an employee after the fact
// (e.g. they forgot to check in). `checkInAt`/`checkOutAt` are ISO instants.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit attendance" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "number" ? body.userId : null;
  const workDate = typeof body?.workDate === "string" ? body.workDate : "";
  const checkInAt = typeof body?.checkInAt === "string" ? new Date(body.checkInAt) : null;
  const checkOutAt = typeof body?.checkOutAt === "string" && body.checkOutAt ? new Date(body.checkOutAt) : null;

  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !checkInAt || isNaN(checkInAt.getTime())) {
    return NextResponse.json({ error: "Employee, date and check-in time are required" }, { status: 400 });
  }
  if (checkOutAt && isNaN(checkOutAt.getTime())) {
    return NextResponse.json({ error: "Invalid check-out time" }, { status: 400 });
  }

  const result = await adminCreateAttendance({ userId, workDate, checkInAt, checkOutAt, editedBy: session.uid });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  if (result.record.user_id !== session.uid) {
    const recipients = await getEmailsByIds([result.record.user_id]);
    const { subject, html } = attendanceChangedEmail("added", result.record, session.username);
    sendMailInBackground({ to: recipients, subject, html });
  }
  return NextResponse.json({ record: result.record }, { status: 201 });
}
