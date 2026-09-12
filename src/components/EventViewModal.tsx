"use client";

import { EventItem } from "@/components/EventModal";
import {
  canEditEvent,
  eventBadgeClass,
  eventTypeLabel,
  formatEventWhen,
  TASK_STATUS_BADGE_CLASS,
  TASK_STATUS_LABELS,
  type CurrentUser,
} from "@/lib/eventDisplay";
import { HudFrame } from "@/components/hud/HudFrame";

export default function EventViewModal({
  event,
  currentUser,
  onClose,
  onEdit,
}: {
  event: EventItem;
  currentUser: CurrentUser | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const editable = canEditEvent(currentUser, event);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <HudFrame corners="all" className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 mb-2 ${eventBadgeClass(
                event
              )}`}
            >
              {eventTypeLabel(event)}
            </span>
            <h2 className="text-lg font-heading font-semibold uppercase tracking-wide leading-snug break-words">{event.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="text-sm text-black/70 dark:text-white/70">{formatEventWhen(event)}</div>

        {event.type === "task" && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                TASK_STATUS_BADGE_CLASS[event.status]
              }`}
            >
              {TASK_STATUS_LABELS[event.status]}
            </span>
            <span className="text-xs text-black/50 dark:text-white/50">
              Assigned to {event.assignee_username ?? "nobody yet"}
            </span>
          </div>
        )}

        {event.type === "meeting" && event.attendees.length > 0 && (
          <div className="text-xs text-black/50 dark:text-white/50">
            Attendees: {event.attendees.map((a) => a.username).join(", ")}
          </div>
        )}

        {event.description?.trim() && (
          <div className="text-sm text-black/70 dark:text-white/70 whitespace-pre-wrap border-t border-black/5 dark:border-white/10 pt-3">
            {event.description}
          </div>
        )}

        {event.created_by_username && (
          <div className="text-xs text-black/40 dark:text-white/40">
            Added by {event.created_by_username}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          {!editable && (
            <span className="text-xs text-black/40 dark:text-white/40 mr-auto">
              Only the assignee or an Admin can edit this
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
          >
            Close
          </button>
          {editable && (
            <button
              type="button"
              onClick={onEdit}
              className="bg-accent text-ink [clip-path:polygon(6%_0,100%_0,94%_100%,0_100%)] px-4 py-2 text-sm font-medium"
            >
              Edit
            </button>
          )}
        </div>
      </HudFrame>
    </div>
  );
}
