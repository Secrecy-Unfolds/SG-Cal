"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import EventModal, { EventItem, EventType } from "@/components/EventModal";
import EventViewModal from "@/components/EventViewModal";
import DayEventsModal from "@/components/DayEventsModal";
import { eachMuscatDateKeyInRange, toMuscatDateInput } from "@/lib/time";
import {
  eventBadgeClass,
  eventGlowClass,
  formatEventWhen,
  eventTypeLabel,
  TASK_STATUS_BADGE_CLASS,
  type CurrentUser,
} from "@/lib/eventDisplay";
import PageHeader from "@/components/hud/PageHeader";
import SectionLabel from "@/components/hud/SectionLabel";
import { HudFrameButton } from "@/components/hud/HudFrame";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

// Grid always starts on the Sunday on/before the 1st, and covers 6 weeks (42 days).
function gridStart(month: Date) {
  const first = startOfMonth(month);
  return addDays(first, -first.getDay());
}

type ModalState =
  | { mode: "closed" }
  | { mode: "day"; date: Date }
  | { mode: "view"; event: EventItem }
  | { mode: "create"; date: Date; type?: EventType }
  | { mode: "edit"; event: EventItem };

export default function CalendarView({
  currentUser,
}: {
  currentUser: (CurrentUser & { username: string }) | null;
}) {
  const router = useRouter();
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<ModalState>({ mode: "closed" });

  const gridDays = useMemo(() => {
    const start = gridStart(monthCursor);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [monthCursor]);

  const rangeFrom = gridDays[0];
  const rangeTo = addDays(gridDays[41], 1);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/events?from=${rangeFrom.toISOString()}&to=${rangeTo.toISOString()}`
      );
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setEvents(data.events ?? []);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeFrom.getTime(), rangeTo.getTime()]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of events) {
      const keys =
        ev.is_tentative && ev.end_at
          ? eachMuscatDateKeyInRange(new Date(ev.start_at), new Date(ev.end_at))
          : [toMuscatDateInput(new Date(ev.start_at))];
      for (const key of keys) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
      }
    }
    return map;
  }, [events]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) =>
        e.is_tentative ? (e.end_at ? new Date(e.end_at).getTime() >= now : true) : new Date(e.start_at).getTime() >= now
      )
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 8);
  }, [events]);

  function closeModal() {
    setModalState({ mode: "closed" });
  }

  function afterChange() {
    closeModal();
    loadEvents();
  }

  const todayKey = toMuscatDateInput(new Date());

  return (
    <div>
      <PageHeader label="CALENDAR" title="Calendar" className="flex-wrap mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="btn-glow inline-block">
            <button
              onClick={() => setModalState({ mode: "create", date: new Date(), type: "meeting" })}
              className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
            >
              + Meeting
            </button>
          </span>
          <span className="btn-glow-amber inline-block">
            <button
              onClick={() => setModalState({ mode: "create", date: new Date(), type: "task" })}
              className="bg-amber-600 text-white btn-skew px-4 py-2 text-sm font-medium"
            >
              + Task
            </button>
          </span>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <section>
          <div className="flex items-center justify-between mb-3">
            <span className="btn-glow inline-block">
              <button
                onClick={() => setMonthCursor((m) => addMonths(m, -1))}
                className="btn-skew border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-black/[0.03] dark:hover:bg-white/5"
              >
                ← Prev
              </button>
            </span>
            <h2 className="text-base font-heading font-semibold uppercase tracking-wide">
              {monthCursor.toLocaleString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <span className="btn-glow inline-block">
              <button
                onClick={() => setMonthCursor((m) => addMonths(m, 1))}
                className="btn-skew border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-black/[0.03] dark:hover:bg-white/5"
              >
                Next →
              </button>
            </span>
          </div>

          <div className="grid grid-cols-7 gap-px bg-black/5 dark:bg-white/10 rounded-xl overflow-hidden border border-black/5 dark:border-white/10">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="bg-white dark:bg-neutral-900 text-center text-xs font-medium text-black/40 dark:text-white/40 py-2"
              >
                {w}
              </div>
            ))}
            {gridDays.map((day) => {
              const key = toMuscatDateInput(day);
              const inMonth = day.getMonth() === monthCursor.getMonth();
              const dayEvents = eventsByDay.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  onClick={() => setModalState({ mode: "day", date: day })}
                  className={`bg-white dark:bg-neutral-900 min-h-[96px] p-1.5 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors ${
                    inMonth ? "" : "opacity-40"
                  }`}
                >
                  <div
                    className={`text-xs mb-1 inline-flex items-center justify-center w-5 h-5 rounded-full ${
                      isToday ? "bg-accent text-ink" : "text-black/60 dark:text-white/60"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalState({ mode: "view", event: ev });
                        }}
                        className={`block w-full text-left text-[11px] leading-tight rounded px-1 py-0.5 truncate transition-shadow ${eventGlowClass(
                          ev
                        )} ${
                          ev.type === "task"
                            ? `${TASK_STATUS_BADGE_CLASS[ev.status]} hover:opacity-80`
                            : ev.is_tentative
                            ? "border border-dashed border-violet-500/50 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10"
                            : "bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300 hover:bg-accent/20 dark:hover:bg-accent/30"
                        }`}
                        title={ev.title}
                      >
                        {ev.is_tentative ? "? " : ""}
                        {ev.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-black/40 dark:text-white/40 px-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {loading && <p className="text-xs text-black/40 dark:text-white/40 mt-2">Loading…</p>}
        </section>

        <aside>
          <SectionLabel>Schedule</SectionLabel>
          <h3 className="text-sm font-heading font-semibold uppercase tracking-wide mb-3">Upcoming</h3>
          <div className="space-y-2">
            {upcoming.length === 0 && (
              <p className="text-sm text-black/40 dark:text-white/40">
                Nothing coming up this month.
              </p>
            )}
            {upcoming.map((ev) => (
              <HudFrameButton
                key={ev.id}
                corners="tl-br"
                onClick={() => setModalState({ mode: "view", event: ev })}
                className={`w-full text-left bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-3 hover:border-accent/40 ${eventGlowClass(
                  ev
                )}`}
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
              </HudFrameButton>
            ))}
          </div>
        </aside>
      </div>

      {modalState.mode === "day" && (
        <DayEventsModal
          date={modalState.date}
          events={eventsByDay.get(toMuscatDateInput(modalState.date)) ?? []}
          onClose={closeModal}
          onSelectEvent={(ev) => setModalState({ mode: "view", event: ev })}
          onAddNew={(type) => setModalState({ mode: "create", date: modalState.date, type })}
        />
      )}
      {modalState.mode === "view" && (
        <EventViewModal
          event={modalState.event}
          currentUser={currentUser}
          onClose={closeModal}
          onEdit={() => setModalState({ mode: "edit", event: modalState.event })}
        />
      )}
      {modalState.mode === "create" && currentUser && (
        <EventModal
          defaultDate={modalState.date}
          defaultType={modalState.type}
          currentUser={currentUser}
          onClose={closeModal}
          onSaved={afterChange}
          onDeleted={afterChange}
        />
      )}
      {modalState.mode === "edit" && currentUser && (
        <EventModal
          event={modalState.event}
          currentUser={currentUser}
          onClose={closeModal}
          onSaved={afterChange}
          onDeleted={afterChange}
        />
      )}
    </div>
  );
}
