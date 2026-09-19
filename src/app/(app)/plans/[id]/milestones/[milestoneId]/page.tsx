import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getPlanById } from "@/lib/plans";
import { getMilestoneById, listMilestonesForStrategy, listStagesForMilestone } from "@/lib/planMilestones";
import { getPlanProgressForPlans } from "@/lib/planProgress";
import { canUserViewPlan } from "@/lib/planShares";
import MilestoneDetailClient from "@/components/plans/MilestoneDetailClient";

export default async function MilestoneDetailPage({
  params,
}: {
  params: { id: string; milestoneId: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const strategyId = Number(params.id);
  const milestoneId = Number(params.milestoneId);
  if (!Number.isInteger(strategyId) || strategyId <= 0 || !Number.isInteger(milestoneId) || milestoneId <= 0) {
    notFound();
  }

  const [plan, milestone] = await Promise.all([getPlanById(strategyId), getMilestoneById(milestoneId)]);
  if (!plan || plan.plan_type !== "strategy" || !milestone || milestone.strategy_plan_id !== strategyId) {
    notFound();
  }

  if (!(await canUserViewPlan(strategyId, session.uid, session.role))) redirect("/plans");
  const isAdmin = isAdminLevel(session.role);

  const [stages, siblingMilestones] = await Promise.all([
    listStagesForMilestone(milestoneId),
    listMilestonesForStrategy(strategyId),
  ]);
  const progressByStage = await getPlanProgressForPlans(stages.map((s) => s.id));

  return (
    <MilestoneDetailClient
      strategyPlan={plan}
      milestone={milestone}
      siblingMilestones={siblingMilestones}
      stages={stages}
      progressByStage={progressByStage}
      isAdmin={isAdmin}
    />
  );
}
