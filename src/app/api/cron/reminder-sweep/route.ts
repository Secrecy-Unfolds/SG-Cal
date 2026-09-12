import { NextRequest, NextResponse } from "next/server";
import {
  listMeetingsNeedingStartReminder,
  listTasksNeedingEndReminder,
  markStartReminderSent,
  markEndReminderSent,
} from "@/lib/events";
import { getEmailsByIds } from "@/lib/users";
import { sendMailInBackground, getAdminLevelRecipientEmails } from "@/lib/mailer";
import { meetingStartingSoonEmail, taskDueSoonEmail } from "@/lib/emailTemplates";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { maybeSendMidnightDigest, maybeSendSaturdayDigest } from "@/lib/digests";

export const runtime = "nodejs";

// Meant to be called every 10-15 minutes by an external scheduler (e.g.
// cron-job.org) since these reminders fire at arbitrary times of day, not on
// a fixed daily/weekly schedule like the other two cron routes.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Meeting reminders go only to that meeting's attendees; task reminders go
  // to the assignee plus admin-level users (who can already see/manage every
  // task). Neither broadcasts to every user anymore.
  const adminEmails = await getAdminLevelRecipientEmails();

  // Fire each email in the background and mark it sent right away — a slow
  // or failing send from the relay shouldn't block marking the reminder
  // (or hold up the rest of this sweep's items behind it).
  const meetings = await listMeetingsNeedingStartReminder();
  for (const meeting of meetings) {
    const recipients = await getEmailsByIds(meeting.attendees.map((a) => a.id));
    const { subject, html } = meetingStartingSoonEmail(meeting);
    sendMailInBackground({ to: recipients, subject, html });
    await markStartReminderSent(meeting.id);
  }

  const tasks = await listTasksNeedingEndReminder();
  for (const task of tasks) {
    const assigneeEmails = task.assignee_id ? await getEmailsByIds([task.assignee_id]) : [];
    const recipients = Array.from(new Set([...assigneeEmails, ...adminEmails]));
    const { subject, html } = taskDueSoonEmail(task);
    sendMailInBackground({ to: recipients, subject, html });
    await markEndReminderSent(task.id);
  }

  // The digests' actual configured send time (Super Admin Settings page) is
  // checked here, on every frequent external ping, rather than relying on
  // vercel.json's fixed once-a-day schedule — see src/lib/digests.ts.
  const midnightDigest = await maybeSendMidnightDigest();
  const saturdayDigest = await maybeSendSaturdayDigest();

  return NextResponse.json({
    ok: true,
    meetingsNotified: meetings.length,
    tasksNotified: tasks.length,
    midnightDigest,
    saturdayDigest,
  });
}
