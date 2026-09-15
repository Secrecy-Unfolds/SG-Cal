import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createGovernmentSupport, listGovernmentSupport } from "@/lib/governmentSupport";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const records = await listGovernmentSupport();
  return NextResponse.json({ records });
}

// Creating a support record auto-posts a matching capital_entries row — see
// createGovernmentSupport() in lib/governmentSupport.ts. `expectations` is
// optional — omitted/empty means no expectation of return, per the v2 plan.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add support records" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const supporterId = typeof body?.supporterId === "number" ? body.supporterId : NaN;
  const amount = typeof body?.amount === "number" ? body.amount : NaN;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";
  const date = typeof body?.date === "string" && body.date ? body.date : new Date().toISOString().slice(0, 10);
  const expectations = typeof body?.expectations === "string" && body.expectations.trim() ? body.expectations.trim() : null;

  if (!Number.isInteger(supporterId) || supporterId <= 0) {
    return NextResponse.json({ error: "A valid supporterId is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  }

  try {
    const record = await createGovernmentSupport({ supporterId, amount, currency, date, expectations, createdBy: session.uid });
    return NextResponse.json({ record }, { status: 201 });
  } catch (err: any) {
    if (err?.message === "Supporter not found") {
      return NextResponse.json({ error: "Supporter not found" }, { status: 404 });
    }
    throw err;
  }
}
