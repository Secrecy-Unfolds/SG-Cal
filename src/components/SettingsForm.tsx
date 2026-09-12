"use client";

import { useState } from "react";
import { HudFrameForm } from "@/components/hud/HudFrame";
import SectionLabel from "@/components/hud/SectionLabel";

type DigestSettings = {
  midnightDigestTime: string;
  midnightDigestWindowHours: number;
  saturdayDigestTime: string;
  saturdayDigestWindowDays: number | null;
  saturdayDigestWeekday: number | null;
};

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-sm [color-scheme:light] dark:[color-scheme:dark]";

export default function SettingsForm({ initialSettings }: { initialSettings: DigestSettings }) {
  const [midnightDigestTime, setMidnightDigestTime] = useState(initialSettings.midnightDigestTime);
  const [midnightDigestWindowHours, setMidnightDigestWindowHours] = useState(
    String(initialSettings.midnightDigestWindowHours)
  );
  const [saturdayDigestTime, setSaturdayDigestTime] = useState(initialSettings.saturdayDigestTime);
  const [saturdayDigestWindowDays, setSaturdayDigestWindowDays] = useState(
    initialSettings.saturdayDigestWindowDays !== null ? String(initialSettings.saturdayDigestWindowDays) : ""
  );
  const [saturdayDigestWeekday, setSaturdayDigestWeekday] = useState(
    initialSettings.saturdayDigestWeekday !== null ? String(initialSettings.saturdayDigestWeekday) : ""
  );
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
        body: JSON.stringify({
          midnightDigestTime,
          midnightDigestWindowHours: Number(midnightDigestWindowHours),
          saturdayDigestTime,
          saturdayDigestWindowDays: Number(saturdayDigestWindowDays),
          saturdayDigestWeekday: Number(saturdayDigestWeekday),
        }),
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
    <HudFrameForm
      onSubmit={handleSubmit}
      corners="all"
      className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-6"
    >
      <div>
        <SectionLabel>Digest timing</SectionLabel>
        <h2 className="font-heading font-semibold text-sm uppercase tracking-wide">Digest email timing</h2>
        <p className="text-xs text-black/40 dark:text-white/40 mt-1">
          Times are Asia/Muscat (UTC+4). Changes take effect within about
          10-15 minutes, since the reminder-sweep endpoint is what actually
          checks these — not an instant switch.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Daily digest</h3>
        <p className="text-xs text-black/40 dark:text-white/40">
          Sends every day at the chosen time, covering the next N hours of
          meetings and tasks from that moment.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Send time</label>
            <input
              type="time"
              className={inputClass}
              value={midnightDigestTime}
              onChange={(e) => setMidnightDigestTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Look-ahead window (hours)</label>
            <input
              type="number"
              min={1}
              max={720}
              step={1}
              className={inputClass}
              value={midnightDigestWindowHours}
              onChange={(e) => setMidnightDigestWindowHours(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-black/5 dark:border-white/10">
        <h3 className="text-sm font-medium">Weekly digest</h3>
        <p className="text-xs text-black/40 dark:text-white/40">
          Sends once a week, on the chosen day and time, covering the next N
          days of meetings and tasks from that moment. Won&rsquo;t send until
          both the day and window below are set.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Day</label>
            <select
              className={inputClass}
              value={saturdayDigestWeekday}
              onChange={(e) => setSaturdayDigestWeekday(e.target.value)}
              required
            >
              <option className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value="" disabled>
                Choose a day
              </option>
              {WEEKDAY_LABELS.map((label, i) => (
                <option
                  key={label}
                  className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100"
                  value={i}
                >
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Send time</label>
            <input
              type="time"
              className={inputClass}
              value={saturdayDigestTime}
              onChange={(e) => setSaturdayDigestTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Look-ahead window (days)</label>
            <input
              type="number"
              min={1}
              max={180}
              step={1}
              placeholder="e.g. 7"
              className={inputClass}
              value={saturdayDigestWindowDays}
              onChange={(e) => setSaturdayDigestWindowDays(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>}

      <div className="flex justify-end">
        <span className="btn-glow inline-block">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </span>
      </div>
    </HudFrameForm>
  );
}
