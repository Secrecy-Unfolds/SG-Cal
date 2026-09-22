import type { AttendanceRecordRow, LeaveRequestRow } from "@/lib/hr";
import { escapeHtml, introText, wrap } from "@/lib/emailShell";
import { LEAVE_STATUS_LABELS, formatDays } from "@/lib/hrDisplay";
import { formatMuscatDateOnly, formatMuscatDateTime } from "@/lib/time";

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

export function leaveRequestSubmittedEmail(
  r: LeaveRequestRow,
  extra?: { days: number; remaining: number | null; exceedsBalance: boolean }
): { subject: string; html: string } {
  let note = "";
  if (extra) {
    const balanceLine =
      extra.remaining === null
        ? "No annual allowance is set for this employee."
        : extra.exceedsBalance
        ? `<strong style="color:#b45309;">This is more than their remaining balance</strong> (${formatDays(
            extra.remaining
          )} left).`
        : `They have ${formatDays(extra.remaining)} left before this request.`;
    note = introText(`Working days requested: <strong>${formatDays(extra.days)}</strong> (Sun&ndash;Thu, excluding public holidays). ${balanceLine}`);
  }
  return {
    subject: `Leave request: ${r.username}`,
    html: wrap(
      `${escapeHtml(r.username)} requested time off`,
      "New leave request",
      introText(`${escapeHtml(r.username)} submitted a new leave request:`) + leaveCard(r) + note
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

// Sent to the EMPLOYEE when an Admin adds, edits or removes their attendance
// for a day (a personal "about your own record" email — not category-gated,
// same as the leave-decided email).
export function attendanceChangedEmail(
  kind: "added" | "edited" | "removed",
  r: Pick<AttendanceRecordRow, "username" | "work_date" | "check_in_at" | "check_out_at">,
  who: string
): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  const day = formatMuscatDateOnly(new Date(r.work_date));
  const verb = kind === "added" ? "added" : kind === "edited" ? "updated" : "removed";
  const detail =
    kind === "removed"
      ? "That day now shows as no attendance recorded."
      : `Check in: <strong>${formatMuscatDateTime(new Date(r.check_in_at))}</strong> &middot; Check out: <strong>${
          r.check_out_at ? formatMuscatDateTime(new Date(r.check_out_at)) : "&mdash;"
        }</strong>`;
  return {
    subject: `Attendance ${verb}: ${day}`,
    html: wrap(
      `${whoSafe} ${verb} your attendance for ${day}`,
      `Attendance ${verb}`,
      introText(`${whoSafe} ${verb} your attendance record for <strong>${day}</strong>.`) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
          <tr>
            <td style="width:4px; background:${LEAVE_COLOR}; border-radius:4px; font-size:0;">&nbsp;</td>
            <td style="padding:2px 0 12px 14px; font-size:13px; color:#374151; line-height:1.6;">${detail}</td>
          </tr>
        </table>`
    ),
  };
}

// Organization structure Phase 5 (0.2.17): a document's expiry is
// approaching. Sent to the employee (personal, not preference-gated — same
// as attendanceChangedEmail) and to Admin-level "hr" subscribers.
const EXPIRY_KIND_LABEL: Record<"civil_id" | "passport" | "visa" | "contract", string> = {
  civil_id: "Civil ID",
  passport: "Passport",
  visa: "Visa",
  contract: "Contract",
};

export function documentExpiringEmail(
  username: string,
  kind: "civil_id" | "passport" | "visa" | "contract",
  expiryDate: string
): { subject: string; html: string } {
  const label = EXPIRY_KIND_LABEL[kind];
  const dateLabel = formatMuscatDateOnly(new Date(expiryDate));
  return {
    subject: `${label} expiring soon — ${username}`,
    html: wrap(
      `${escapeHtml(username)}'s ${label} expires on ${dateLabel}`,
      `${label} expiring soon`,
      introText(
        `${escapeHtml(username)}'s <strong>${label}</strong> expires on <strong>${dateLabel}</strong> — worth renewing ahead of time.`
      )
    ),
  };
}
