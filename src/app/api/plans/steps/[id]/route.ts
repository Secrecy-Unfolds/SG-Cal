import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteStep, getStepById, setStepPrerequisites, updateStep } from "@/lib/planSteps";
import { isDeliverableKind, type DeliverableKind } from "@/lib/planDeliverables";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit steps" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getStepById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const startAtStr = typeof body?.startAt === "string" ? body.startAt : "";
  const endAtStr = typeof body?.endAt === "string" ? body.endAt : "";
  const assigneeId = typeof body?.assigneeId === "number" ? body.assigneeId : null;
  const requiresDeliverable = body?.requiresDeliverable === true;
  const prerequisiteStepIds: number[] | undefined = Array.isArray(body?.prerequisiteStepIds)
    ? body.prerequisiteStepIds.filter((pid: unknown): pid is number => typeof pid === "number")
    : undefined;
  const newDeliverableDefs: { kind: DeliverableKind; label: string }[] = Array.isArray(body?.newDeliverableDefs)
    ? body.newDeliverableDefs
        .filter((d: unknown): d is { kind: unknown; label: unknown } => !!d && typeof d === "object")
        .map((d: { kind: unknown; label: unknown }) => ({
          kind: d.kind,
          label: typeof d.label === "string" ? d.label.trim() : "",
        }))
        .filter((d: { kind: unknown; label: string }): d is { kind: DeliverableKind; label: string } =>
          isDeliverableKind(d.kind) && d.label.length > 0
        )
    : [];

  if (!title || !startAtStr) {
    return NextResponse.json({ error: "title and startAt are required" }, { status: 400 });
  }

  const startAt = new Date(startAtStr);
  const endAt = endAtStr ? new Date(endAtStr) : null;
  if (isNaN(startAt.getTime()) || (endAt && isNaN(endAt.getTime()))) {
    return NextResponse.json({ error: "Invalid start/end date" }, { status: 400 });
  }

  const result = await updateStep(id, { title, notes, startAt, endAt, assigneeId, requiresDeliverable, newDeliverableDefs });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  if (prerequisiteStepIds !== undefined) {
    const prereqResult = await setStepPrerequisites(id, existing.plan_id, prerequisiteStepIds);
    if (!prereqResult.ok) return NextResponse.json({ error: prereqResult.error }, { status: 400 });
  }

  const step = await getStepById(id);
  return NextResponse.json({ step });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete steps" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getStepById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteStep(id);
  return NextResponse.json({ ok: true });
}
