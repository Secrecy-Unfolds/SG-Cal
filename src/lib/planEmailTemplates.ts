import type { PlanRow } from "@/lib/plans";
import type { OverdueStepReminder } from "@/lib/planSteps";
import { PLAN_TYPE_LABELS } from "@/lib/planDisplay";
import { escapeHtml, introText, wrap } from "@/lib/emailShell";
import { formatDateOnly } from "@/lib/procurementDisplay";
import { formatMuscatDateTime } from "@/lib/time";

const PLAN_COLOR = "#0f766e";

function planCard(plan: PlanRow): string {
  const typeLabel = PLAN_TYPE_LABELS[plan.plan_type];
  const desc = plan.description?.trim()
    ? `<div style="margin-top:8px; font-size:13px; line-height:1.5; color:#4b5563; white-space:pre-wrap;">${escapeHtml(
        plan.description
      )}</div>`
    : "";
  const details = [`Type: <strong>${typeLabel}</strong>`, `Start date: <strong>${formatDateOnly(plan.start_date)}</strong>`]
    .filter(Boolean)
    .join(" &middot; ");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:4px; background:${PLAN_COLOR}; border-radius:4px; font-size:0;">&nbsp;</td>
        <td style="padding:2px 0 12px 14px;">
          <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(plan.name)}</div>
          <div style="font-size:12px; color:#6b7280; margin-top:4px; line-height:1.6;">${details}</div>
          ${desc}
        </td>
      </tr>
    </table>`;
}

export function planCreatedEmail(plan: PlanRow): { subject: string; html: string } {
  const who = plan.created_by_username ? escapeHtml(plan.created_by_username) : "Someone";
  const typeLabel = PLAN_TYPE_LABELS[plan.plan_type];
  return {
    subject: `New ${typeLabel.toLowerCase()}: ${plan.name}`,
    html: wrap(
      `${who} added a new ${typeLabel.toLowerCase()}: "${plan.name}"`,
      `New ${typeLabel}`,
      introText(`${who} added a new ${typeLabel.toLowerCase()}:`) + planCard(plan)
    ),
  };
}

export function planUpdatedEmail(plan: PlanRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  const typeLabel = PLAN_TYPE_LABELS[plan.plan_type];
  return {
    subject: `Updated ${typeLabel.toLowerCase()}: ${plan.name}`,
    html: wrap(
      `${whoSafe} updated "${plan.name}"`,
      `${typeLabel} updated`,
      introText(`${whoSafe} made changes to this ${typeLabel.toLowerCase()}:`) + planCard(plan)
    ),
  };
}

// Phase 5: overdue-step reminders — mirrors the plain, single-card shape
// of Calendar's own meetingStartingSoonEmail/taskDueSoonEmail
// (src/lib/emailTemplates.ts) rather than reusing that file's `eventCard`
// directly, since a StepRow isn't shaped like a full EventRow (no
// attendees array, a different status vocabulary).
function stepDueLabel(step: OverdueStepReminder): string {
  const when = step.step_type === "task" && step.end_at ? step.end_at : step.start_at;
  return formatMuscatDateTime(new Date(when));
}

export function stepOverdueEmail(step: OverdueStepReminder): { subject: string; html: string } {
  const kindLabel = step.step_type === "task" ? "Task" : "Meeting";
  return {
    subject: `Overdue: ${step.title}`,
    html: wrap(
      `"${step.title}" (${step.plan_name}) is overdue`,
      "Step overdue",
      introText(
        `This ${kindLabel.toLowerCase()} step in "${escapeHtml(step.plan_name)}" is overdue and still isn't done:`
      ) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
          <tr>
            <td style="width:4px; background:#dc2626; border-radius:4px; font-size:0;">&nbsp;</td>
            <td style="padding:2px 0 12px 14px;">
              <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(step.title)}</div>
              <div style="font-size:12px; color:#6b7280; margin-top:4px; line-height:1.6;">
                ${kindLabel} &middot; ${step.step_type === "task" ? "Was due" : "Was scheduled for"}
                <strong>${stepDueLabel(step)}</strong>
              </div>
              ${
                step.notes
                  ? `<div style="margin-top:8px; font-size:13px; line-height:1.5; color:#4b5563; white-space:pre-wrap;">${escapeHtml(
                      step.notes
                    )}</div>`
                  : ""
              }
            </td>
          </tr>
        </table>`
    ),
  };
}

export function planDeletedEmail(plan: PlanRow, who: string): { subject: string; html: string } {
  const whoSafe = escapeHtml(who);
  const typeLabel = PLAN_TYPE_LABELS[plan.plan_type];
  return {
    subject: `Deleted ${typeLabel.toLowerCase()}: ${plan.name}`,
    html: wrap(
      `${whoSafe} deleted "${plan.name}"`,
      `${typeLabel} deleted`,
      introText(`${whoSafe} removed this ${typeLabel.toLowerCase()}:`) + planCard(plan)
    ),
  };
}
