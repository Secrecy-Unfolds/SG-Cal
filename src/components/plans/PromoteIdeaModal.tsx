"use client";

import { useState } from "react";
import type { PlanRow } from "@/lib/plans";
import type { StepRow } from "@/lib/planSteps";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

type StageDraft = { name: string; description: string };
type MilestoneDraft = { name: string; description: string; stages: StageDraft[] };

// Idea -> Strategy is a GUIDED reorg (confirmed 2026-09-19), not
// auto-created placeholders — the admin explicitly defines every
// Milestone/Stage here and explicitly assigns every one of the Idea's
// existing steps into one before this can submit. Idea -> Process is just
// a bare plan_type flip with no reorg needed (existing steps carry over
// untouched).
export default function PromoteIdeaModal({
  plan,
  steps,
  onClose,
  onPromoted,
}: {
  plan: PlanRow;
  steps: StepRow[];
  onClose: () => void;
  onPromoted: () => void;
}) {
  const [targetType, setTargetType] = useState<"process" | "strategy">("process");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { name: "", description: "", stages: [{ name: "", description: "" }] },
  ]);
  const [stepAssignments, setStepAssignments] = useState<Record<number, { milestoneIndex: number; stageIndex: number }>>(
    {}
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addMilestone() {
    setMilestones((prev) => [...prev, { name: "", description: "", stages: [{ name: "", description: "" }] }]);
  }

  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
    setStepAssignments((prev) => {
      const next = { ...prev };
      for (const [stepId, a] of Object.entries(next)) {
        if (a.milestoneIndex === index) delete next[Number(stepId)];
      }
      return next;
    });
  }

  function updateMilestone(index: number, field: "name" | "description", value: string) {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  }

  function addStage(milestoneIndex: number) {
    setMilestones((prev) =>
      prev.map((m, i) => (i === milestoneIndex ? { ...m, stages: [...m.stages, { name: "", description: "" }] } : m))
    );
  }

  function removeStage(milestoneIndex: number, stageIndex: number) {
    setMilestones((prev) =>
      prev.map((m, i) => (i === milestoneIndex ? { ...m, stages: m.stages.filter((_, si) => si !== stageIndex) } : m))
    );
    setStepAssignments((prev) => {
      const next = { ...prev };
      for (const [stepId, a] of Object.entries(next)) {
        if (a.milestoneIndex === milestoneIndex && a.stageIndex === stageIndex) delete next[Number(stepId)];
      }
      return next;
    });
  }

  function updateStage(milestoneIndex: number, stageIndex: number, field: "name" | "description", value: string) {
    setMilestones((prev) =>
      prev.map((m, i) =>
        i === milestoneIndex
          ? { ...m, stages: m.stages.map((s, si) => (si === stageIndex ? { ...s, [field]: value } : s)) }
          : m
      )
    );
  }

  function assignStep(stepId: number, milestoneIndex: number, stageIndex: number) {
    setStepAssignments((prev) => ({ ...prev, [stepId]: { milestoneIndex, stageIndex } }));
  }

  const stageOptions = milestones.flatMap((m, mi) =>
    m.stages.map((s, si) => ({
      milestoneIndex: mi,
      stageIndex: si,
      label: `${m.name || `Milestone ${mi + 1}`} / ${s.name || `Stage ${si + 1}`}`,
    }))
  );

  const strategyReady =
    milestones.length > 0 &&
    milestones.every((m) => m.name.trim() && m.stages.length > 0 && m.stages.every((s) => s.name.trim())) &&
    steps.every((s) => stepAssignments[s.id] !== undefined);

  async function handlePromote() {
    setSaving(true);
    setError(null);
    try {
      const body =
        targetType === "process"
          ? { targetType: "process" }
          : {
              targetType: "strategy",
              milestones: milestones.map((m) => ({
                name: m.name.trim(),
                description: m.description.trim(),
                stages: m.stages.map((s) => ({ name: s.name.trim(), description: s.description.trim() })),
              })),
              stepAssignments,
            };
      const res = await fetch(`/api/plans/${plan.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to promote");
        return;
      }
      onPromoted();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">Promote &ldquo;{plan.name}&rdquo;</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm">
          <span className="btn-glow flex-1">
            <button
              type="button"
              onClick={() => setTargetType("process")}
              className={`w-full btn-skew py-1.5 font-medium transition-colors ${
                targetType === "process" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
              }`}
            >
              Process
            </button>
          </span>
          <span className="btn-glow flex-1">
            <button
              type="button"
              onClick={() => setTargetType("strategy")}
              className={`w-full btn-skew py-1.5 font-medium transition-colors ${
                targetType === "strategy" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
              }`}
            >
              Strategy
            </button>
          </span>
        </div>

        {targetType === "process" ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            This Idea becomes a Process — its {steps.length} existing step{steps.length === 1 ? "" : "s"} carry over
            untouched.
          </p>
        ) : (
          <>
            <p className="text-xs text-black/40 dark:text-white/40">
              Define this Strategy&rsquo;s Milestones and Stages, then place every existing step into one of them.
            </p>

            <div className="space-y-3">
              {milestones.map((m, mi) => (
                <div key={mi} className="rounded-lg border border-black/10 dark:border-white/10 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      className={inputClass}
                      placeholder={`Milestone ${mi + 1} name`}
                      value={m.name}
                      onChange={(e) => updateMilestone(mi, "name", e.target.value)}
                    />
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMilestone(mi)}
                        className="text-xs text-red-600 dark:text-red-400 shrink-0"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <textarea
                    className={`${inputClass} min-h-[40px]`}
                    placeholder="Description (optional)"
                    value={m.description}
                    onChange={(e) => updateMilestone(mi, "description", e.target.value)}
                  />

                  <div className="pl-3 space-y-1.5 border-l-2 border-black/5 dark:border-white/10">
                    {m.stages.map((s, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <input
                          className={inputClass}
                          placeholder={`Stage ${si + 1} name`}
                          value={s.name}
                          onChange={(e) => updateStage(mi, si, "name", e.target.value)}
                        />
                        {m.stages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStage(mi, si)}
                            className="text-xs text-red-600 dark:text-red-400 shrink-0"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addStage(mi)}
                      className="text-xs text-accent dark:text-blue-300 hover:underline"
                    >
                      + Add stage
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addMilestone} className="text-xs text-accent dark:text-blue-300 hover:underline">
                + Add milestone
              </button>
            </div>

            {steps.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Assign existing steps</label>
                {steps.map((step) => {
                  const assignment = stepAssignments[step.id];
                  const value = assignment ? `${assignment.milestoneIndex}:${assignment.stageIndex}` : "";
                  return (
                    <div key={step.id} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{step.title}</span>
                      <select
                        className={`${inputClass} w-48 [color-scheme:light] dark:[color-scheme:dark]`}
                        value={value}
                        onChange={(e) => {
                          const [mi, si] = e.target.value.split(":").map(Number);
                          assignStep(step.id, mi, si);
                        }}
                      >
                        <option className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100" value="">
                          Choose a stage...
                        </option>
                        {stageOptions.map((opt) => (
                          <option
                            key={`${opt.milestoneIndex}:${opt.stageIndex}`}
                            className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100"
                            value={`${opt.milestoneIndex}:${opt.stageIndex}`}
                          >
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
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
              type="button"
              onClick={handlePromote}
              disabled={saving || (targetType === "strategy" && !strategyReady)}
              className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Promoting..." : "Promote"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
