import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { addCurrency, listCurrencies } from "@/lib/currencies";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currencies = await listCurrencies();
  return NextResponse.json({ currencies });
}

// Adds a new currency code to the shared list — reachable from any
// currency dropdown's "Other" option app-wide. Gated the same as the
// Admin-level pages those dropdowns live on, not tied to any one module.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add a currency" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: "Currency code is required" }, { status: 400 });
  if (!/^[A-Za-z]{2,8}$/.test(code)) {
    return NextResponse.json({ error: "Currency code must be 2-8 letters" }, { status: 400 });
  }

  const currencies = await addCurrency(code);
  return NextResponse.json({ currencies }, { status: 201 });
}
