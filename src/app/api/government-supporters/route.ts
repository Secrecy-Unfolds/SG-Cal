import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { createGovernmentSupporter, listGovernmentSupporters } from "@/lib/governmentSupport";
import { isSupporterType } from "@/lib/governmentSupportDisplay";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "accounting"))) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const supporters = await listGovernmentSupporters();
  return NextResponse.json({ supporters });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add supporters" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const supporterType = isSupporterType(body?.supporterType) ? body.supporterType : "other";
  const contact = typeof body?.contact === "string" ? body.contact.trim() : "";

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const supporter = await createGovernmentSupporter({ name, supporterType, contact });
  return NextResponse.json({ supporter }, { status: 201 });
}
