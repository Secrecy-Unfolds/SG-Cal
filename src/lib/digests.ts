import { listEventsForRecipient } from "@/lib/events";
import { getAllRecipients, sendMail } from "@/lib/mailer";
import { midnightDigestEmail, saturdayDigestEmail } from "@/lib/emailTemplates";
import { getMuscatNowParts } from "@/lib/time";
import { getDigestSettings, markSent, wasSentToday } from "@/lib/settings";

export type DigestOutcome = {
  attempted: boolean;
  sent: boolean;
  recipientsNotified: number;
  reason?: string;
};

async function sendDailyDigestNow(windowHours: number): Promise<number> {
  // A rolling look-ahead from the moment it actually sends, not a fixed
  // calendar-day window — so setting the send time earlier/later changes
  // what's included, not just when you're told about the same fixed day.
  const start = new Date();
  const end = new Date(start.getTime() + windowHours * 60 * 60 * 1000);
  const recipients = await getAllRecipients();
  let recipientsNotified = 0;
  for (const recipient of recipients) {
    const events = await listEventsForRecipient(start, end, recipient.id, recipient.role);
    if (events.length === 0) continue;
    const { subject, html } = midnightDigestEmail(events, windowHours);
    await sendMail({ to: [recipient.email], subject, html });
    recipientsNotified++;
  }
  return recipientsNotified;
}

async function sendWeeklyDigestNow(windowDays: number): Promise<number> {
  const start = new Date();
  const end = new Date(start.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const recipients = await getAllRecipients();
  let recipientsNotified = 0;
  for (const recipient of recipients) {
    const events = await listEventsForRecipient(start, end, recipient.id, recipient.role);
    if (events.length === 0) continue;
    const { subject, html } = saturdayDigestEmail(events, windowDays);
    await sendMail({ to: [recipient.email], subject, html });
    recipientsNotified++;
  }
  return recipientsNotified;
}

// Both digests are gated by Super-Admin-configurable settings (src/lib/settings.ts)
// instead of firing unconditionally, and guarded against sending twice in one
// day. This is what lets the same check run both from the two dedicated
// cron routes (still hit once/day by vercel.json, now a harmless fallback)
// and from the frequently-polled reminder-sweep endpoint — the sweep is what
// actually catches the configured time in practice, since vercel.json's
// schedule can't be changed without a redeploy.
export async function maybeSendDailyDigest(): Promise<DigestOutcome> {
  const { dateKey, hhmm } = getMuscatNowParts();
  const { midnightDigestTime, midnightDigestWindowHours } = await getDigestSettings();
  if (hhmm < midnightDigestTime) {
    return { attempted: false, sent: false, recipientsNotified: 0, reason: "not yet time" };
  }
  if (await wasSentToday("midnight", dateKey)) {
    return { attempted: false, sent: false, recipientsNotified: 0, reason: "already sent today" };
  }
  const recipientsNotified = await sendDailyDigestNow(midnightDigestWindowHours);
  await markSent("midnight", dateKey);
  return { attempted: true, sent: recipientsNotified > 0, recipientsNotified };
}

// No fallback default for the weekly digest's day/window — confirmed with
// the user that it should simply not fire until a Super Admin has actually
// set both in Settings, rather than assuming a value.
export async function maybeSendWeeklyDigest(): Promise<DigestOutcome> {
  const { dateKey, hhmm, weekday } = getMuscatNowParts();
  const { saturdayDigestTime, saturdayDigestWeekday, saturdayDigestWindowDays } = await getDigestSettings();
  if (saturdayDigestWeekday === null || saturdayDigestWindowDays === null) {
    return {
      attempted: false,
      sent: false,
      recipientsNotified: 0,
      reason: "weekly digest day/window not configured yet",
    };
  }
  if (weekday !== saturdayDigestWeekday) {
    return { attempted: false, sent: false, recipientsNotified: 0, reason: "not the configured day" };
  }
  if (hhmm < saturdayDigestTime) {
    return { attempted: false, sent: false, recipientsNotified: 0, reason: "not yet time" };
  }
  if (await wasSentToday("saturday", dateKey)) {
    return { attempted: false, sent: false, recipientsNotified: 0, reason: "already sent today" };
  }
  const recipientsNotified = await sendWeeklyDigestNow(saturdayDigestWindowDays);
  await markSent("saturday", dateKey);
  return { attempted: true, sent: recipientsNotified > 0, recipientsNotified };
}
