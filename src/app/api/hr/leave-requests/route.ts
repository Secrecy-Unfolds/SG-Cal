import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createLeaveRequest, listAllLeaveRequests, listLeaveRequestsForUser } from "@/lib/hr";
import { sendMailInBackground, getAdminLevelRecipientEmails } from "@/lib/mailer";
import { leaveRequestSubmittedEmail } from "@/lib/hrEmailTemplates";

export const runtime = "nodejs";

// Own requests by default (used by the self-service Profile card, for
// anyone regardless of role — an Admin has their own leave requests too);
// ?scope=all (Admin-level only) returns everyone's, for the /hr management
// page. Same shape as GET /api/hr/attendance.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = new URL(req.url).searchParams.get("scope");
  if (scope === "all") {
    if (!isAdminLevel(session.role)) {
      return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
    }
    const requests = await listAllLeaveRequests();
    return NextResponse.json({ requests });
  }

  const requests = await listLeaveRequestsForUser(session.uid);
  return NextResponse.json({ requests });
}

// Any authenticated user can request leave — for themselves only.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const startDate = typeof body?.startDate === "string" ? body.startDate : "";
  const endDate = typeof body?.endDate === "string" ? body.endDate : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Start and end date are required" }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: "End date must be on or after the start date" }, { status: 400 });
  }

  const request = await createLeaveRequest({ userId: session.uid, startDate, endDate, reason });

  const recipients = await getAdminLevelRecipientEmails();
  const { subject, html } = leaveRequestSubmittedEmail(request);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ request }, { status: 201 });
}
