import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { createFinancialAccount, listFinancialAccounts } from "@/lib/financialAccounts";
import { isFinancialAccountType } from "@/lib/accountingDisplay";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "accounting"))) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const accounts = await listFinancialAccounts();
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add accounts" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const accountType = isFinancialAccountType(body?.accountType) ? body.accountType : "bank";
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const account = await createFinancialAccount({ name, accountType, currency, createdBy: session.uid });
  return NextResponse.json({ account }, { status: 201 });
}
