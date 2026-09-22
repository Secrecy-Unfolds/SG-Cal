import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEmailsByIds, isAdminLevel } from "@/lib/users";
import { listPayrollRuns, runPayroll } from "@/lib/accounting";
import { getAdminLevelRecipientEmails, sendMailInBackground } from "@/lib/mailer";
import { payrollRunEmail } from "@/lib/accountingEmailTemplates";
import { getDepartmentIdsForUsers, getDepartmentLeadershipEmails } from "@/lib/orgNotify";
import { canAccessModule } from "@/lib/orgModules";

export const runtime = "nodejs";

// Organization structure Phase 4: a department-module "accounting" viewer
// can see the run list too (no per-employee salary in this row shape) — but
// running payroll (POST, below) stays Admin-level-only, untouched.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "accounting"))) {
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

  // Org structure Phase 6 (confirmed 2026-09-22): the poster, Admin-level
  // "accounting" subscribers, and the Manager + Director of every department
  // among the employees actually paid this run (a run can span several).
  const departmentIds = await getDepartmentIdsForUsers(result.paidUserIds);
  const recipients = Array.from(
    new Set([
      ...(await getAdminLevelRecipientEmails("accounting")),
      ...(await getEmailsByIds([session.uid])),
      ...(await getDepartmentLeadershipEmails(departmentIds)),
    ])
  );
  const { subject, html } = payrollRunEmail(result.run, result.transactionsCreated, result.totalsByCurrency, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ run: result.run, transactionsCreated: result.transactionsCreated }, { status: 201 });
}
