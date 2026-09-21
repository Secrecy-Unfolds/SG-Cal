import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getPlanById } from "@/lib/plans";
import { createStep, listStepsForPlan } from "@/lib/planSteps";
import { isEventType } from "@/lib/events";
import { isDeliverableKind, type DeliverableKind } from "@/lib/planDeliverables";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add steps" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const planId = typeof body?.planId === "number" ? body.planId : null;
  const stepType = isEventType(body?.stepType) ? body.stepType : null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const startAtStr = typeof body?.startAt === "string" ? body.startAt : "";
  const endAtStr = typeof body?.endAt === "string" ? body.endAt : "";
  const assigneeId = typeof body?.assigneeId === "number" ? body.assigneeId : null;
  const attendeeIds: number[] = Array.isArray(body?.attendeeIds)
    ? body.attendeeIds.filter((id: unknown): id is number => typeof id === "number")
    : [];
  const requiresDeliverable = body?.requiresDeliverable === true;
  const prerequisiteStepIds: number[] = Array.isArray(body?.prerequisiteStepIds)
    ? body.prerequisiteStepIds.filter((id: unknown): id is number => typeof id === "number")
    : [];
  const deliverableDefs: { kind: DeliverableKind; label: string }[] = Array.isArray(body?.deliverableDefs)
    ? body.deliverableDefs
        .filter((d: unknown): d is { kind: unknown; label: unknown } => !!d && typeof d === "object")
        .map((d: { kind: unknown; label: unknown }) => ({
          kind: d.kind,
          label: typeof d.label === "string" ? d.label.trim() : "",
        }))
        .filter((d: { kind: unknown; label: string }): d is { kind: DeliverableKind; label: string } =>
          isDeliverableKind(d.kind) && d.label.length > 0
        )
    : [];

  if (!planId || !stepType || !title || !startAtStr) {
    return NextResponse.json({ error: "planId, stepType, title, and startAt are required" }, { status: 400 });
  }

  const plan = await getPlanById(planId);
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const startAt = new Date(startAtStr);
  const endAt = endAtStr ? new Date(endAtStr) : null;
  if (isNaN(startAt.getTime()) || (endAt && isNaN(endAt.getTime()))) {
    return NextResponse.json({ error: "Invalid start/end date" }, { status: 400 });
  }

  const existingSteps = await listStepsForPlan(planId);
  const sortOrder = existingSteps.length;

  const result = await createStep({
    planId,
    stepType,
    title,
    notes,
    startAt,
    endAt,
    assigneeId,
    attendeeIds,
    requiresDeliverable,
    deliverableDefs,
    prerequisiteStepIds,
    sortOrder,
    createdBy: session.uid,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ step: result.step }, { status: 201 });
}
