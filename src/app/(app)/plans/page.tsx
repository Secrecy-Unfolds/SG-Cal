import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listPlans } from "@/lib/plans";
import { getPlanProgressForPlans, getStrategyProgressForPlans } from "@/lib/planProgress";
import { listSharedPlanIdsForUser } from "@/lib/planShares";
import { isPlanType } from "@/lib/planDisplay";
import PlansListClient from "@/components/plans/PlansListClient";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const isAdmin = isAdminLevel(session.role);
  const allPlans = await listPlans();
  // Admin-level sees every plan; a plain user only sees ones shared with
  // them (see lib/planShares.ts) — same "Admin bypasses, else needs a
  // plan_shares row" rule the detail pages enforce.
  const sharedIds = isAdmin ? null : new Set(await listSharedPlanIdsForUser(session.uid));
  const plans = isAdmin ? allPlans : allPlans.filter((p) => sharedIds!.has(p.id));

  // A Strategy has no steps directly under it (they live under its
  // Milestones' Stages) — its progress is the Milestone rollup, not the
  // step-based computation every other plan type uses.
  const strategyIds = plans.filter((p) => p.plan_type === "strategy").map((p) => p.id);
  const otherIds = plans.filter((p) => p.plan_type !== "strategy").map((p) => p.id);
  const [stepProgress, strategyProgress] = await Promise.all([
    getPlanProgressForPlans(otherIds),
    getStrategyProgressForPlans(strategyIds),
  ]);
  const progressByPlan = { ...stepProgress, ...strategyProgress };
  const initialType = isPlanType(searchParams.type) ? searchParams.type : "process";

  return (
    <PlansListClient plans={plans} progressByPlan={progressByPlan} initialType={initialType} isAdmin={isAdmin} />
  );
}
