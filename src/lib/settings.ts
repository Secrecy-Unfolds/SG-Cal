import { query } from "@/lib/db";

// Defaults match the previous hardcoded vercel.json cron schedule (midnight
// digest at 00:00 Muscat, Saturday digest at 08:00 Muscat) so behavior is
// unchanged until a Super Admin actually changes something. The daily
// digest's look-ahead window defaults to 24 hours for the same reason. The
// weekly digest's look-ahead window and send-day have **no default** —
// confirmed with the user: until a Super Admin explicitly sets both in
// Settings, the weekly digest simply doesn't fire (see maybeSendWeeklyDigest
// in lib/digests.ts) rather than silently assuming a value.
const DEFAULT_MIDNIGHT_DIGEST_TIME = "00:00";
const DEFAULT_SATURDAY_DIGEST_TIME = "08:00";
const DEFAULT_MIDNIGHT_DIGEST_WINDOW_HOURS = 24;

export type DigestKind = "midnight" | "saturday";

// Internal app_settings keys/DigestKind values keep their original
// "midnight"/"saturday" names even though the UI now calls these "Daily"
// and "Weekly" (the weekly one's day is configurable, so "saturday" is a
// misnomer) — renaming them would orphan any value a Super Admin already
// configured in the real database. Only the user-facing labels and the
// /api/cron/daily-digest + /api/cron/weekly-digest route paths changed.
const TIME_KEY: Record<DigestKind, string> = {
  midnight: "midnight_digest_time",
  saturday: "saturday_digest_time",
};

const LAST_SENT_KEY: Record<DigestKind, string> = {
  midnight: "midnight_digest_last_sent",
  saturday: "saturday_digest_last_sent",
};

const MIDNIGHT_WINDOW_HOURS_KEY = "midnight_digest_window_hours";
const SATURDAY_WINDOW_DAYS_KEY = "saturday_digest_window_days";
const SATURDAY_WEEKDAY_KEY = "saturday_digest_weekday";

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// 1 hour to 30 days — generous but sane bounds for "next XX hours".
export function isValidWindowHours(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 24 * 30;
}

// 1 day to 180 days — generous but sane bounds for "next YY days".
export function isValidWindowDays(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 180;
}

// 0 (Sunday) through 6 (Saturday) — same convention as time.ts's
// getMuscatNowParts().weekday.
export function isValidWeekday(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

async function getValue(key: string): Promise<string | null> {
  const res = await query<{ value: string }>("SELECT value FROM app_settings WHERE key = $1", [key]);
  return res.rows[0]?.value ?? null;
}

async function setValue(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
    [key, value]
  );
}

export async function getDigestSettings(): Promise<{
  midnightDigestTime: string;
  midnightDigestWindowHours: number;
  saturdayDigestTime: string;
  // null until a Super Admin has explicitly set these — there's no silent
  // fallback for either, see the module comment above.
  saturdayDigestWindowDays: number | null;
  saturdayDigestWeekday: number | null;
}> {
  const [midnightTime, saturdayTime, windowHours, windowDays, weekday] = await Promise.all([
    getValue(TIME_KEY.midnight),
    getValue(TIME_KEY.saturday),
    getValue(MIDNIGHT_WINDOW_HOURS_KEY),
    getValue(SATURDAY_WINDOW_DAYS_KEY),
    getValue(SATURDAY_WEEKDAY_KEY),
  ]);
  return {
    midnightDigestTime: midnightTime ?? DEFAULT_MIDNIGHT_DIGEST_TIME,
    midnightDigestWindowHours: windowHours ? parseInt(windowHours, 10) : DEFAULT_MIDNIGHT_DIGEST_WINDOW_HOURS,
    saturdayDigestTime: saturdayTime ?? DEFAULT_SATURDAY_DIGEST_TIME,
    saturdayDigestWindowDays: windowDays ? parseInt(windowDays, 10) : null,
    saturdayDigestWeekday: weekday ? parseInt(weekday, 10) : null,
  };
}

export async function setDigestTime(kind: DigestKind, hhmm: string): Promise<void> {
  await setValue(TIME_KEY[kind], hhmm);
}

export async function setMidnightDigestWindowHours(hours: number): Promise<void> {
  await setValue(MIDNIGHT_WINDOW_HOURS_KEY, String(hours));
}

export async function setSaturdayDigestWindowDays(days: number): Promise<void> {
  await setValue(SATURDAY_WINDOW_DAYS_KEY, String(days));
}

export async function setSaturdayDigestWeekday(weekday: number): Promise<void> {
  await setValue(SATURDAY_WEEKDAY_KEY, String(weekday));
}

// Guards against sending the same digest twice in one day — needed because
// the configured time is checked repeatedly (every reminder-sweep tick, plus
// the old fixed vercel.json cron as a fallback) rather than fired exactly once.
export async function wasSentToday(kind: DigestKind, dateKey: string): Promise<boolean> {
  const lastSent = await getValue(LAST_SENT_KEY[kind]);
  return lastSent === dateKey;
}

export async function markSent(kind: DigestKind, dateKey: string): Promise<void> {
  await setValue(LAST_SENT_KEY[kind], dateKey);
}
