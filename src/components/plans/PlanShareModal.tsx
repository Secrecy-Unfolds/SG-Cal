"use client";

import { useEffect, useState } from "react";

type BasicUser = { id: number; username: string };

// Admin-only multi-select — reuses the same typeahead-chips pattern
// EventModal.tsx already uses for meeting attendees. Sharing is
// Admin-level-only for this build (see docs/handover.md's Phase 1 note on
// why "down to Manager-level" isn't implemented yet) — this picks
// specific individual users, any role.
export default function PlanShareModal({
  planId,
  onClose,
  onSaved,
}: {
  planId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [allUsers, setAllUsers] = useState<BasicUser[]>([]);
  const [shared, setShared] = useState<BasicUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/users/basic").then((res) => (res.ok ? res.json() : { users: [] })),
      fetch(`/api/plans/${planId}/shares`).then((res) => (res.ok ? res.json() : { users: [] })),
    ])
      .then(([usersData, sharesData]) => {
        setAllUsers(usersData.users ?? []);
        setShared(sharesData.users ?? []);
      })
      .catch(() => setError("Failed to load sharing settings"))
      .finally(() => setLoading(false));
  }, [planId]);

  const suggestions = query.trim()
    ? allUsers
        .filter(
          (u) => !shared.some((s) => s.id === u.id) && u.username.toLowerCase().includes(query.trim().toLowerCase())
        )
        .slice(0, 6)
    : [];

  function addUser(u: BasicUser) {
    setShared((prev) => [...prev, u]);
    setQuery("");
  }

  function removeUser(userId: number) {
    setShared((prev) => prev.filter((u) => u.id !== userId));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${planId}/shares`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: shared.map((u) => u.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save sharing");
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">Share plan</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-black/50 dark:text-white/50">Loading...</p>
        ) : (
          <>
            <p className="text-xs text-black/40 dark:text-white/40">
              Shared users can view this whole plan (steps, notes, deliverables, minutes) but can&rsquo;t edit it.
              Admin-level accounts can always see every plan regardless of this list.
            </p>

            <div className="space-y-1 relative">
              <label className="text-sm font-medium">Shared with</label>
              <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
                {shared.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300 text-xs font-medium pl-2.5 pr-1.5 py-1"
                  >
                    {u.username}
                    <button
                      type="button"
                      onClick={() => removeUser(u.id)}
                      aria-label={`Remove ${u.username}`}
                      className="text-accent/60 hover:text-red-600 dark:text-blue-300/60 dark:hover:text-red-400"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {shared.length === 0 && (
                  <span className="text-xs text-black/40 dark:text-white/40 py-1">Not shared with anyone yet</span>
                )}
              </div>
              <input
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Search users to add..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {suggestions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => addUser(u)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-black/[0.03] dark:hover:bg-white/5"
                    >
                      {u.username}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <span className="btn-glow inline-block">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
                >
                  Cancel
                </button>
              </span>
              <span className="btn-glow inline-block">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
