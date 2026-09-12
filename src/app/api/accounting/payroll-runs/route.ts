import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listPayrollRuns, runPayroll } from "@/lib/accounting";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const runs = await listPayrollRuns();
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can run payroll" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const runMonth = typeof body?.runMonth === "string" ? body.runMonth : "";
  if (!runMonth) {
    return NextResponse.json({ error: "runMonth is required" }, { status: 400 });
  }

  const result = await runPayroll(runMonth, session.uid);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ run: result.run, transactionsCreated: result.transactionsCreated }, { status: 201 });
}
