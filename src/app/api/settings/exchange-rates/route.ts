import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listExchangeRates, upsertExchangeRate } from "@/lib/exchangeRates";

export const runtime = "nodejs";

// Genuinely Super-Admin-only — matches the rest of /api/settings.
function requireSuperAdmin(role: string): string | null {
  if (role !== "super_admin") return "Only the Super Admin can do this";
  return null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissionError = requireSuperAdmin(session.role);
  if (permissionError) return NextResponse.json({ error: permissionError }, { status: 403 });

  const rates = await listExchangeRates();
  return NextResponse.json({ rates });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissionError = requireSuperAdmin(session.role);
  if (permissionError) return NextResponse.json({ error: permissionError }, { status: 403 });

  const body = await req.json().catch(() => null);
  const currency = typeof body?.currency === "string" ? body.currency.trim() : "";
  const rateToBase = Number(body?.rateToBase);

  if (!currency) {
    return NextResponse.json({ error: "Currency is required" }, { status: 400 });
  }
  if (!Number.isFinite(rateToBase) || rateToBase <= 0) {
    return NextResponse.json({ error: "Rate must be a positive number" }, { status: 400 });
  }

  const rate = await upsertExchangeRate(currency, rateToBase);
  return NextResponse.json({ rate });
}
