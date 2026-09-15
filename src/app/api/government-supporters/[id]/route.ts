import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteGovernmentSupporter, updateGovernmentSupporter } from "@/lib/governmentSupport";
import { isSupporterType } from "@/lib/governmentSupportDisplay";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit supporters" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const supporterType = isSupporterType(body?.supporterType) ? body.supporterType : "other";
  const contact = typeof body?.contact === "string" ? body.contact.trim() : "";

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const supporter = await updateGovernmentSupporter(id, { name, supporterType, contact });
  if (!supporter) return NextResponse.json({ error: "Supporter not found" }, { status: 404 });
  return NextResponse.json({ supporter });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete supporters" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await deleteGovernmentSupporter(id);
  return NextResponse.json({ ok: true });
}
