import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEmailsByIds, isAdminLevel } from "@/lib/users";
import { decideTransaction, deleteTransaction, getTransactionById } from "@/lib/accounting";
import { sendMailInBackground } from "@/lib/mailer";
import { expenseDecidedEmail } from "@/lib/accountingEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Super-Admin-only — approve or reject a pending expense.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "Only a Super Admin can decide this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getTransactionById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Only a pending expense can be decided" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "status must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const transaction = await decideTransaction(id, { status, decidedBy: session.uid });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (transaction.created_by) {
    const recipients = await getEmailsByIds([transaction.created_by]);
    const { subject, html } = expenseDecidedEmail(transaction, session.username);
    sendMailInBackground({ to: recipients, subject, html });
  }

  return NextResponse.json({ transaction });
}

// Admin-level can delete any transaction, including auto-posted ones from a
// received Purchase Order or a payroll run — same trust model as the rest
// of the app (Admin-level can already do everything in Procurement).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete transactions" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    await deleteTransaction(id);
  } catch (err: any) {
    if (err?.message === "PERIOD_CLOSED") {
      return NextResponse.json({ error: "This transaction is in a closed accounting period" }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
