"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/hud/PageHeader";
import PlanFormModal from "@/components/plans/PlanFormModal";
import PlanProgressBar from "@/components/plans/PlanProgressBar";
import PlanShareModal from "@/components/plans/PlanShareModal";
import PromoteIdeaModal from "@/components/plans/PromoteIdeaModal";
import StepFormModal from "@/components/plans/StepFormModal";
import StepCard from "@/components/plans/StepCard";
import StepWorkflowGraph from "@/components/plans/StepWorkflowGraph";
import type { PlanRow } from "@/lib/plans";
import type { StepRow } from "@/lib/planSteps";
import type { PlanProgress } from "@/lib/planProgress";
import { PLAN_TYPE_LABELS, type StepStatus } from "@/lib/planDisplay";
import { formatDateOnly } from "@/lib/procurementDisplay";

export default function PlanDetailClient({
  plan,
  steps,
  progress,
  backLink,
  isAdmin,
}: {
  plan: PlanRow;
  steps: StepRow[];
  progress: PlanProgress;
  backLink?: { href: string; label: string } | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [showCreateStep, setShowCreateStep] = useState(false);
  const [editingStep, setEditingStep] = useState<StepRow | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
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
        <div className="text-xs text-black/50 dark:text-white/50">Start date: {formatDateOnly(plan.start_date)}</div>
        {plan.description && <div className="text-sm mt-2 whitespace-pre-wrap">{plan.description}</div>}
        <PlanProgressBar progress={progress.progress} total={progress.total} done={progress.done} className="mt-3" />
        {duplicateError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{duplicateError}</p>}
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No steps yet{isAdmin ? " — add the first one." : "."}</p>
      ) : (
        <>
          <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm w-fit mb-3">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`btn-skew px-3 py-1 font-medium transition-colors ${
                view === "list" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setView("graph")}
              className={`btn-skew px-3 py-1 font-medium transition-colors ${
                view === "graph" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
              }`}
            >
              Graph
            </button>
          </div>

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
            <StepWorkflowGraph steps={steps} readOnly={!isAdmin} onSelectStep={(step) => setEditingStep(step)} />
          )}
        </>
      )}

      {showEditPlan && (
        <PlanFormModal plan={plan} onClose={() => setShowEditPlan(false)} onSaved={afterPlanChange} onDeleted={afterPlanDeleted} />
      )}
      {showCreateStep && (
        <StepFormModal
          planId={plan.id}
          otherSteps={otherStepOptions}
          onClose={() => setShowCreateStep(false)}
          onSaved={afterStepChange}
          onDeleted={afterStepChange}
        />
      )}
      {editingStep && (
        <StepFormModal
          planId={plan.id}
          otherSteps={otherStepOptions}
          step={editingStep}
          onClose={() => setEditingStep(null)}
          onSaved={afterStepChange}
          onDeleted={afterStepChange}
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
