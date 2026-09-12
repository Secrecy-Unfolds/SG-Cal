import type { IdeaRow } from "@/lib/ideas";
import { escapeHtml, introText, wrap } from "@/lib/emailShell";
import { formatDateOnly } from "@/lib/procurementDisplay";

const IDEA_COLOR = "#0f766e";

function ideaCard(idea: IdeaRow): string {
  const desc = idea.description?.trim()
    ? `<div style="margin-top:8px; font-size:13px; line-height:1.5; color:#4b5563; white-space:pre-wrap;">${escapeHtml(
        idea.description
      )}</div>`
    : "";
  const details = [
    `Expected start: <strong>${formatDateOnly(idea.expected_start_date)}</strong>`,
    idea.prerequisites ? `Pre-requisites: <strong>${escapeHtml(idea.prerequisites)}</strong>` : null,
  ]
    .filter(Boolean)
    .join(" &middot; ");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:4px; background:${IDEA_COLOR}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(idea.name)}</div>
          <div style="font-size:12px; color:#6b7280; margin-top:4px; line-height:1.6;">${details}</div>
          ${desc}
        </td>
      </tr>
    </table>`;
}

export function ideaCreatedEmail(idea: IdeaRow): { subject: string; html: string } {
  const who = idea.created_by_username ? escapeHtml(idea.created_by_username) : "Someone";
  return {
    subject: `New idea: ${idea.name}`,
    html: wrap(
      `${who} added a new idea: "${idea.name}"`,
      "New idea",
      introText(`${who} added a new idea:`) + ideaCard(idea)
    ),
  };
}

export function ideaUpdatedEmail(idea: IdeaRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `Updated idea: ${idea.name}`,
    html: wrap(
      `${whoSafe} updated "${idea.name}"`,
      "Idea updated",
      introText(`${whoSafe} made changes to this idea:`) + ideaCard(idea)
    ),
  };
}

export function ideaDeletedEmail(idea: IdeaRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  return {
    subject: `Deleted idea: ${idea.name}`,
    html: wrap(
      `${whoSafe} deleted "${idea.name}"`,
      "Idea deleted",
      introText(`${whoSafe} removed this idea:`) + ideaCard(idea)
    ),
  };
}
