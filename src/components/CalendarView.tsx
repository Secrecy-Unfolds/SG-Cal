"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EventModal, { EventItem, EventType } from "@/components/EventModal";
import ThemeToggle from "@/components/ThemeToggle";
import { eachMuscatDateKeyInRange, formatMuscatDateOnly, formatMuscatDateTime, toMuscatDateInput } from "@/lib/time";

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

export default function CalendarView({ username }: { username: string }) {
  const router = useRouter();
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<
    | { mode: "closed" }
    | { mode: "create"; date: Date; type?: EventType }
    | { mode: "edit"; event: EventItem }
  >({ mode: "closed" });

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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function closeModal() {
    setModalState({ mode: "closed" });
  }

  function afterChange() {
    closeModal();
    loadEvents();
  }

  const todayKey = toMuscatDateInput(new Date());

  return (
    <main className="min-h-screen max-w-6xl mx-auto px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold">SG Calendar</h1>
          <p className="text-sm text-black/50 dark:text-white/50">
            {username ? `Signed in as ${username}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setModalState({ mode: "create", date: new Date(), type: "meeting" })}
            className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium"
          >
            + Meeting
          </button>
          <button
            onClick={() => setModalState({ mode: "create", date: new Date(), type: "task" })}
            className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium"
          >
            + Task
          </button>
          <Link
            href="/profile"
            className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/[0.03] dark:hover:bg-white/5"
          >
            Change Password
          </Link>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/[0.03] dark:hover:bg-white/5"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <section>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setMonthCursor((m) => addMonths(m, -1))}
              className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              ← Prev
            </button>
            <h2 className="text-base font-medium">
              {monthCursor.toLocaleString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <button
              onClick={() => setMonthCursor((m) => addMonths(m, 1))}
              className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Next →
            </button>
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
                  onClick={() => setModalState({ mode: "create", date: day })}
                  className={`bg-white dark:bg-neutral-900 min-h-[96px] p-1.5 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors ${
                    inMonth ? "" : "opacity-40"
                  }`}
                >
                  <div
                    className={`text-xs mb-1 inline-flex items-center justify-center w-5 h-5 rounded-full ${
                      isToday ? "bg-accent text-white" : "text-black/60 dark:text-white/60"
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
                          setModalState({ mode: "edit", event: ev });
                        }}
                        className={`block w-full text-left text-[11px] leading-tight rounded px-1 py-0.5 truncate ${
                          ev.type === "task"
                            ? "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 dark:hover:bg-amber-500/30"
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
          <h3 className="text-sm font-semibold mb-3">Upcoming</h3>
          <div className="space-y-2">
            {upcoming.length === 0 && (
              <p className="text-sm text-black/40 dark:text-white/40">
                Nothing coming up this month.
              </p>
            )}
            {upcoming.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setModalState({ mode: "edit", event: ev })}
                className="w-full text-left bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-3 hover:border-accent/40"
              >
                <span
                  className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 mb-1 ${
                    ev.type === "task"
                      ? "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
                      : ev.is_tentative
                      ? "bg-violet-500/10 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300"
                      : "bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300"
                  }`}
                >
                  {ev.type === "task" ? "Task" : ev.is_tentative ? "Tentative" : "Meeting"}
                </span>
                <div className="text-sm font-medium truncate">{ev.title}</div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {ev.is_tentative
                    ? `Sometime ${formatMuscatDateOnly(new Date(ev.start_at))}${
                        ev.end_at ? ` – ${formatMuscatDateOnly(new Date(ev.end_at))}` : ""
                      }`
                    : formatMuscatDateTime(new Date(ev.start_at))}
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {modalState.mode === "create" && (
        <EventModal
          defaultDate={modalState.date}
          defaultType={modalState.type}
          onClose={closeModal}
          onSaved={afterChange}
          onDeleted={afterChange}
        />
      )}
      {modalState.mode === "edit" && (
        <EventModal
          event={modalState.event}
          onClose={closeModal}
          onSaved={afterChange}
          onDeleted={afterChange}
        />
      )}
    </main>
  );
}
