import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getPlanById } from "@/lib/plans";
import { listStepsForPlan } from "@/lib/planSteps";
import { getMilestoneById, listMilestonesForStrategy } from "@/lib/planMilestones";
import { getMilestoneProgressForMilestones, getPlanProgress } from "@/lib/planProgress";
import { canUserViewPlan } from "@/lib/planShares";
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
    const progressByMilestone = await getMilestoneProgressForMilestones(milestones.map((m) => m.id));
    return (
      <StrategyDetailClient plan={plan} milestones={milestones} progressByMilestone={progressByMilestone} isAdmin={isAdmin} />
    );
  }

  const [steps, progress, parentMilestone] = await Promise.all([
    listStepsForPlan(id),
    getPlanProgress(id),
    plan.parent_milestone_id ? getMilestoneById(plan.parent_milestone_id) : Promise.resolve(null),
  ]);
  const backLink = parentMilestone
    ? { href: `/plans/${parentMilestone.strategy_plan_id}/milestones/${parentMilestone.id}`, label: parentMilestone.name }
    : null;

  return <PlanDetailClient plan={plan} steps={steps} progress={progress} backLink={backLink} isAdmin={isAdmin} />;
}
