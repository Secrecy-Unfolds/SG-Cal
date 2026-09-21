"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanRow } from "@/lib/plans";
import type { StepRow } from "@/lib/planSteps";
import type { StrategyTarget } from "@/lib/planMilestones";
import { daysBetweenDates, defaultStartDate, startBeforeFloorMessage, type StartFloor } from "@/lib/planTiming";
import { toMuscatDateInput } from "@/lib/time";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent [color-scheme:light] dark:[color-scheme:dark]";
const optionClass = "bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100";

type Mode = "duplicate" | "move";

// Adds the current standalone Process to a Strategy's Milestone as a Stage
// (see lib/plans.ts's addProcessToStrategy): either a duplicate (fresh,
// zero-progress copy on a new start date — every step shifted by the same
// number of days) or moving the process itself in.
export default function AddToStrategyModal({
  plan,
  steps,
  onClose,
  onDone,
}: {
  plan: PlanRow;
  steps: StepRow[];
  onClose: () => void;
  onDone: (newPlanId: number) => void;
}) {
  const [strategies, setStrategies] = useState<StrategyTarget[] | null>(null);
  const [strategyId, setStrategyId] = useState<number | null>(null);
  const [milestoneId, setMilestoneId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("duplicate");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plans/strategy-targets")
      .then((res) => (res.ok ? res.json() : { strategies: [] }))
      .then((data) => setStrategies(data.strategies ?? []))
      .catch(() => setStrategies([]));
  }, []);

  const strategy = strategies?.find((s) => s.id === strategyId) ?? null;
  const milestone = strategy?.milestones.find((m) => m.id === milestoneId) ?? null;

  // Latest start among the chosen Milestone and its Strategy — the earliest
  // date the new Stage may start on (same rule the server enforces).
  const floor: StartFloor = useMemo(() => {
    if (!strategy || !milestone) return null;
    if (milestone.start_date && (!strategy.start_date || milestone.start_date >= strategy.start_date)) {
      return { date: milestone.start_date, label: `Milestone "${milestone.name}"` };
    }
    return strategy.start_date ? { date: strategy.start_date, label: `Strategy "${strategy.name}"` } : null;
  }, [strategy, milestone]);

  // Where the duplicate's dates are measured from: the process's own start
  // date, or its earliest step if it has none (or a step predates it).
  const baseline = useMemo(() => {
    const dates = [plan.start_date, ...steps.map((s) => toMuscatDateInput(new Date(s.start_at)))].filter(
      (d): d is string => !!d
    );
    return dates.length === 0 ? null : dates.reduce((min, d) => (d < min ? d : min));
  }, [plan.start_date, steps]);

  const effectiveStart = startDate || (milestone ? defaultStartDate(floor) : "");
  const shiftDays = baseline && effectiveStart ? daysBetweenDates(baseline, effectiveStart) : 0;
  const moveBlocked = !!floor && !!baseline && baseline < floor.date;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!milestoneId) {
      setError("Pick a strategy and a milestone");
      return;
    }
    if (mode === "duplicate") {
      if (!effectiveStart) {
        setError("A start date is required for the duplicate");
        return;
      }
      if (floor && effectiveStart < floor.date) {
        setError(startBeforeFloorMessage("A stage", floor));
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/plans/${plan.id}/add-to-strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId, mode, startDate: mode === "duplicate" ? effectiveStart : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add to strategy");
        return;
      }
      onDone(data.id);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">Add to strategy</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-black/50 dark:text-white/50">
          Use &ldquo;{plan.name}&rdquo; as a Stage inside a Strategy&rsquo;s Milestone.
        </p>

        {strategies === null ? (
          <p className="text-sm text-black/50 dark:text-white/50">Loading strategies…</p>
        ) : strategies.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">There are no strategies yet — create one first.</p>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium">Strategy</label>
              <select
                className={inputClass}
                value={strategyId ?? ""}
                onChange={(e) => {
                  setStrategyId(e.target.value ? Number(e.target.value) : null);
                  setMilestoneId(null);
                  setStartDate("");
                }}
              >
                <option className={optionClass} value="">
                  Choose a strategy…
                </option>
                {strategies.map((s) => (
                  <option key={s.id} className={optionClass} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {strategy && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Milestone</label>
                {strategy.milestones.length === 0 ? (
                  <p className="text-xs text-black/50 dark:text-white/50">
                    This strategy has no milestones yet — add one to it first.
                  </p>
                ) : (
                  <select
                    className={inputClass}
                    value={milestoneId ?? ""}
                    onChange={(e) => {
                      setMilestoneId(e.target.value ? Number(e.target.value) : null);
                      setStartDate("");
                    }}
                  >
                    <option className={optionClass} value="">
                      Choose a milestone…
                    </option>
                    {strategy.milestones.map((m) => (
                      <option key={m.id} className={optionClass} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {milestone && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">How</label>
                  <label
                    className={`flex gap-2 rounded-lg border p-3 cursor-pointer text-sm ${
                      mode === "duplicate"
                        ? "border-accent bg-accent/10"
                        : "border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
                    }`}
                  >
                    <input type="radio" checked={mode === "duplicate"} onChange={() => setMode("duplicate")} />
                    <span>
                      <span className="font-medium">Duplicate</span>
                      <span className="block text-xs text-black/50 dark:text-white/50">
                        A fresh copy becomes the stage, starting at 0% progress on a new start date. This process is
                        left as it is.
                      </span>
                    </span>
                  </label>
                  <label
                    className={`flex gap-2 rounded-lg border p-3 cursor-pointer text-sm ${
                      mode === "move"
                        ? "border-accent bg-accent/10"
                        : "border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
                    }`}
                  >
                    <input type="radio" checked={mode === "move"} onChange={() => setMode("move")} />
                    <span>
                      <span className="font-medium">Use this process (move it in)</span>
                      <span className="block text-xs text-black/50 dark:text-white/50">
                        This process itself becomes the stage, keeping its steps, progress and dates. It will no longer
                        be a standalone process, and only people the strategy is shared with can see it.
                      </span>
                    </span>
                  </label>
                </div>

                {mode === "duplicate" ? (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Start date</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={effectiveStart}
                      min={floor?.date}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                    {floor && (
                      <p className="text-xs text-black/40 dark:text-white/40">
                        Can&rsquo;t start before {floor.date} &mdash; the start of {floor.label}.
                      </p>
                    )}
                    <p className="text-xs text-black/50 dark:text-white/50">
                      {baseline
                        ? shiftDays === 0
                          ? "Every step keeps its current date."
                          : `Every step moves ${Math.abs(shiftDays)} day${Math.abs(shiftDays) === 1 ? "" : "s"} ${
                              shiftDays > 0 ? "later" : "earlier"
                            } (measured from ${baseline}), keeping the spacing between steps.`
                        : "This process has no dates yet, so there is nothing to shift."}
                    </p>
                  </div>
                ) : (
                  moveBlocked && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      This process starts on {baseline}, before {floor!.label} starts ({floor!.date}), so it can&rsquo;t be
                      moved in as is. Choose Duplicate to pick a new start date.
                    </p>
                  )
                )}
              </>
            )}
          </>
        )}

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
              type="submit"
              disabled={saving || !milestone || (mode === "move" && moveBlocked)}
              className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Adding..." : mode === "duplicate" ? "Duplicate into strategy" : "Move into strategy"}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}
