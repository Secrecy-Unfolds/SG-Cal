import { NextRequest, NextResponse } from "next/server";
import {
  listMeetingsNeedingStartReminder,
  listTasksNeedingEndReminder,
  markStartReminderSent,
  markEndReminderSent,
} from "@/lib/events";
import { sendMailInBackground, getAllRecipientEmails } from "@/lib/mailer";
import { meetingStartingSoonEmail, taskDueSoonEmail } from "@/lib/emailTemplates";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

export const runtime = "nodejs";

// Meant to be called every 10-15 minutes by an external scheduler (e.g.
// cron-job.org) since these reminders fire at arbitrary times of day, not on
// a fixed daily/weekly schedule like the other two cron routes.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipients = await getAllRecipientEmails();

  // Fire each email in the background and mark it sent right away — a slow
  // or failing send from the relay shouldn't block marking the reminder
  // (or hold up the rest of this sweep's items behind it).
  const meetings = await listMeetingsNeedingStartReminder();
  for (const meeting of meetings) {
    const { subject, html } = meetingStartingSoonEmail(meeting);
    sendMailInBackground({ to: recipients, subject, html });
    await markStartReminderSent(meeting.id);
  }

  const tasks = await listTasksNeedingEndReminder();
  for (const task of tasks) {
    const { subject, html } = taskDueSoonEmail(task);
    sendMailInBackground({ to: recipients, subject, html });
    await markEndReminderSent(task.id);
  }

  return NextResponse.json({
    ok: true,
    meetingsNotified: meetings.length,
    tasksNotified: tasks.length,
  });
}
