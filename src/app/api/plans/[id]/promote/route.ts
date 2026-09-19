import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { promoteIdeaToProcess, promoteIdeaToStrategy } from "@/lib/plans";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can promote a plan" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const targetType = body?.targetType;

  if (targetType === "process") {
    const result = await promoteIdeaToProcess(id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (targetType === "strategy") {
    const milestones = Array.isArray(body?.milestones)
      ? body.milestones.map((m: { name?: unknown; description?: unknown; stages?: unknown }) => ({
          name: typeof m?.name === "string" ? m.name.trim() : "",
          description: typeof m?.description === "string" ? m.description.trim() : "",
          stages: Array.isArray(m?.stages)
            ? m.stages.map((s: { name?: unknown; description?: unknown }) => ({
                name: typeof s?.name === "string" ? s.name.trim() : "",
                description: typeof s?.description === "string" ? s.description.trim() : "",
              }))
            : [],
        }))
      : [];
    const stepAssignments: Record<number, { milestoneIndex: number; stageIndex: number }> = {};
    if (body?.stepAssignments && typeof body.stepAssignments === "object") {
      for (const [stepId, value] of Object.entries(body.stepAssignments as Record<string, unknown>)) {
        const v = value as { milestoneIndex?: unknown; stageIndex?: unknown };
        if (typeof v?.milestoneIndex === "number" && typeof v?.stageIndex === "number") {
          stepAssignments[Number(stepId)] = { milestoneIndex: v.milestoneIndex, stageIndex: v.stageIndex };
        }
      }
    }

    const result = await promoteIdeaToStrategy(id, { milestones, stepAssignments }, session.uid);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "targetType must be 'process' or 'strategy'" }, { status: 400 });
}
