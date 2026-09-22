import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { createInvestor, listInvestors } from "@/lib/investors";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "accounting"))) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const investors = await listInvestors();
  return NextResponse.json({ investors });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add investors" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const contact = typeof body?.contact === "string" ? body.contact.trim() : "";
  const entityType = typeof body?.entityType === "string" ? body.entityType.trim() : "";

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const investor = await createInvestor({ name, contact, entityType });
  return NextResponse.json({ investor }, { status: 201 });
}
