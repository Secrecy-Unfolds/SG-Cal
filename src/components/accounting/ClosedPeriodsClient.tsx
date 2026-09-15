"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ClosePeriodFormModal from "@/components/accounting/ClosePeriodFormModal";
import type { ClosedPeriodRow } from "@/lib/periodClosing";
import type { UserRole } from "@/lib/users";
import { HudFrame } from "@/components/hud/HudFrame";

export default function ClosedPeriodsClient({ periods, actorRole }: { periods: ClosedPeriodRow[]; actorRole: UserRole }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [reopeningId, setReopeningId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSuperAdmin = actorRole === "super_admin";

  async function handleReopen(id: number) {
    setReopeningId(id);
    setError(null);
    try {
      const res = await fetch(`/api/closed-periods/${id}`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to reopen period");
        return;
      }
      router.refresh();
    } finally {
      setReopeningId(null);
    }
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      {!isSuperAdmin && (
        <p className="text-xs text-black/50 dark:text-white/50 mb-4">Only a Super Admin can close or reopen a period.</p>
      )}

      {isSuperAdmin && (
        <div className="flex justify-end mb-4">
          <span className="btn-glow inline-block">
            <button onClick={() => setShowCreate(true)} className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium">
              + Close a Period
            </button>
          </span>
        </div>
      )}

      {periods.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No periods closed yet.</p>
      ) : (
        <div className="space-y-2">
          {periods.map((p) => {
            const open = !p.reopened_at;
            return (
              <HudFrame
                key={p.id}
                corners="tl-br"
                className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                        open
                          ? "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          : "bg-black/5 dark:bg-white/10 text-black/40 dark:text-white/40"
                      }`}
                    >
                      {open ? "Closed" : "Reopened"}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium">{p.label || "Untitled period"}</span>
                  </div>
                  <div className="text-xs text-black/50 dark:text-white/50 truncate">
                    {p.period_start} → {p.period_end}
                    {p.closed_by_username ? ` · closed by ${p.closed_by_username}` : ""}
                  </div>
                </div>
                {isSuperAdmin && open && (
                  <button
                    onClick={() => handleReopen(p.id)}
                    disabled={reopeningId === p.id}
                    className="text-xs text-accent hover:underline shrink-0 disabled:opacity-50"
                  >
                    {reopeningId === p.id ? "Reopening..." : "Reopen"}
                  </button>
                )}
              </HudFrame>
            );
          })}
        </div>
      )}

      {showCreate && (
        <ClosePeriodFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
