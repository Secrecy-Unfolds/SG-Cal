import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteVendor, getVendorById, updateVendorIdentity } from "@/lib/procurement";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, { params }: { params: { vendorId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can edit vendors" }, { status: 403 });
  }

  const id = parseId(params.vendorId);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getVendorById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const country = typeof body?.country === "string" ? body.country.trim() : "";
  const niche = typeof body?.niche === "string" ? body.niche.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
  }

  const vendor = await updateVendorIdentity(id, { name, country, niche });
  return NextResponse.json({ vendor });
}

export async function DELETE(_req: NextRequest, { params }: { params: { vendorId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can delete vendors" }, { status: 403 });
  }

  const id = parseId(params.vendorId);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getVendorById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteVendor(id);
  return NextResponse.json({ ok: true });
}
