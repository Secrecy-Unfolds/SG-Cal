import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteVendorDocument, getVendorDocument } from "@/lib/procurement";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function DELETE(_req: NextRequest, { params }: { params: { vendorId: string; docId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can delete vendor documents" }, { status: 403 });
  }

  const vendorId = parseId(params.vendorId);
  const docId = parseId(params.docId);
  if (!vendorId || !docId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const doc = await getVendorDocument(docId);
  if (!doc || doc.vendor_id !== vendorId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteVendorDocument(docId);
  return NextResponse.json({ ok: true });
}
