"use client";

import { useState } from "react";

type DigestSettings = { midnightDigestTime: string; saturdayDigestTime: string };

export default function SettingsForm({ initialSettings }: { initialSettings: DigestSettings }) {
  const [midnightDigestTime, setMidnightDigestTime] = useState(initialSettings.midnightDigestTime);
  const [saturdayDigestTime, setSaturdayDigestTime] = useState(initialSettings.saturdayDigestTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ midnightDigestTime, saturdayDigestTime }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save settings");
        return;
      }
      setSaved(true);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-4"
    >
      <div>
        <h2 className="text-sm font-semibold">Digest email timing</h2>
        <p className="text-xs text-black/40 dark:text-white/40 mt-1">
          Times are Asia/Muscat (UTC+4). Changes take effect within about
          10-15 minutes, since the reminder-sweep endpoint is what actually
          checks these — not an instant switch.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Midnight digest (daily)</label>
          <input
            type="time"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm dark:[color-scheme:dark]"
            value={midnightDigestTime}
            onChange={(e) => setMidnightDigestTime(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Saturday morning digest</label>
          <input
            type="time"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm dark:[color-scheme:dark]"
            value={saturdayDigestTime}
            onChange={(e) => setSaturdayDigestTime(e.target.value)}
            required
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
