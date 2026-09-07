import { NextRequest, NextResponse } from "next/server";
import { listUpcomingEvents } from "@/lib/events";
import { sendMail, getAllRecipientEmails } from "@/lib/mailer";
import { saturdayDigestEmail } from "@/lib/emailTemplates";

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

  const events = await listUpcomingEvents(new Date());
  if (events.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "no upcoming events" });
  }

  const recipients = await getAllRecipientEmails();
  const { subject, html } = saturdayDigestEmail(events);
  await sendMail({ to: recipients, subject, html });

  return NextResponse.json({ ok: true, sent: true, count: events.length });
}
