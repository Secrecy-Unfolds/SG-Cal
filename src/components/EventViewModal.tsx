"use client";

import { EventItem } from "@/components/EventModal";
import { eventBadgeClass, eventTypeLabel, formatEventWhen } from "@/lib/eventDisplay";

export default function EventViewModal({
  event,
  onClose,
  onEdit,
}: {
  event: EventItem;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 mb-2 ${eventBadgeClass(
                event
              )}`}
            >
              {eventTypeLabel(event)}
            </span>
            <h2 className="text-lg font-semibold leading-snug break-words">{event.title}</h2>
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

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
