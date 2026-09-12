import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createInventoryItem, isAssetType, listInventoryItems } from "@/lib/inventory";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const items = await listInventoryItems();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add items" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const assetType = isAssetType(body?.assetType) ? body.assetType : "consumable";
  const quantity = typeof body?.quantity === "number" ? body.quantity : 1;
  const quantityUnit = typeof body?.quantityUnit === "string" && body.quantityUnit.trim() ? body.quantityUnit.trim() : "pcs";
  const purchaseCost = typeof body?.purchaseCost === "number" ? body.purchaseCost : null;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";
  const purchaseDate = typeof body?.purchaseDate === "string" && body.purchaseDate ? body.purchaseDate : null;
  const currentValue = typeof body?.currentValue === "number" ? body.currentValue : null;
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const item = await createInventoryItem({
    name,
    assetType,
    quantity,
    quantityUnit,
    purchaseCost,
    currency,
    purchaseDate,
    currentValue,
    location,
    notes,
  });

  return NextResponse.json({ item }, { status: 201 });
}
