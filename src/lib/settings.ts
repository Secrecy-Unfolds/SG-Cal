import { query } from "@/lib/db";

// Defaults match the previous hardcoded vercel.json cron schedule (midnight
// digest at 00:00 Muscat, Saturday digest at 08:00 Muscat) so behavior is
// unchanged until a Super Admin actually changes something.
const DEFAULT_MIDNIGHT_DIGEST_TIME = "00:00";
const DEFAULT_SATURDAY_DIGEST_TIME = "08:00";

export type DigestKind = "midnight" | "saturday";

const TIME_KEY: Record<DigestKind, string> = {
  midnight: "midnight_digest_time",
  saturday: "saturday_digest_time",
};

const LAST_SENT_KEY: Record<DigestKind, string> = {
  midnight: "midnight_digest_last_sent",
  saturday: "saturday_digest_last_sent",
};

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
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
  saturdayDigestTime: string;
}> {
  const [midnight, saturday] = await Promise.all([
    getValue(TIME_KEY.midnight),
    getValue(TIME_KEY.saturday),
  ]);
  return {
    midnightDigestTime: midnight ?? DEFAULT_MIDNIGHT_DIGEST_TIME,
    saturdayDigestTime: saturday ?? DEFAULT_SATURDAY_DIGEST_TIME,
  };
}

export async function setDigestTime(kind: DigestKind, hhmm: string): Promise<void> {
  await setValue(TIME_KEY[kind], hhmm);
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
