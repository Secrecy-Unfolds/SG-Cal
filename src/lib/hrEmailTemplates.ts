import type { LeaveRequestRow } from "@/lib/hr";
import { escapeHtml, introText, wrap } from "@/lib/emailShell";
import { LEAVE_STATUS_LABELS } from "@/lib/hrDisplay";
import { formatMuscatDateOnly } from "@/lib/time";

const LEAVE_COLOR = "#7c3aed";

function leaveCard(r: LeaveRequestRow): string {
  const range =
    r.start_date === r.end_date
      ? formatMuscatDateOnly(new Date(r.start_date))
      : `${formatMuscatDateOnly(new Date(r.start_date))} &ndash; ${formatMuscatDateOnly(new Date(r.end_date))}`;
  const reason = r.reason?.trim()
    ? `<div style="margin-top:8px; font-size:13px; line-height:1.5; color:#4b5563; white-space:pre-wrap;">${escapeHtml(
        r.reason
      )}</div>`
    : "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:4px; background:${LEAVE_COLOR}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(r.username)}</div>
          <div style="font-size:13px; color:#6b7280; margin-top:2px;">${range}</div>
          <div style="margin-top:6px; font-size:12px; color:#6b7280;">Status: <strong>${escapeHtml(
            LEAVE_STATUS_LABELS[r.status]
          )}</strong></div>
          ${reason}
        </td>
      </tr>
    </table>`;
}

export function leaveRequestSubmittedEmail(r: LeaveRequestRow): { subject: string; html: string } {
  return {
    subject: `Leave request: ${r.username}`,
    html: wrap(
      `${escapeHtml(r.username)} requested time off`,
      "New leave request",
      introText(`${escapeHtml(r.username)} submitted a new leave request:`) + leaveCard(r)
    ),
  };
}

export function leaveRequestDecidedEmail(r: LeaveRequestRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  const verb = r.status === "approved" ? "approved" : "rejected";
  return {
    subject: `Leave request ${verb}`,
    html: wrap(
      `${whoSafe} ${verb} your leave request`,
      `Leave request ${verb}`,
      introText(`${whoSafe} ${verb} this leave request:`) + leaveCard(r)
    ),
  };
}
