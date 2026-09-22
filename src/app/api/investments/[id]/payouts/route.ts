import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { createPayout, getInvestmentById, listPayoutsForInvestment } from "@/lib/investors";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "accounting"))) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const payouts = await listPayoutsForInvestment(id);
  return NextResponse.json({ payouts });
}

// Payouts are recorded against a loan investment's repayments, or an
// equity investment's distributions — they don't themselves post to
// capital_entries (money leaving isn't "capital raised"), so this is a
// simple record, not an auto-posting flow like createInvestment().
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add payouts" }, { status: 403 });
  }

  const investmentId = parseId(params.id);
  if (!investmentId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const investment = await getInvestmentById(investmentId);
  if (!investment) return NextResponse.json({ error: "Investment not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const amount = typeof body?.amount === "number" ? body.amount : NaN;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : investment.currency;
  const date = typeof body?.date === "string" && body.date ? body.date : new Date().toISOString().slice(0, 10);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  }

  const payout = await createPayout({ investmentId, amount, currency, date, createdBy: session.uid });
  return NextResponse.json({ payout }, { status: 201 });
}
