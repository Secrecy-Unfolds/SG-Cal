"use client";

import { useState } from "react";
import type { MinutesOfMeetingRow } from "@/lib/planMinutesOfMeetingDisplay";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

// Light structure (confirmed 2026-09-18) — four labeled free-text fields,
// not a rigid form. Only `discussion` is required for the completion gate
// (confirmed 2026-09-19), so this form never blocks saving on the other
// three being empty.
export default function MinutesOfMeetingForm({
  stepId,
  mom,
  onSaved,
}: {
  stepId: number;
  mom: MinutesOfMeetingRow | null;
  onSaved: () => void;
}) {
  const [attendees, setAttendees] = useState(mom?.attendees ?? "");
  const [discussion, setDiscussion] = useState(mom?.discussion ?? "");
  const [decisions, setDecisions] = useState(mom?.decisions ?? "");
  const [actionItems, setActionItems] = useState(mom?.action_items ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/steps/${stepId}/mom`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendees, discussion, decisions, actionItems }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save Minutes of Meeting");
        return;
      }
      onSaved();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-2.5 space-y-2">
      <div className="text-xs font-medium">Minutes of Meeting</div>
      <div className="space-y-1">
        <label className="text-xs text-black/50 dark:text-white/50">Attendees</label>
        <input className={inputClass} value={attendees} onChange={(e) => setAttendees(e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-black/50 dark:text-white/50">Discussion</label>
        <textarea
          className={`${inputClass} min-h-[60px]`}
          value={discussion}
          onChange={(e) => setDiscussion(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-black/50 dark:text-white/50">Decisions</label>
        <textarea
          className={`${inputClass} min-h-[50px]`}
          value={decisions}
          onChange={(e) => setDecisions(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-black/50 dark:text-white/50">Action items</label>
        <textarea
          className={`${inputClass} min-h-[50px]`}
          value={actionItems}
          onChange={(e) => setActionItems(e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <span className="btn-glow inline-block">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-accent text-ink btn-skew px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save minutes"}
        </button>
      </span>
    </div>
  );
}
