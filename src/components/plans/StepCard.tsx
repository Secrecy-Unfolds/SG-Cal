"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StepRow } from "@/lib/planSteps";
import {
  STEP_STATUSES,
  STEP_STATUS_LABELS,
  STEP_STATUS_BADGE_CLASS,
  prerequisitesSatisfied,
  type StepStatus,
} from "@/lib/planDisplay";
import { isDeliverableDefFilled } from "@/lib/planDeliverablesDisplay";
import { isMinutesOfMeetingFilled } from "@/lib/planMinutesOfMeetingDisplay";
import { formatMuscatDateTime } from "@/lib/time";
import DeliverableUploadWidget from "@/components/plans/DeliverableUploadWidget";
import MinutesOfMeetingForm from "@/components/plans/MinutesOfMeetingForm";

// Mirrors the server-side gate in lib/planSteps.ts's isDeliverableGateSatisfied
// — used only to disable/explain the Done button proactively; the PATCH
// call remains the actual authority.
function isDeliverableGateSatisfiedClientSide(step: StepRow): boolean {
  if (step.step_type === "meeting") return isMinutesOfMeetingFilled(step.minutes_of_meeting);
  if (step.deliverable_defs.length === 0) return true;
  return step.deliverable_defs.every((def) => isDeliverableDefFilled(def));
}

export default function StepCard({
  step,
  allSteps,
  readOnly = false,
  onEdit,
  onStatusChange,
}: {
  step: StepRow;
  allSteps: StepRow[];
  // A shared, non-Admin-level viewer (Phase 4) sees the same step info but
  // can't edit it, change its status, or fill in deliverables/minutes —
  // all of that stays Admin-level-only server-side too, this just avoids
  // showing controls that would 403 on click.
  readOnly?: boolean;
  onEdit: () => void;
  onStatusChange: (status: StepStatus) => Promise<string | null>;
}) {
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState<StepStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const prerequisiteSteps = allSteps.filter((s) => step.prerequisite_step_ids.includes(s.id));
  const prerequisiteUnmet = !prerequisitesSatisfied(prerequisiteSteps);
  const deliverableIncomplete = step.requires_deliverable && !isDeliverableGateSatisfiedClientSide(step);
  const doneDisabledReason =
    step.status === "done"
      ? null
      : prerequisiteUnmet
      ? "Waiting on a prerequisite step"
      : deliverableIncomplete
      ? "Deliverable not filled in yet"
      : null;

  const hasDeliverableSection = step.requires_deliverable && step.deliverable_defs.length > 0;
  const hasMomSection = step.step_type === "meeting";

  async function handleStatusClick(status: StepStatus) {
    if (status === step.status) return;
    setStatusError(null);
    setPendingStatus(status);
    const error = await onStatusChange(status);
    if (error) setStatusError(error);
    setPendingStatus(null);
  }

  function refreshAfterFill() {
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 p-3 bg-white dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide font-medium text-black/40 dark:text-white/40">
              {step.step_type === "task" ? "Task" : "Meeting"}
            </span>
            <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${STEP_STATUS_BADGE_CLASS[step.status]}`}>
              {STEP_STATUS_LABELS[step.status]}
            </span>
            {step.requires_deliverable && (
              <span className="text-[10px] rounded-full px-2 py-0.5 font-medium bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50">
                Needs deliverable
              </span>
            )}
          </div>
          <div className="text-sm font-medium truncate mt-0.5">{step.title}</div>
          <div className="text-xs text-black/50 dark:text-white/50 mt-0.5">
            {step.step_type === "task" && step.end_at
              ? `Due ${formatMuscatDateTime(new Date(step.end_at))}`
              : formatMuscatDateTime(new Date(step.start_at))}
            {step.assignee_username ? ` · ${step.assignee_username}` : " · Unassigned"}
          </div>
          {step.notes && <div className="text-xs text-black/50 dark:text-white/50 mt-1.5">{step.notes}</div>}
          {prerequisiteSteps.length > 0 && (
            <div className="text-xs text-black/40 dark:text-white/40 mt-1.5">
              Waits on: {prerequisiteSteps.map((s) => s.title).join(", ")}
            </div>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-black/40 dark:text-white/40 hover:text-accent shrink-0"
          >
            Edit
          </button>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {STEP_STATUSES.map((s) => {
            const disabled = s === "done" && doneDisabledReason !== null;
            return (
              <button
                key={s}
                type="button"
                disabled={disabled || pendingStatus !== null}
                title={disabled ? doneDisabledReason ?? undefined : undefined}
                onClick={() => handleStatusClick(s)}
                className={`rounded-full text-xs font-medium px-2.5 py-1 border transition-colors disabled:opacity-40 ${
                  step.status === s
                    ? "bg-accent text-ink border-accent"
                    : "border-black/10 dark:border-white/10 text-black/50 dark:text-white/50 hover:bg-black/[0.03] dark:hover:bg-white/5"
                }`}
              >
                {STEP_STATUS_LABELS[s]}
              </button>
            );
          })}

          {(hasDeliverableSection || hasMomSection) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-accent dark:text-blue-300 hover:underline ml-auto"
            >
              {expanded ? "Hide" : "Fill in"} {hasMomSection ? "minutes" : "deliverables"}
            </button>
          )}
        </div>
      )}
      {statusError && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{statusError}</p>}

      {!readOnly && expanded && (
        <div className="mt-3 space-y-2 border-t border-black/5 dark:border-white/10 pt-3">
          {hasMomSection && (
            <MinutesOfMeetingForm stepId={step.id} mom={step.minutes_of_meeting} onSaved={refreshAfterFill} />
          )}
          {step.deliverable_defs.map((def) => (
            <DeliverableUploadWidget key={def.id} stepId={step.id} def={def} onChanged={refreshAfterFill} />
          ))}
        </div>
      )}
    </div>
  );
}
