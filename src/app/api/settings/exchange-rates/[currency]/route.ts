import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteExchangeRate } from "@/lib/exchangeRates";

export const runtime = "nodejs";

function requireSuperAdmin(role: string): string | null {
  if (role !== "super_admin") return "Only the Super Admin can do this";
  return null;
}

export async function DELETE(_req: NextRequest, { params }: { params: { currency: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissionError = requireSuperAdmin(session.role);
  if (permissionError) return NextResponse.json({ error: permissionError }, { status: 403 });

  await deleteExchangeRate(decodeURIComponent(params.currency));
  return NextResponse.json({ ok: true });
}
