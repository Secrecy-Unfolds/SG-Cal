import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createInvestment, listInvestments } from "@/lib/investors";
import { isInvestmentType } from "@/lib/investorsDisplay";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const investments = await listInvestments();
  return NextResponse.json({ investments });
}

// Creating an investment auto-posts a matching capital_entries row — see
// createInvestment() in lib/investors.ts.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add investments" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const investorId = typeof body?.investorId === "number" ? body.investorId : NaN;
  const investmentType = isInvestmentType(body?.investmentType) ? body.investmentType : null;
  const amount = typeof body?.amount === "number" ? body.amount : NaN;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";
  const date = typeof body?.date === "string" && body.date ? body.date : new Date().toISOString().slice(0, 10);
  const terms = typeof body?.terms === "string" ? body.terms.trim() : "";

  if (!Number.isInteger(investorId) || investorId <= 0) {
    return NextResponse.json({ error: "A valid investorId is required" }, { status: 400 });
  }
  if (!investmentType) return NextResponse.json({ error: "investmentType must be 'equity' or 'loan'" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  }

  try {
    const investment = await createInvestment({ investorId, investmentType, amount, currency, date, terms, createdBy: session.uid });
    return NextResponse.json({ investment }, { status: 201 });
  } catch (err: any) {
    if (err?.message === "Investor not found") {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }
    throw err;
  }
}
