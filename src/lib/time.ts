// Asia/Muscat is UTC+4 year-round (no daylight saving), so a fixed offset is safe.
export const MUSCAT_OFFSET_MINUTES = 4 * 60;
export const TIMEZONE_LABEL = "Asia/Muscat (UTC+4)";

// Interprets a "YYYY-MM-DD" + "HH:mm" pair as local Muscat time and returns
// the equivalent UTC Date, for storing in the database.
export function muscatInputToUTC(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - MUSCAT_OFFSET_MINUTES * 60_000;
  return new Date(utcMillis);
}

export function formatMuscat(date: Date, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Muscat",
    ...opts,
  }).format(date);
}

export function formatMuscatDateTime(date: Date): string {
  return formatMuscat(date, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Returns the [startUTC, endUTC) range covering "today" in Muscat local time,
// as of the moment this is called.
export function muscatTodayRangeUTC(): { start: Date; end: Date } {
  const now = new Date();
  const muscatNow = new Date(now.getTime() + MUSCAT_OFFSET_MINUTES * 60_000);
  const y = muscatNow.getUTCFullYear();
  const m = muscatNow.getUTCMonth();
  const d = muscatNow.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0) - MUSCAT_OFFSET_MINUTES * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

// "YYYY-MM-DD" / "HH:mm" for pre-filling <input type="date"/"time"> in Muscat local time.
export function toMuscatDateInput(date: Date): string {
  const y = formatMuscat(date, { year: "numeric" });
  const m = formatMuscat(date, { month: "2-digit" });
  const d = formatMuscat(date, { day: "2-digit" });
  return `${y}-${m}-${d}`;
}

export function toMuscatTimeInput(date: Date): string {
  return formatMuscat(date, { hour: "2-digit", minute: "2-digit", hour12: false });
}
