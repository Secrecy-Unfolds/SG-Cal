import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { checkCloseEligibility, closePurchaseOrder, forceClosePurchaseOrder, getPurchaseOrderById } from "@/lib/purchaseOrders";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Normal close (GRN + invoice + full payment all present) or an explicit
// force-close with a reason — confirmed: force-close is for write-offs /
// disputed or abandoned orders that will never fully reconcile, so it
// always requires a reason, not just a flag.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can close a purchase order" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getPurchaseOrderById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const force = body?.force === true;

  if (force) {
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!reason) return NextResponse.json({ error: "A reason is required to force-close" }, { status: 400 });
    const order = await forceClosePurchaseOrder(id, reason);
    return NextResponse.json({ order });
  }

  const eligibility = await checkCloseEligibility(id);
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason }, { status: 400 });
  }
  const order = await closePurchaseOrder(id);
  return NextResponse.json({ order });
}
