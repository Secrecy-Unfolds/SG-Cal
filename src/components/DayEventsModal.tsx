"use client";

import { EventItem, EventType } from "@/components/EventModal";
import { eventBadgeClass, eventTypeLabel, formatEventWhen } from "@/lib/eventDisplay";
import { formatMuscat } from "@/lib/time";

export default function DayEventsModal({
  date,
  events,
  onClose,
  onSelectEvent,
  onAddNew,
}: {
  date: Date;
  events: EventItem[];
  onClose: () => void;
  onSelectEvent: (ev: EventItem) => void;
  onAddNew: (type: EventType) => void;
}) {
  const dateLabel = formatMuscat(date, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-lg font-heading font-semibold uppercase tracking-wide">{dateLabel}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {events.length === 0 && (
            <p className="text-sm text-black/40 dark:text-white/40">Nothing scheduled this day.</p>
          )}
          {events.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => onSelectEvent(ev)}
              className="w-full text-left bg-black/[0.02] dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl p-3 hover:border-accent/40"
            >
              <span
                className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 mb-1 ${eventBadgeClass(
                  ev
                )}`}
              >
                {eventTypeLabel(ev)}
              </span>
              <div className="text-sm font-medium truncate">{ev.title}</div>
              <div className="text-xs text-black/50 dark:text-white/50">{formatEventWhen(ev)}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => onAddNew("meeting")}
            className="flex-1 bg-accent text-ink btn-skew btn-glow px-4 py-2 text-sm font-medium"
          >
            + Meeting
          </button>
          <button
            type="button"
            onClick={() => onAddNew("task")}
            className="flex-1 bg-amber-600 text-white btn-skew btn-glow px-4 py-2 text-sm font-medium"
          >
            + Task
          </button>
        </div>
      </div>
    </div>
  );
}
