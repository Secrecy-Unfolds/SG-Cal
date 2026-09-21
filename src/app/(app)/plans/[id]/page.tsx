import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getPlanById } from "@/lib/plans";
import { listStepsForPlan } from "@/lib/planSteps";
import { getMilestoneById, listMilestonesForStrategy, listStagesForMilestone } from "@/lib/planMilestones";
import { getMilestoneProgressForMilestones, getPlanProgress } from "@/lib/planProgress";
import { canUserViewPlan } from "@/lib/planShares";
import { getFloorForMilestone, getFloorForPlanStart, getFloorForSteps } from "@/lib/planStartRules";
import { buildStrategyGraph } from "@/lib/planGraphData";
import type { GraphFrame } from "@/lib/planGraph";
import PlanDetailClient from "@/components/plans/PlanDetailClient";
import StrategyDetailClient from "@/components/plans/StrategyDetailClient";

export default async function PlanDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const plan = await getPlanById(id);
  if (!plan) notFound();

  // Admin-level sees every plan; a plain user needs a plan_shares row for
  // this plan's root Strategy/Process/Idea (see lib/planShares.ts).
  if (!(await canUserViewPlan(id, session.uid, session.role))) redirect("/plans");
  const isAdmin = isAdminLevel(session.role);

  if (plan.plan_type === "strategy") {
    const milestones = await listMilestonesForStrategy(id);
    const [progressByMilestone, graphMilestones, milestoneStartFloor] = await Promise.all([
      getMilestoneProgressForMilestones(milestones.map((m) => m.id)),
      buildStrategyGraph(milestones),
      getFloorForMilestone(id),
    ]);
    return (
      <StrategyDetailClient
        plan={plan}
        milestones={milestones}
        progressByMilestone={progressByMilestone}
        graphMilestones={graphMilestones}
        milestoneStartFloor={milestoneStartFloor}
        isAdmin={isAdmin}
      />
    );
  }

  const [steps, progress, parentMilestone, stepStartFloor, planStartFloor] = await Promise.all([
    listStepsForPlan(id),
    getPlanProgress(id),
    plan.parent_milestone_id ? getMilestoneById(plan.parent_milestone_id) : Promise.resolve(null),
    getFloorForSteps(id),
    getFloorForPlanStart(id),
  ]);
  const backLink = parentMilestone
    ? { href: `/plans/${parentMilestone.strategy_plan_id}/milestones/${parentMilestone.id}`, label: parentMilestone.name }
    : null;

  // A Stage sits inside a Milestone inside a Strategy — its graph is drawn
  // wrapped in those, so the higher structure stays visible around it.
  let frames: GraphFrame[] = [];
  let siblingStages: { id: number; name: string }[] = [];
  if (parentMilestone) {
    const [strategy, stages] = await Promise.all([
      getPlanById(parentMilestone.strategy_plan_id),
      listStagesForMilestone(parentMilestone.id),
    ]);
    frames = [
      { kindLabel: "Strategy", name: strategy?.name ?? "" },
      { kindLabel: "Milestone", name: parentMilestone.name },
      { kindLabel: "Stage", name: plan.name },
    ];
    siblingStages = stages.filter((s) => s.id !== id).map((s) => ({ id: s.id, name: s.name }));
  }

  return (
    <PlanDetailClient
      plan={plan}
      steps={steps}
      progress={progress}
      backLink={backLink}
      stepStartFloor={stepStartFloor}
      planStartFloor={planStartFloor}
      siblingStages={siblingStages}
      frames={frames}
      isAdmin={isAdmin}
    />
  );
}
