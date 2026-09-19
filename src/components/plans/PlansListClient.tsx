"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PlanFormModal from "@/components/plans/PlanFormModal";
import PlanProgressBar from "@/components/plans/PlanProgressBar";
import type { PlanRow } from "@/lib/plans";
import type { PlanProgress } from "@/lib/planProgress";
import { PLAN_TYPES, PLAN_TYPE_LABELS, type PlanType } from "@/lib/planDisplay";
import { formatDateOnly } from "@/lib/procurementDisplay";
import PageHeader from "@/components/hud/PageHeader";
import { HudFrameButton } from "@/components/hud/HudFrame";
import { PaginationControls, usePagination } from "@/components/Pagination";

export default function PlansListClient({
  plans,
  progressByPlan,
  initialType,
  isAdmin,
}: {
  plans: PlanRow[];
  progressByPlan: Record<number, PlanProgress>;
  initialType: PlanType;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [activeType, setActiveType] = useState<PlanType>(initialType);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => plans.filter((p) => p.plan_type === activeType), [plans, activeType]);
  const { pageItems, page, setPage, totalPages } = usePagination(filtered, undefined, activeType);

  function afterChange() {
    setShowCreate(false);
    router.refresh();
  }

  return (
    <div>
      <PageHeader label="PLANS & STRATEGY" title="Plans & Strategy">
        {isAdmin && (
          <span className="btn-glow inline-block">
            <button
              onClick={() => setShowCreate(true)}
              className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium"
            >
              + New {PLAN_TYPE_LABELS[activeType]}
            </button>
          </span>
        )}
      </PageHeader>

      <div className="flex gap-2 mb-4 border-b border-black/5 dark:border-white/10">
        {PLAN_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeType === t
                ? "border-accent text-accent dark:text-blue-300"
                : "border-transparent text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80"
            }`}
          >
            {PLAN_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          {isAdmin
            ? `No ${PLAN_TYPE_LABELS[activeType].toLowerCase()}s yet — add the first one.`
            : `No ${PLAN_TYPE_LABELS[activeType].toLowerCase()}s have been shared with you yet.`}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageItems.map((plan) => {
            const progress = progressByPlan[plan.id] ?? { total: 0, done: 0, progress: 0 };
            return (
              <HudFrameButton
                key={plan.id}
                corners="tl-br"
                onClick={() => router.push(`/plans/${plan.id}`)}
                className="text-left bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4 hover:border-accent/40 card-glow"
              >
                <div className="text-sm font-medium truncate">{plan.name}</div>
                <div className="text-xs text-black/50 dark:text-white/50 mt-1">
                  Start date: {formatDateOnly(plan.start_date)}
                </div>
                {plan.description && (
                  <div className="text-xs text-black/50 dark:text-white/50 mt-2 line-clamp-2">{plan.description}</div>
                )}
                <PlanProgressBar
                  progress={progress.progress}
                  total={progress.total}
                  done={progress.done}
                  unit={plan.plan_type === "strategy" ? "milestones" : "steps"}
                  className="mt-3"
                />
                {plan.created_by_username && (
                  <div className="text-xs text-black/40 dark:text-white/40 mt-2">Added by {plan.created_by_username}</div>
                )}
              </HudFrameButton>
            );
          })}
        </div>
      )}
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />

      {showCreate && (
        <PlanFormModal defaultPlanType={activeType} onClose={() => setShowCreate(false)} onSaved={afterChange} onDeleted={afterChange} />
      )}
    </div>
  );
}
