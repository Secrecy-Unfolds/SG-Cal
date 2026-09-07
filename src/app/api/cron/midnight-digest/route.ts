import { NextRequest, NextResponse } from "next/server";
import { listEventsBetween } from "@/lib/events";
import { sendMail, getAllRecipientEmails } from "@/lib/mailer";
import { midnightDigestEmail } from "@/lib/emailTemplates";
import { muscatTodayRangeUTC } from "@/lib/time";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
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
