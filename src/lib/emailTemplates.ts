import { EventRow } from "@/lib/events";
import { formatMuscatDateTime } from "@/lib/time";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrap(title: string, bodyHtml: string): string {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
    <h2 style="margin-bottom: 4px;">${title}</h2>
    ${bodyHtml}
    <p style="margin-top: 32px; font-size: 12px; color: #888;">Squad Calendar &middot; times shown in Asia/Muscat</p>
  </div>`;
}

function eventBlock(e: EventRow): string {
  const when = formatMuscatDateTime(new Date(e.start_at));
  const endPart = e.end_at ? ` &ndash; ${formatMuscatDateTime(new Date(e.end_at))}` : "";
  const desc = e.description?.trim()
    ? `<p style="margin: 4px 0 0; color: #444; white-space: pre-wrap;">${escapeHtml(e.description)}</p>`
    : "";
  return `
    <div style="padding: 12px 0; border-bottom: 1px solid #eee;">
      <div style="font-weight: 600;">${escapeHtml(e.title)}</div>
      <div style="font-size: 13px; color: #666;">${when}${endPart}</div>
      ${desc}
    </div>`;
}

export function eventCreatedEmail(e: EventRow): { subject: string; html: string } {
  const who = e.created_by_username ? escapeHtml(e.created_by_username) : "Someone";
  return {
    subject: `New event: ${e.title}`,
    html: wrap(
      `New event added by ${who}`,
      eventBlock(e)
    ),
  };
}

export function saturdayDigestEmail(events: EventRow[]): { subject: string; html: string } {
  return {
    subject: `Get ready: ${events.length} upcoming event${events.length === 1 ? "" : "s"}`,
    html: wrap(
      "This week's heads-up",
      `<p style="color:#444;">Here's everything on the calendar so you can start preparing:</p>` +
        events.map(eventBlock).join("")
    ),
  };
}

export function midnightDigestEmail(events: EventRow[]): { subject: string; html: string } {
  return {
    subject: `Today: ${events.length} event${events.length === 1 ? "" : "s"}`,
    html: wrap(
      "Today's events",
      events.map(eventBlock).join("")
    ),
  };
}
