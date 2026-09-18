import { query } from "@/lib/db";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/lib/notificationPreferencesDisplay";

export type { NotificationCategory } from "@/lib/notificationPreferencesDisplay";
export {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_CATEGORY_DESCRIPTIONS,
  isNotificationCategory,
} from "@/lib/notificationPreferencesDisplay";

// A category with no row is enabled by default — matches today's
// "everyone gets it" behavior exactly, so nothing changes for a user until
// they explicitly opt out of something.
export async function getPreferencesForUser(userId: number): Promise<Record<NotificationCategory, boolean>> {
  const res = await query<{ category: string; enabled: boolean }>(
    `SELECT category, enabled FROM notification_preferences WHERE user_id = $1`,
    [userId]
  );
  const overrides = new Map(res.rows.map((r) => [r.category, r.enabled]));
  const prefs = {} as Record<NotificationCategory, boolean>;
  for (const c of NOTIFICATION_CATEGORIES) prefs[c] = overrides.get(c) ?? true;
  return prefs;
}

export async function setPreference(userId: number, category: NotificationCategory, enabled: boolean): Promise<void> {
  await query(
    `INSERT INTO notification_preferences (user_id, category, enabled) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, category) DO UPDATE SET enabled = $3`,
    [userId, category, enabled]
  );
}

// Filters a list of {id, email} recipients down to those who haven't
// opted out of `category` — the shared step every broadcast mailer helper
// (lib/mailer.ts) runs before returning its address list. Self-service
// only (confirmed) — a user's own preference is the only thing that can
// remove them from a list here.
export async function filterByPreference<T extends { id: number; email: string }>(
  recipients: T[],
  category: NotificationCategory
): Promise<T[]> {
  if (recipients.length === 0) return recipients;
  const res = await query<{ user_id: number }>(
    `SELECT user_id FROM notification_preferences WHERE category = $1 AND enabled = false AND user_id = ANY($2::int[])`,
    [category, recipients.map((r) => r.id)]
  );
  const optedOut = new Set(res.rows.map((r) => r.user_id));
  return recipients.filter((r) => !optedOut.has(r.id));
}
