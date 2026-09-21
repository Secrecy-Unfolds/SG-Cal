"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/hud/PageHeader";
import { HudFrameButton } from "@/components/hud/HudFrame";
import PlanFormModal from "@/components/plans/PlanFormModal";
import PlanProgressBar from "@/components/plans/PlanProgressBar";
import PlanShareModal from "@/components/plans/PlanShareModal";
import MilestoneFormModal from "@/components/plans/MilestoneFormModal";
import PlanHierarchyGraph from "@/components/plans/PlanHierarchyGraph";
import SegmentedToggle from "@/components/plans/SegmentedToggle";
import type { PlanRow } from "@/lib/plans";
import type { MilestoneRow } from "@/lib/planMilestones";
import type { PlanProgress } from "@/lib/planProgress";
import type { StartFloor } from "@/lib/planTiming";
import {
  milestoneTreeNode,
  type GraphFrame,
  type GraphMilestone,
  type StrategyGraphDepth,
  type TreeNode,
} from "@/lib/planGraph";
import { PLAN_TYPE_LABELS } from "@/lib/planDisplay";
import { formatDateOnly } from "@/lib/procurementDisplay";

export default function StrategyDetailClient({
  plan,
  milestones,
  progressByMilestone,
  graphMilestones,
  milestoneStartFloor,
  isAdmin,
}: {
  plan: PlanRow;
  milestones: MilestoneRow[];
  progressByMilestone: Record<number, PlanProgress>;
  graphMilestones: GraphMilestone[];
  milestoneStartFloor: StartFloor;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "graph">("list");
  const [depth, setDepth] = useState<StrategyGraphDepth>("stages");

  const treeNodes = useMemo(
    () => graphMilestones.map((m) => milestoneTreeNode(m, plan.id, depth)),
    [graphMilestones, plan.id, depth]
  );
  const frames = useMemo<GraphFrame[]>(() => [{ kindLabel: "Strategy", name: plan.name }], [plan.name]);
  const handleSelectNode = useCallback((node: TreeNode) => node.href && router.push(node.href), [router]);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [showCreateMilestone, setShowCreateMilestone] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  function afterPlanChange() {
    setShowEditPlan(false);
    router.refresh();
  }

  function afterPlanDeleted() {
    router.push("/plans");
  }

  function afterMilestoneChange() {
    setShowCreateMilestone(false);
    router.refresh();
  }

  async function handleDuplicate() {
    setDuplicating(true);
    setDuplicateError(null);
    try {
      const res = await fetch(`/api/plans/${plan.id}/duplicate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDuplicateError(data.error ?? "Failed to duplicate");
        return;
      }
      router.push(`/plans/${data.id}`);
    } catch {
      setDuplicateError("Network error — check your connection and try again.");
    } finally {
      setDuplicating(false);
    }
  }

  const overall =
    milestones.length === 0
      ? { total: 0, done: 0, progress: 0 }
      : (() => {
          const progresses = milestones.map((m) => progressByMilestone[m.id]?.progress ?? 0);
          return {
            total: milestones.length,
            done: progresses.filter((p) => p === 100).length,
            progress: Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length),
          };
        })();

  return (
    <div>
      <PageHeader label={PLAN_TYPE_LABELS.strategy.toUpperCase()} title={plan.name}>
        {isAdmin && (
          <div className="flex flex-wrap gap-2 justify-end">
            <span className="btn-glow inline-block">
              <button
                onClick={() => setShowShare(true)}
                className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
              >
                Share
              </button>
            </span>
            <span className="btn-glow inline-block">
              <button
                onClick={handleDuplicate}
                disabled={duplicating}
                className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-50"
              >
                {duplicating ? "Duplicating..." : "Duplicate"}
              </button>
            </span>
            <span className="btn-glow inline-block">
              <button
                onClick={() => setShowEditPlan(true)}
                className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
              >
                Edit
              </button>
            </span>
            <span className="btn-glow inline-block">
              <button
                onClick={() => setShowCreateMilestone(true)}
                className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
              >
                + New Milestone
              </button>
            </span>
          </div>
        )}
      </PageHeader>

      <div className="rounded-2xl border border-black/5 dark:border-white/10 p-4 mb-4 bg-white dark:bg-neutral-900">
        <div className="text-xs text-black/50 dark:text-white/50">Start date: {formatDateOnly(plan.start_date)}</div>
        {plan.description && <div className="text-sm mt-2 whitespace-pre-wrap">{plan.description}</div>}
        <PlanProgressBar
          progress={overall.progress}
          total={overall.total}
          done={overall.done}
          unit="milestones"
          className="mt-3"
        />
        {duplicateError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{duplicateError}</p>}
      </div>

      {milestones.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <SegmentedToggle
            options={[
              { value: "list", label: "List" },
              { value: "graph", label: "Graph" },
            ]}
            value={view}
            onChange={setView}
          />
          {view === "graph" && (
            <SegmentedToggle
              options={[
                { value: "milestones", label: "Milestones only" },
                { value: "stages", label: "+ Stages" },
                { value: "steps", label: "+ Steps" },
              ]}
              value={depth}
              onChange={setDepth}
            />
          )}
        </div>
      )}

      {milestones.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          No milestones yet{isAdmin ? " — add the first one." : "."}
        </p>
      ) : view === "graph" ? (
        <PlanHierarchyGraph nodes={treeNodes} frames={frames} onSelectNode={handleSelectNode} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {milestones.map((milestone) => {
            const progress = progressByMilestone[milestone.id] ?? { total: 0, done: 0, progress: 0 };
            const prerequisite = milestone.prerequisite_milestone_id
              ? milestones.find((m) => m.id === milestone.prerequisite_milestone_id)
              : null;
            const prerequisiteUnmet = !!prerequisite && (progressByMilestone[prerequisite.id]?.progress ?? 0) < 100;
            return (
              <HudFrameButton
                key={milestone.id}
                corners="tl-br"
                onClick={() => router.push(`/plans/${plan.id}/milestones/${milestone.id}`)}
                className="text-left bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4 hover:border-accent/40 card-glow"
              >
                <div className="text-sm font-medium truncate">{milestone.name}</div>
                {milestone.start_date && (
                  <div className="text-xs text-black/50 dark:text-white/50 mt-1">
                    Start date: {formatDateOnly(milestone.start_date)}
                  </div>
                )}
                {milestone.description && (
                  <div className="text-xs text-black/50 dark:text-white/50 mt-1 line-clamp-2">{milestone.description}</div>
                )}
                {prerequisite && (
                  <div className={`text-xs mt-1.5 ${prerequisiteUnmet ? "text-amber-600 dark:text-amber-400" : "text-black/40 dark:text-white/40"}`}>
                    {prerequisiteUnmet ? "Waiting on" : "After"}: {prerequisite.name}
                  </div>
                )}
                <PlanProgressBar
                  progress={progress.progress}
                  total={progress.total}
                  done={progress.done}
                  unit="stages"
                  className="mt-3"
                />
              </HudFrameButton>
            );
          })}
        </div>
      )}

      {showEditPlan && (
        <PlanFormModal plan={plan} onClose={() => setShowEditPlan(false)} onSaved={afterPlanChange} onDeleted={afterPlanDeleted} />
      )}
      {showCreateMilestone && (
        <MilestoneFormModal
          strategyPlanId={plan.id}
          otherMilestones={milestones}
          startFloor={milestoneStartFloor}
          onClose={() => setShowCreateMilestone(false)}
          onSaved={afterMilestoneChange}
          onDeleted={afterMilestoneChange}
        />
      )}
      {showShare && <PlanShareModal planId={plan.id} onClose={() => setShowShare(false)} onSaved={() => setShowShare(false)} />}
    </div>
  );
}
