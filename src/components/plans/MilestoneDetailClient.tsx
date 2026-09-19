"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/hud/PageHeader";
import { HudFrameButton } from "@/components/hud/HudFrame";
import MilestoneFormModal from "@/components/plans/MilestoneFormModal";
import StageFormModal from "@/components/plans/StageFormModal";
import PlanProgressBar from "@/components/plans/PlanProgressBar";
import type { PlanRow } from "@/lib/plans";
import type { MilestoneRow, StagePlanRow } from "@/lib/planMilestones";
import type { PlanProgress } from "@/lib/planProgress";
import { formatDateOnly } from "@/lib/procurementDisplay";

export default function MilestoneDetailClient({
  strategyPlan,
  milestone,
  siblingMilestones,
  stages,
  progressByStage,
  isAdmin,
}: {
  strategyPlan: PlanRow;
  milestone: MilestoneRow;
  siblingMilestones: MilestoneRow[];
  stages: StagePlanRow[];
  progressByStage: Record<number, PlanProgress>;
  isAdmin: boolean;
}) {
  const router = useRouter();
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
        {milestone.description && <div className="text-sm whitespace-pre-wrap">{milestone.description}</div>}
        <PlanProgressBar
          progress={overall.progress}
          total={overall.total}
          done={overall.done}
          unit="stages"
          className="mt-3"
        />
      </div>

      {stages.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          No stages yet{isAdmin ? " — add the first one." : "."}
        </p>
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
          onClose={() => setShowEdit(false)}
          onSaved={afterMilestoneChange}
          onDeleted={afterMilestoneDeleted}
        />
      )}
      {showCreateStage && (
        <StageFormModal milestoneId={milestone.id} onClose={() => setShowCreateStage(false)} onSaved={afterStageChange} />
      )}
    </div>
  );
}
