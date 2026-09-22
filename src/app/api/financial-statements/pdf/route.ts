import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { computeBalanceSummary, computeProfitAndLoss } from "@/lib/financialStatements";
import { renderStatementPdf } from "@/lib/pdf/statementPdf";

export const runtime = "nodejs";

// Covers both "Financial statement PDFs" and "Period + status reports as
// PDFs" from the roadmap — one document type generated for whatever
// period range the caller picks (weekly, monthly, quarterly, annual are
// all just date ranges).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "accounting"))) {
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

  const buffer = await renderStatementPdf(periodStart, periodEnd, profitAndLoss, balanceSummary);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="statement-${periodStart}-to-${periodEnd}.pdf"`,
    },
  });
}
