"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/hud/PageHeader";
import { HudFrameButton } from "@/components/hud/HudFrame";
import MilestoneFormModal from "@/components/plans/MilestoneFormModal";
import StageFormModal from "@/components/plans/StageFormModal";
import PlanProgressBar from "@/components/plans/PlanProgressBar";
import PlanHierarchyGraph from "@/components/plans/PlanHierarchyGraph";
import SegmentedToggle from "@/components/plans/SegmentedToggle";
import type { PlanRow } from "@/lib/plans";
import type { MilestoneRow, StagePlanRow } from "@/lib/planMilestones";
import type { PlanProgress } from "@/lib/planProgress";
import type { StartFloor } from "@/lib/planTiming";
import {
  stageTreeNode,
  type GraphFrame,
  type GraphStage,
  type MilestoneGraphDepth,
  type TreeNode,
} from "@/lib/planGraph";
import { formatDateOnly } from "@/lib/procurementDisplay";

export default function MilestoneDetailClient({
  strategyPlan,
  milestone,
  siblingMilestones,
  stages,
  progressByStage,
  graphStages,
  milestoneStartFloor,
  stageStartFloor,
  isAdmin,
}: {
  strategyPlan: PlanRow;
  milestone: MilestoneRow;
  siblingMilestones: MilestoneRow[];
  stages: StagePlanRow[];
  progressByStage: Record<number, PlanProgress>;
  graphStages: GraphStage[];
  // Earliest date this milestone itself may start on (its Strategy's start).
  milestoneStartFloor: StartFloor;
  // Earliest date a new Stage inside it may start on (this Milestone's /
  // its Strategy's start).
  stageStartFloor: StartFloor;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "graph">("list");
  const [depth, setDepth] = useState<MilestoneGraphDepth>("stages");

  const treeNodes = useMemo(
    () => graphStages.map((s) => stageTreeNode(s, depth === "steps")),
    [graphStages, depth]
  );
  const frames = useMemo<GraphFrame[]>(
    () => [
      { kindLabel: "Strategy", name: strategyPlan.name },
      { kindLabel: "Milestone", name: milestone.name },
    ],
    [strategyPlan.name, milestone.name]
  );
  const handleSelectNode = useCallback((node: TreeNode) => node.href && router.push(node.href), [router]);
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateStage, setShowCreateStage] = useState(false);

  function afterMilestoneChange() {
    setShowEdit(false);
    router.refresh();
  }

  function afterMilestoneDeleted() {
    router.push(`/plans/${strategyPlan.id}`);
  }

  function afterStageChange() {
    setShowCreateStage(false);
    router.refresh();
  }

  const overall =
    stages.length === 0
      ? { total: 0, done: 0, progress: 0 }
      : (() => {
          const progresses = stages.map((s) => progressByStage[s.id]?.progress ?? 0);
          return {
            total: stages.length,
            done: progresses.filter((p) => p === 100).length,
            progress: Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length),
          };
        })();

  return (
    <div>
      <PageHeader label={`${strategyPlan.name.toUpperCase()} / MILESTONE`} title={milestone.name}>
        {isAdmin && (
          <div className="flex gap-2">
            <span className="btn-glow inline-block">
              <button
                onClick={() => setShowEdit(true)}
                className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
              >
                Edit
              </button>
            </span>
            <span className="btn-glow inline-block">
              <button
                onClick={() => setShowCreateStage(true)}
                className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
              >
                + New Stage
              </button>
            </span>
          </div>
        )}
      </PageHeader>

      <div className="rounded-2xl border border-black/5 dark:border-white/10 p-4 mb-4 bg-white dark:bg-neutral-900">
        <div className="text-xs text-black/50 dark:text-white/50">Start date: {formatDateOnly(milestone.start_date)}</div>
        {milestone.description && <div className="text-sm mt-2 whitespace-pre-wrap">{milestone.description}</div>}
        <PlanProgressBar
          progress={overall.progress}
          total={overall.total}
          done={overall.done}
          unit="stages"
          className="mt-3"
        />
      </div>

      {stages.length > 0 && (
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
                { value: "stages", label: "Stages only" },
                { value: "steps", label: "+ Steps" },
              ]}
              value={depth}
              onChange={setDepth}
            />
          )}
        </div>
      )}

      {stages.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          No stages yet{isAdmin ? " — add the first one." : "."}
        </p>
      ) : view === "graph" ? (
        <PlanHierarchyGraph nodes={treeNodes} frames={frames} onSelectNode={handleSelectNode} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stages.map((stage) => {
            const progress = progressByStage[stage.id] ?? { total: 0, done: 0, progress: 0 };
            return (
              <HudFrameButton
                key={stage.id}
                corners="tl-br"
                onClick={() => router.push(`/plans/${stage.id}`)}
                className="text-left bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4 hover:border-accent/40 card-glow"
              >
                <div className="text-sm font-medium truncate">{stage.name}</div>
                <div className="text-xs text-black/50 dark:text-white/50 mt-1">
                  Start date: {formatDateOnly(stage.start_date)}
                </div>
                {stage.prerequisite_stage_id !== null && (
                  <div className="text-xs text-black/40 dark:text-white/40 mt-1">
                    After: {stages.find((s) => s.id === stage.prerequisite_stage_id)?.name ?? "—"}
                  </div>
                )}
                {stage.description && (
                  <div className="text-xs text-black/50 dark:text-white/50 mt-2 line-clamp-2">{stage.description}</div>
                )}
                <PlanProgressBar
                  progress={progress.progress}
                  total={progress.total}
                  done={progress.done}
                  className="mt-3"
                />
              </HudFrameButton>
            );
          })}
        </div>
      )}

      {showEdit && (
        <MilestoneFormModal
          strategyPlanId={strategyPlan.id}
          otherMilestones={siblingMilestones}
          milestone={milestone}
          startFloor={milestoneStartFloor}
          onClose={() => setShowEdit(false)}
          onSaved={afterMilestoneChange}
          onDeleted={afterMilestoneDeleted}
        />
      )}
      {showCreateStage && (
        <StageFormModal
          milestoneId={milestone.id}
          startFloor={stageStartFloor}
          siblingStages={stages.map((s) => ({ id: s.id, name: s.name }))}
          onClose={() => setShowCreateStage(false)}
          onSaved={afterStageChange}
        />
      )}
    </div>
  );
}
