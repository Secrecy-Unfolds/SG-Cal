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
import { maybeSendDailyDigest, maybeSendWeeklyDigest } from "@/lib/digests";
import { processRecurringExpenses } from "@/lib/recurringExpenses";
import { processRecurringIncome } from "@/lib/recurringIncome";
import {
  listStepsNeedingOverdueReminder,
  listStepsNeedingUpcomingReminder,
  markOverdueReminderSent,
  markUpcomingReminderSent,
} from "@/lib/planSteps";
import { stepOverdueEmail, stepUpcomingEmail } from "@/lib/planEmailTemplates";
import { listExpiringDocumentsNeedingReminder, markExpiryReminderSent } from "@/lib/hr";
import { documentExpiringEmail } from "@/lib/hrEmailTemplates";

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
  const adminEmails = await getAdminLevelRecipientEmails("calendar");

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

  // Phase 5 of the Process/Strategy/Idea workflow builder — an overdue
  // step's assignee (attendees, for a meeting) plus admin-level "Plans & Strategy" (still the
  // "ideas" category internally, see lib/notificationPreferencesDisplay.ts)
  // subscribers get notified, same shape as the task-due-soon reminder
  // above. Recipients are resolved per step, not hoisted out of the loop,
  // since each step can have a different assignee.
  const plansAdminEmails = await getAdminLevelRecipientEmails("ideas");

  // Upcoming (0.2.10): a task due within 3 hours / a meeting starting within
  // an hour. Mirrors Calendar's own recipients — a task's assignee plus
  // admin-level "Plans & Strategy" subscribers, but a meeting only goes to
  // its attendees (Calendar deliberately doesn't broadcast meeting reminders).
  // Calendar's own sweeps skip step-backed events, so nobody is emailed twice.
  const upcomingSteps = await listStepsNeedingUpcomingReminder();
  for (const step of upcomingSteps) {
    const recipients =
      step.step_type === "task"
        ? Array.from(
            new Set([
              ...(step.assignee_id !== null ? await getEmailsByIds([step.assignee_id]) : []),
              ...plansAdminEmails,
            ])
          )
        : await getEmailsByIds(step.attendee_ids);
    const { subject, html } = stepUpcomingEmail(step);
    sendMailInBackground({ to: recipients, subject, html });
    await markUpcomingReminderSent(step.id);
  }
  const overdueSteps = await listStepsNeedingOverdueReminder();
  for (const step of overdueSteps) {
    // A task's reminder goes to its assignee, a meeting's to its attendees.
    const personIds = step.step_type === "task" ? (step.assignee_id !== null ? [step.assignee_id] : []) : step.attendee_ids;
    const personEmails = await getEmailsByIds(personIds);
    const recipients = Array.from(new Set([...personEmails, ...plansAdminEmails]));
    const { subject, html } = stepOverdueEmail(step);
    sendMailInBackground({ to: recipients, subject, html });
    await markOverdueReminderSent(step.id);
  }

  // Organization structure Phase 5 (0.2.17): Civil ID / Passport / Visa /
  // Contract expiry reminders — the employee themselves (personal, not
  // preference-gated) plus Admin-level "hr" subscribers.
  const hrAdminEmails = await getAdminLevelRecipientEmails("hr");
  const expiringDocs = await listExpiringDocumentsNeedingReminder();
  for (const doc of expiringDocs) {
    const employeeEmails = await getEmailsByIds([doc.user_id]);
    const recipients = Array.from(new Set([...employeeEmails, ...hrAdminEmails]));
    const { subject, html } = documentExpiringEmail(doc.username, doc.kind, doc.expiry_date);
    sendMailInBackground({ to: recipients, subject, html });
    await markExpiryReminderSent(doc.user_id, doc.kind);
  }

  // The digests' actual configured send time (Super Admin Settings page) is
  // checked here, on every frequent external ping, rather than relying on
  // vercel.json's fixed once-a-day schedule — see src/lib/digests.ts.
  const dailyDigest = await maybeSendDailyDigest();
  const weeklyDigest = await maybeSendWeeklyDigest();

  // Expense management's recurring expenses, and Deeper accounting
  // structure's recurring income — see lib/recurringExpenses.ts /
  // lib/recurringIncome.ts.
  const recurringExpenses = await processRecurringExpenses();
  const recurringIncome = await processRecurringIncome();

  return NextResponse.json({
    ok: true,
    meetingsNotified: meetings.length,
    tasksNotified: tasks.length,
    upcomingStepsNotified: upcomingSteps.length,
    overdueStepsNotified: overdueSteps.length,
    expiringDocumentsNotified: expiringDocs.length,
    dailyDigest,
    weeklyDigest,
    recurringExpensesPosted: recurringExpenses.posted,
    recurringIncomePosted: recurringIncome.posted,
  });
}
