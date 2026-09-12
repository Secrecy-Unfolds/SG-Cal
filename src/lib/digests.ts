import { listEventsForRecipient, listUpcomingEventsForRecipient } from "@/lib/events";
import { getAllRecipients, sendMail } from "@/lib/mailer";
import { midnightDigestEmail, saturdayDigestEmail } from "@/lib/emailTemplates";
import { getMuscatNowParts, muscatTodayRangeUTC } from "@/lib/time";
import { getDigestSettings, markSent, wasSentToday } from "@/lib/settings";

export type DigestOutcome = {
  attempted: boolean;
  sent: boolean;
  recipientsNotified: number;
  reason?: string;
};

async function sendMidnightDigestNow(): Promise<number> {
  const { start, end } = muscatTodayRangeUTC();
  const recipients = await getAllRecipients();
  let recipientsNotified = 0;
  for (const recipient of recipients) {
    const events = await listEventsForRecipient(start, end, recipient.id, recipient.role);
    if (events.length === 0) continue;
    const { subject, html } = midnightDigestEmail(events);
    await sendMail({ to: [recipient.email], subject, html });
    recipientsNotified++;
  }
  return recipientsNotified;
}

async function sendSaturdayDigestNow(): Promise<number> {
  const recipients = await getAllRecipients();
  let recipientsNotified = 0;
  for (const recipient of recipients) {
    const events = await listUpcomingEventsForRecipient(new Date(), recipient.id, recipient.role);
    if (events.length === 0) continue;
    const { subject, html } = saturdayDigestEmail(events);
    await sendMail({ to: [recipient.email], subject, html });
    recipientsNotified++;
  }
  return recipientsNotified;
}

// Both digests are gated by a Super-Admin-configurable time (src/lib/settings.ts)
// instead of firing unconditionally, and guarded against sending twice in one
// day. This is what lets the same time check run both from the two dedicated
// cron routes (still hit once/day by vercel.json, now a harmless fallback)
// and from the frequently-polled reminder-sweep endpoint — the sweep is what
// actually catches the configured time in practice, since vercel.json's
// schedule can't be changed without a redeploy.
export async function maybeSendMidnightDigest(): Promise<DigestOutcome> {
  const { dateKey, hhmm } = getMuscatNowParts();
  const { midnightDigestTime } = await getDigestSettings();
  if (hhmm < midnightDigestTime) {
    return { attempted: false, sent: false, recipientsNotified: 0, reason: "not yet time" };
  }
  if (await wasSentToday("midnight", dateKey)) {
    return { attempted: false, sent: false, recipientsNotified: 0, reason: "already sent today" };
  }
  const recipientsNotified = await sendMidnightDigestNow();
  await markSent("midnight", dateKey);
  return { attempted: true, sent: recipientsNotified > 0, recipientsNotified };
}

export async function maybeSendSaturdayDigest(): Promise<DigestOutcome> {
  const { dateKey, hhmm, weekday } = getMuscatNowParts();
  if (weekday !== 6) {
    return { attempted: false, sent: false, recipientsNotified: 0, reason: "not Saturday" };
  }
  const { saturdayDigestTime } = await getDigestSettings();
  if (hhmm < saturdayDigestTime) {
    return { attempted: false, sent: false, recipientsNotified: 0, reason: "not yet time" };
  }
  if (await wasSentToday("saturday", dateKey)) {
    return { attempted: false, sent: false, recipientsNotified: 0, reason: "already sent today" };
  }
  const recipientsNotified = await sendSaturdayDigestNow();
  await markSent("saturday", dateKey);
  return { attempted: true, sent: recipientsNotified > 0, recipientsNotified };
}
