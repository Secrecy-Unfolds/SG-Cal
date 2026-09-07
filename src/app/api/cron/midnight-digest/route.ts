import { NextRequest, NextResponse } from "next/server";
import { listEventsBetween } from "@/lib/events";
import { sendMail, getAllRecipientEmails } from "@/lib/mailer";
import { midnightDigestEmail } from "@/lib/emailTemplates";
import { muscatTodayRangeUTC } from "@/lib/time";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { start, end } = muscatTodayRangeUTC();
  const events = await listEventsBetween(start, end);
  if (events.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "no events today" });
  }

  const recipients = await getAllRecipientEmails();
  const { subject, html } = midnightDigestEmail(events);
  await sendMail({ to: recipients, subject, html });

  return NextResponse.json({ ok: true, sent: true, count: events.length });
}
