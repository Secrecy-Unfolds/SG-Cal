import { EventRow } from "@/lib/events";
import { formatMuscatDateTime } from "@/lib/time";

const ACCENT = "#3b5bdb";
const TASK_COLOR = "#b45309";
const TASK_BG = "#fef3c7";
const MEETING_COLOR = "#1d4ed8";
const MEETING_BG = "#dbeafe";

function brandName(): string {
  return process.env.EMAIL_SENDER_NAME?.trim() || "Squad Calendar";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function typeLabel(e: EventRow): string {
  return e.type === "task" ? "Task" : "Meeting";
}

function typeBadge(e: EventRow): string {
  const isTask = e.type === "task";
  const bg = isTask ? TASK_BG : MEETING_BG;
  const color = isTask ? TASK_COLOR : MEETING_COLOR;
  return `<span style="display:inline-block; font-size:11px; font-weight:700; letter-spacing:0.3px; text-transform:uppercase; color:${color}; background:${bg}; border-radius:999px; padding:2px 8px; margin-bottom:6px;">${typeLabel(
    e
  )}</span>`;
}

function wrap(preheader: string, heading: string, bodyHtml: string): string {
  const brand = escapeHtml(brandName());
  return `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#f2f3f5;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f3f5; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="background:${ACCENT}; padding:22px 32px;">
                <span style="color:#ffffff; font-size:16px; font-weight:700; letter-spacing:0.2px;">${brand}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 18px; font-size:20px; line-height:1.3; color:#111827;">${escapeHtml(heading)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px; background:#f9fafb; border-top:1px solid #eef0f2;">
                <p style="margin:0; font-size:12px; color:#9aa0a6;">
                  Sent automatically by ${brand} &middot; times shown in Asia/Muscat
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function eventCard(e: EventRow): string {
  const when = formatMuscatDateTime(new Date(e.start_at));
  const endPart = e.end_at ? ` &ndash; ${formatMuscatDateTime(new Date(e.end_at))}` : "";
  const desc = e.description?.trim()
    ? `<div style="margin-top:8px; font-size:13px; line-height:1.5; color:#4b5563; white-space:pre-wrap;">${escapeHtml(
        e.description
      )}</div>`
    : "";
  const isTask = e.type === "task";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:4px; background:${isTask ? TASK_COLOR : MEETING_COLOR}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div>${typeBadge(e)}</div>
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(e.title)}</div>
          <div style="font-size:13px; color:#6b7280; margin-top:2px;">${when}${endPart}</div>
          ${desc}
        </td>
      </tr>
    </table>`;
}

function introText(text: string): string {
  return `<p style="margin:0 0 18px; font-size:14px; line-height:1.5; color:#4b5563;">${escapeHtml(text)}</p>`;
}

export function eventCreatedEmail(e: EventRow): { subject: string; html: string } {
  const who = e.created_by_username ? escapeHtml(e.created_by_username) : "Someone";
  const label = typeLabel(e).toLowerCase();
  return {
    subject: `New ${label}: ${e.title}`,
    html: wrap(
      `${who} just added "${e.title}" to the calendar`,
      `New ${label} added`,
      introText(`${who} added a new ${label} to the calendar:`) + eventCard(e)
    ),
  };
}

export function saturdayDigestEmail(events: EventRow[]): { subject: string; html: string } {
  const count = events.length;
  return {
    subject: `Get ready: ${count} upcoming item${count === 1 ? "" : "s"}`,
    html: wrap(
      `${count} upcoming item${count === 1 ? "" : "s"} to prepare for`,
      "This week's heads-up",
      introText("Here's everything on the calendar so you can start preparing:") +
        events.map(eventCard).join("")
    ),
  };
}

export function midnightDigestEmail(events: EventRow[]): { subject: string; html: string } {
  const count = events.length;
  return {
    subject: `Today: ${count} item${count === 1 ? "" : "s"}`,
    html: wrap(
      `${count} item${count === 1 ? "" : "s"} scheduled today`,
      "Today's schedule",
      events.map(eventCard).join("")
    ),
  };
}

export function meetingStartingSoonEmail(e: EventRow): { subject: string; html: string } {
  return {
    subject: `Starting in 1 hour: ${e.title}`,
    html: wrap(
      `"${e.title}" starts in about an hour`,
      "Meeting starting soon",
      introText("Heads up — this meeting starts in about an hour:") + eventCard(e)
    ),
  };
}

export function taskDueSoonEmail(e: EventRow): { subject: string; html: string } {
  return {
    subject: `Due in 3 hours: ${e.title}`,
    html: wrap(
      `"${e.title}" is due in about 3 hours`,
      "Task due soon",
      introText("Heads up — this task is due in about 3 hours:") + eventCard(e)
    ),
  };
}
