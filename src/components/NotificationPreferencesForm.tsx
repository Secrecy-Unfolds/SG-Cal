"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/lib/users";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_DESCRIPTIONS,
  NOTIFICATION_CATEGORY_LABELS,
  type NotificationCategory,
} from "@/lib/notificationPreferencesDisplay";
import { HudFrame } from "@/components/hud/HudFrame";

// Cross-cutting/platform's "per-user notification preferences" — confirmed
// 2026-09-18 via `AskUserQuestion`: per-module opt-out, self-service only.
// A plain "user" role never receives Procurement/Accounting/Inventory/HR/
// Ideas broadcasts in the first place (those pages are Admin-level only),
// so showing those toggles to them would just be confusing clutter — only
// Calendar and Digests are shown for that role.
export default function NotificationPreferencesForm({ role }: { role: UserRole }) {
  const [preferences, setPreferences] = useState<Record<NotificationCategory, boolean> | null>(null);
  const [savingCategory, setSavingCategory] = useState<NotificationCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notification-preferences")
      .then((res) => res.json())
      .then((data) => setPreferences(data.preferences))
      .catch(() => setError("Failed to load preferences"));
  }, []);

  const visibleCategories: NotificationCategory[] =
    role === "user" ? ["calendar", "digests"] : NOTIFICATION_CATEGORIES;

  async function toggle(category: NotificationCategory, enabled: boolean) {
    setSavingCategory(category);
    setError(null);
    setPreferences((prev) => (prev ? { ...prev, [category]: enabled } : prev));
    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        setPreferences((prev) => (prev ? { ...prev, [category]: !enabled } : prev));
        return;
      }
      setPreferences(data.preferences);
    } catch {
      setError("Network error — check your connection and try again.");
      setPreferences((prev) => (prev ? { ...prev, [category]: !enabled } : prev));
    } finally {
      setSavingCategory(null);
    }
  }

  return (
    <HudFrame corners="all" className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-6">
      <h2 className="font-heading font-semibold text-sm uppercase tracking-wide mb-1">Notification preferences</h2>
      <p className="text-xs text-black/40 dark:text-white/40 mb-4">
        Turn off email notifications for specific areas — everything is on by default.
      </p>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {!preferences ? (
        <p className="text-sm text-black/40 dark:text-white/40">Loading…</p>
      ) : (
        <div className="space-y-3">
          {visibleCategories.map((category) => (
            <label key={category} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences[category]}
                disabled={savingCategory === category}
                onChange={(e) => toggle(category, e.target.checked)}
                className="mt-1 rounded border-black/20 dark:border-white/20"
              />
              <div>
                <div className="text-sm font-medium">{NOTIFICATION_CATEGORY_LABELS[category]}</div>
                <div className="text-xs text-black/40 dark:text-white/40">{NOTIFICATION_CATEGORY_DESCRIPTIONS[category]}</div>
              </div>
            </label>
          ))}
        </div>
      )}
    </HudFrame>
  );
}
