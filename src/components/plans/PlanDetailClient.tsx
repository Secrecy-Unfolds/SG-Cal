"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/hud/PageHeader";
import PlanFormModal from "@/components/plans/PlanFormModal";
import PlanProgressBar from "@/components/plans/PlanProgressBar";
import PlanShareModal from "@/components/plans/PlanShareModal";
import PromoteIdeaModal from "@/components/plans/PromoteIdeaModal";
import AddToStrategyModal from "@/components/plans/AddToStrategyModal";
import StepFormModal from "@/components/plans/StepFormModal";
import StepCard from "@/components/plans/StepCard";
import PlanHierarchyGraph from "@/components/plans/PlanHierarchyGraph";
import SegmentedToggle from "@/components/plans/SegmentedToggle";
import type { PlanRow } from "@/lib/plans";
import type { StepRow } from "@/lib/planSteps";
import type { PlanProgress } from "@/lib/planProgress";
import type { StartFloor } from "@/lib/planTiming";
import { graphStepFromRow, stepTreeNode, type GraphFrame, type TreeNode } from "@/lib/planGraph";
import { PLAN_TYPE_LABELS, type StepStatus } from "@/lib/planDisplay";
import { formatDateOnly } from "@/lib/procurementDisplay";

export default function PlanDetailClient({
  plan,
  steps,
  progress,
  backLink,
  stepStartFloor,
  planStartFloor,
  siblingStages,
  frames,
  isAdmin,
}: {
  plan: PlanRow;
  steps: StepRow[];
  progress: PlanProgress;
  backLink?: { href: string; label: string } | null;
  // Earliest date a step in this plan may start on (this plan's own start,
  // and — for a Stage — its Milestone's / Strategy's).
  stepStartFloor: StartFloor;
  // Earliest date this plan's OWN start may be set to (a Stage only —
  // its Milestone's / Strategy's start).
  planStartFloor: StartFloor;
  siblingStages: { id: number; name: string }[];
  // Strategy > Milestone > Stage context the step graph is drawn inside
  // (empty for a standalone Process/Idea).
  frames: GraphFrame[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [showCreateStep, setShowCreateStep] = useState(false);
  const [editingStep, setEditingStep] = useState<StepRow | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const [showAddToStrategy, setShowAddToStrategy] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "graph">("list");

  const isRoot = plan.parent_milestone_id === null;

  function afterPlanChange() {
    setShowEditPlan(false);
    router.refresh();
  }

  function afterPlanDeleted() {
    router.push(backLink ? backLink.href : "/plans");
  }

  function afterStepChange() {
    setShowCreateStep(false);
    setEditingStep(null);
    router.refresh();
  }

  async function handleStatusChange(step: StepRow, status: StepStatus): Promise<string | null> {
    const res = await fetch(`/api/plans/steps/${step.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Failed to update status";
    router.refresh();
    return null;
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

  const otherStepOptions = steps.map((s) => ({ id: s.id, title: s.title }));

  const treeNodes = useMemo(() => steps.map((s) => stepTreeNode(graphStepFromRow(s))), [steps]);
  const handleSelectNode = useCallback(
    (node: TreeNode) => {
      if (!isAdmin) return;
      const step = steps.find((s) => s.id === node.stepId);
      if (step) setEditingStep(step);
    },
    [isAdmin, steps]
  );

  return (
    <div>
      {backLink && (
        <Link href={backLink.href} className="text-xs text-accent dark:text-blue-300 hover:underline">
          ← Back to Milestone: {backLink.label}
        </Link>
      )}
      <PageHeader label={PLAN_TYPE_LABELS[plan.plan_type].toUpperCase()} title={plan.name}>
        {isAdmin && (
          <div className="flex flex-wrap gap-2 justify-end">
            {isRoot && (
              <span className="btn-glow inline-block">
                <button
                  onClick={() => setShowShare(true)}
                  className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
                >
                  Share
                </button>
              </span>
            )}
            {isRoot && (
              <span className="btn-glow inline-block">
                <button
                  onClick={handleDuplicate}
                  disabled={duplicating}
                  className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-50"
                >
                  {duplicating ? "Duplicating..." : "Duplicate"}
                </button>
              </span>
            )}
            {plan.plan_type === "process" && isRoot && (
              <span className="btn-glow inline-block">
                <button
                  onClick={() => setShowAddToStrategy(true)}
                  className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
                >
                  Add to Strategy
                </button>
              </span>
            )}
            {plan.plan_type === "idea" && (
              <span className="btn-glow inline-block">
                <button
                  onClick={() => setShowPromote(true)}
                  className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
                >
                  Promote
                </button>
              </span>
            )}
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
                onClick={() => setShowCreateStep(true)}
                className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
              >
                + New Step
              </button>
            </span>
          </div>
        )}
      </PageHeader>

      <div className="rounded-2xl border border-black/5 dark:border-white/10 p-4 mb-4 bg-white dark:bg-neutral-900">
        <div className="text-xs text-black/50 dark:text-white/50">
          Start date: {formatDateOnly(plan.start_date)}
          {isRoot && plan.project_name && ` · Project: ${plan.project_name}`}
        </div>
        {plan.description && <div className="text-sm mt-2 whitespace-pre-wrap">{plan.description}</div>}
        <PlanProgressBar progress={progress.progress} total={progress.total} done={progress.done} className="mt-3" />
        {duplicateError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{duplicateError}</p>}
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No steps yet{isAdmin ? " — add the first one." : "."}</p>
      ) : (
        <>
          <SegmentedToggle
            className="mb-3"
            options={[
              { value: "list", label: "List" },
              { value: "graph", label: "Graph" },
            ]}
            value={view}
            onChange={setView}
          />

          {view === "list" ? (
            <div className="space-y-2">
              {steps.map((step) => (
                <StepCard
                  key={step.id}
                  step={step}
                  allSteps={steps}
                  readOnly={!isAdmin}
                  onEdit={() => setEditingStep(step)}
                  onStatusChange={(status) => handleStatusChange(step, status)}
                />
              ))}
            </div>
          ) : (
            <PlanHierarchyGraph nodes={treeNodes} frames={frames} onSelectNode={handleSelectNode} />
          )}
        </>
      )}

      {showEditPlan && (
        <PlanFormModal
          plan={plan}
          startFloor={planStartFloor}
          siblingStages={siblingStages}
          onClose={() => setShowEditPlan(false)}
          onSaved={afterPlanChange}
          onDeleted={afterPlanDeleted}
        />
      )}
      {showCreateStep && (
        <StepFormModal
          planId={plan.id}
          otherSteps={otherStepOptions}
          startFloor={stepStartFloor}
          onClose={() => setShowCreateStep(false)}
          onSaved={afterStepChange}
          onDeleted={afterStepChange}
        />
      )}
      {editingStep && (
        <StepFormModal
          planId={plan.id}
          otherSteps={otherStepOptions}
          startFloor={stepStartFloor}
          step={editingStep}
          onClose={() => setEditingStep(null)}
          onSaved={afterStepChange}
          onDeleted={afterStepChange}
        />
      )}
      {showAddToStrategy && (
        <AddToStrategyModal
          plan={plan}
          steps={steps}
          onClose={() => setShowAddToStrategy(false)}
          onDone={(newPlanId) => {
            setShowAddToStrategy(false);
            // Duplicate -> a new Stage row; move -> the same id, now a Stage
            // (refresh re-runs the server page, which then shows its
            // Strategy/Milestone breadcrumb and frames).
            router.push(`/plans/${newPlanId}`);
            router.refresh();
          }}
        />
      )}
      {showShare && <PlanShareModal planId={plan.id} onClose={() => setShowShare(false)} onSaved={() => setShowShare(false)} />}
      {showPromote && (
        <PromoteIdeaModal
          plan={plan}
          steps={steps}
          onClose={() => setShowPromote(false)}
          onPromoted={() => {
            setShowPromote(false);
            // Promotion flips this same plan's plan_type in place (same
            // id, no navigation) — refresh re-runs the server component,
            // which now branches to StrategyDetailClient if promoted to
            // Strategy.
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
