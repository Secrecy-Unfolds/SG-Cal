import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { getPurchaseOrderById } from "@/lib/purchaseOrders";
import { getVendorById } from "@/lib/procurement";
import { renderPurchaseOrderPdf } from "@/lib/pdf/purchaseOrderPdf";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "procurement"))) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const po = await getPurchaseOrderById(id);
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const vendor = po.vendor_id ? await getVendorById(po.vendor_id) : null;
  const buffer = await renderPurchaseOrderPdf(po, vendor);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="PO-${po.id}.pdf"`,
    },
  });
}
