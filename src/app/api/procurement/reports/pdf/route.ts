import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { computeProcurementReport } from "@/lib/procurementReports";
import { renderProcurementReportPdf } from "@/lib/pdf/procurementReportPdf";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const periodStart = req.nextUrl.searchParams.get("periodStart");
  const periodEnd = req.nextUrl.searchParams.get("periodEnd");
  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: "periodStart and periodEnd are required" }, { status: 400 });
  }

  const report = await computeProcurementReport(periodStart, periodEnd);
  const buffer = await renderProcurementReportPdf(report);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="procurement-report-${periodStart}-to-${periodEnd}.pdf"`,
    },
  });
}
