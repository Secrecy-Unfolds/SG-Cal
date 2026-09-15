import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteInvestment, getInvestmentById, updateInvestmentStatus } from "@/lib/investors";
import { isValidStatusForType } from "@/lib/investorsDisplay";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Status-only edit — the status lifecycle is split by investment_type (see
// lib/investorsDisplay.ts), so the valid set depends on the existing row's
// type rather than anything the client sends.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit investments" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getInvestmentById(id);
  if (!existing) return NextResponse.json({ error: "Investment not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!isValidStatusForType(existing.investment_type, body?.status)) {
    return NextResponse.json({ error: "Invalid status for this investment's type" }, { status: 400 });
  }

  const investment = await updateInvestmentStatus(id, body.status);
  return NextResponse.json({ investment });
}

// Deletes the investment row only — the capital_entries row it posted is
// kept (same convention as deleting an investor), and any payouts cascade
// via the schema's FK.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete investments" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await deleteInvestment(id);
  return NextResponse.json({ ok: true });
}
