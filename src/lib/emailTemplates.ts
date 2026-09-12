import { EventRow, TASK_STATUS_LABELS } from "@/lib/events";
import { formatMuscatDateOnly, formatMuscatDateTime } from "@/lib/time";
import { escapeHtml, introText, wrap } from "@/lib/emailShell";

const TASK_COLOR = "#b45309";
const TASK_BG = "#fef3c7";
const MEETING_COLOR = "#1d4ed8";
const MEETING_BG = "#dbeafe";
const TENTATIVE_COLOR = "#7c3aed";
const TENTATIVE_BG = "#ede9fe";

function typeLabel(e: EventRow): string {
  if (e.type === "task") return "Task";
  return e.is_tentative ? "Tentative meeting" : "Meeting";
}

function cardAccentColor(e: EventRow): string {
  if (e.type === "task") return TASK_COLOR;
  return e.is_tentative ? TENTATIVE_COLOR : MEETING_COLOR;
}

function typeBadge(e: EventRow): string {
  const bg = e.type === "task" ? TASK_BG : e.is_tentative ? TENTATIVE_BG : MEETING_BG;
  const color = cardAccentColor(e);
  return `<span style="display:inline-block; font-size:11px; font-weight:700; letter-spacing:0.3px; text-transform:uppercase; color:${color}; background:${bg}; border-radius:999px; padding:2px 8px; margin-bottom:6px;">${typeLabel(
    e
  )}</span>`;
}

function eventWhenText(e: EventRow): string {
  if (e.is_tentative) {
    const from = formatMuscatDateOnly(new Date(e.start_at));
    const to = e.end_at ? formatMuscatDateOnly(new Date(e.end_at)) : from;
    return from === to ? `Tentative &mdash; possibly ${from}` : `Tentative &mdash; sometime between ${from} and ${to}`;
  }
  const when = formatMuscatDateTime(new Date(e.start_at));
  const endPart = e.end_at ? ` &ndash; ${formatMuscatDateTime(new Date(e.end_at))}` : "";
  return `${when}${endPart}`;
}

function taskMetaLine(e: EventRow): string {
  if (e.type !== "task") return "";
  const assignee = e.assignee_username ? escapeHtml(e.assignee_username) : "Unassigned";
  const statusLabel = TASK_STATUS_LABELS[e.status];
  return `<div style="margin-top:6px; font-size:12px; color:#6b7280;">Assigned to: <strong>${assignee}</strong> &middot; Status: <strong>${escapeHtml(
    statusLabel
  )}</strong></div>`;
}

function eventCard(e: EventRow): string {
  const desc = e.description?.trim()
    ? `<div style="margin-top:8px; font-size:13px; line-height:1.5; color:#4b5563; white-space:pre-wrap;">${escapeHtml(
        e.description
      )}</div>`
    : "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:4px; background:${cardAccentColor(e)}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div>${typeBadge(e)}</div>
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(e.title)}</div>
          <div style="font-size:13px; color:#6b7280; margin-top:2px;">${eventWhenText(e)}</div>
          ${taskMetaLine(e)}
          ${desc}
        </td>
      </tr>
    </table>`;
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

export function eventUpdatedEmail(e: EventRow, who: string): { subject: string; html: string } {
  const label = typeLabel(e).toLowerCase();
  const whoSafe = escapeHtml(who);
  return {
    subject: `Updated ${label}: ${e.title}`,
    html: wrap(
      `${whoSafe} updated "${e.title}"`,
      `${typeLabel(e)} updated`,
      introText(`${whoSafe} made changes to this ${label}. Here are the current details:`) + eventCard(e)
    ),
  };
}

export function meetingAttendeeRemovedEmail(e: EventRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `Removed from meeting: ${e.title}`,
    html: wrap(
      `${whoSafe} removed you from "${e.title}"`,
      "Removed from meeting",
      introText(`${whoSafe} removed you as an attendee of this meeting:`) + eventCard(e)
    ),
  };
}

export function eventCanceledEmail(e: EventRow, who: string): { subject: string; html: string } {
  const label = typeLabel(e).toLowerCase();
  const whoSafe = escapeHtml(who);
  return {
    subject: `Canceled ${label}: ${e.title}`,
    html: wrap(
      `${whoSafe} canceled "${e.title}"`,
      `${typeLabel(e)} canceled`,
      introText(`${whoSafe} removed this ${label} from the calendar. It was scheduled for:`) + eventCard(e)
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
