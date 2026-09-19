import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteDeliverableDef, getDeliverableDefKind, getDeliverableDefStepId, setDeliverableTextValue } from "@/lib/planDeliverables";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Admin-level-only for now, same simplification as the step status route
// (src/app/api/plans/steps/[id]/status/route.ts) — filling in a
// deliverable's actual answer will likely belong to a step's assignee
// once Phase 4's plan_shares lands; until then this stays consistent with
// every other plans/steps write path.
export async function PUT(req: NextRequest, { params }: { params: { id: string; defId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can fill a deliverable" }, { status: 403 });
  }

  const stepId = parseId(params.id);
  const defId = parseId(params.defId);
  if (!stepId || !defId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [defStepId, kind] = await Promise.all([getDeliverableDefStepId(defId), getDeliverableDefKind(defId)]);
  if (defStepId === null || defStepId !== stepId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (kind !== "text") {
    return NextResponse.json({ error: "Only a text deliverable can be filled this way — use the upload route for image/pdf" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const textValue = typeof body?.textValue === "string" ? body.textValue : "";

  await setDeliverableTextValue(defId, textValue, session.uid);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; defId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can remove a deliverable" }, { status: 403 });
  }

  const stepId = parseId(params.id);
  const defId = parseId(params.defId);
  if (!stepId || !defId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const defStepId = await getDeliverableDefStepId(defId);
  if (defStepId === null || defStepId !== stepId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteDeliverableDef(defId);
  return NextResponse.json({ ok: true });
}
