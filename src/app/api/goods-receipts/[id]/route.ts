import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteGoodsReceipt, getGoodsReceiptById } from "@/lib/goodsReceipts";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Doesn't delete the linked Inventory item — see goodsReceipts.ts's
// deleteGoodsReceipt() comment.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getGoodsReceiptById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteGoodsReceipt(id);
  return NextResponse.json({ ok: true });
}
