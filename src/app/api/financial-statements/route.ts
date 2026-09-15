import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { computeBalanceSummary, computeProfitAndLoss } from "@/lib/financialStatements";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const periodStart = req.nextUrl.searchParams.get("periodStart") ?? "";
  const periodEnd = req.nextUrl.searchParams.get("periodEnd") ?? "";
  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: "periodStart and periodEnd are required" }, { status: 400 });
  }

  const [profitAndLoss, balanceSummary] = await Promise.all([
    computeProfitAndLoss(periodStart, periodEnd),
    computeBalanceSummary(),
  ]);

  return NextResponse.json({ profitAndLoss, balanceSummary });
}
