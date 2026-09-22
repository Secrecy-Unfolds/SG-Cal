import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deletePlan, getPlanById, updatePlan } from "@/lib/plans";
import { listStepsForPlan } from "@/lib/planSteps";
import { sendMailInBackground, getAdminLevelRecipientEmails } from "@/lib/mailer";
import { planDeletedEmail, planUpdatedEmail } from "@/lib/planEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Admin-level only for the whole module in Phase 1 (matches today's
// `ideas` routes exactly) — Phase 4 adds plan_shares-based viewing for
// non-Admin-level users.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const plan = await getPlanById(id);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const steps = await listStepsForPlan(id);
  return NextResponse.json({ plan, steps });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit plans" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const startDate = typeof body?.startDate === "string" && body.startDate ? body.startDate : null;
  // Only a Stage carries a prerequisite; absent/undefined leaves it alone.
  const prerequisiteStageId: number | null | undefined =
    typeof body?.prerequisiteStageId === "number"
      ? body.prerequisiteStageId
      : body?.prerequisiteStageId === null
      ? null
      : undefined;
  const projectId = typeof body?.projectId === "number" ? body.projectId : null;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const result = await updatePlan(id, { name, description, startDate, projectId, prerequisiteStageId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.notFound ? 404 : 400 });
  }
  const plan = result.plan;

  const recipients = await getAdminLevelRecipientEmails("ideas");
  const { subject, html } = planUpdatedEmail(plan, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ plan });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete plans" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getPlanById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deletePlan(id);

  const recipients = await getAdminLevelRecipientEmails("ideas");
  const { subject, html } = planDeletedEmail(existing, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ ok: true });
}
