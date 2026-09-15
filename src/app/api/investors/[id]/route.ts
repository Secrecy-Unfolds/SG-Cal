import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteInvestor, updateInvestor } from "@/lib/investors";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit investors" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const contact = typeof body?.contact === "string" ? body.contact.trim() : "";
  const entityType = typeof body?.entityType === "string" ? body.entityType.trim() : "";

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const investor = await updateInvestor(id, { name, contact, entityType });
  if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 });
  return NextResponse.json({ investor });
}

// Deleting an investor cascades to their investments and payouts (schema
// FKs), but the capital_entries those investments posted are kept — see
// lib/investors.ts's deleteInvestor().
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete investors" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await deleteInvestor(id);
  return NextResponse.json({ ok: true });
}
