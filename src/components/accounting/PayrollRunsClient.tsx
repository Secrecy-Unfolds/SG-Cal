"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PayrollRunRow } from "@/lib/accounting";
import { HudFrame } from "@/components/hud/HudFrame";

function currentMonthInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatRunMonth(runMonth: string): string {
  const d = new Date(runMonth);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function PayrollRunsClient({ runs }: { runs: PayrollRunRow[] }) {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonthInput());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleRunPayroll() {
    setRunning(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const runMonth = `${month}-01`;
      const res = await fetch("/api/accounting/payroll-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runMonth }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to run payroll");
        return;
      }
      setSuccessMessage(`Payroll run — ${data.transactionsCreated} employee${data.transactionsCreated === 1 ? "" : "s"} paid.`);
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <HudFrame
        corners="all"
        className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4 mb-4 flex flex-wrap items-end gap-3"
      >
        <div className="space-y-1">
          <label className="text-sm font-medium">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm dark:[color-scheme:dark]"
          />
        </div>
        <span className="btn-glow inline-block">
          <button
            onClick={handleRunPayroll}
            disabled={running}
            className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {running ? "Running..." : "Run payroll"}
          </button>
        </span>
      </HudFrame>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
      {successMessage && <p className="text-sm text-green-600 dark:text-green-400 mb-3">{successMessage}</p>}

      <h2 className="font-heading font-semibold text-sm uppercase tracking-wide mb-2">Past runs</h2>
      {runs.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No payroll runs yet.</p>
      ) : (
        <div className="space-y-2">
          {runs.map((r) => (
            <HudFrame
              key={r.id}
              corners="tl-br"
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
            >
              <span className="min-w-0 truncate text-sm font-medium">{formatRunMonth(r.run_month)}</span>
              <span className="min-w-0 truncate text-xs text-black/50 dark:text-white/50">
                Run by {r.run_by_username ?? "—"}
              </span>
            </HudFrame>
          ))}
        </div>
      )}
    </div>
  );
}
