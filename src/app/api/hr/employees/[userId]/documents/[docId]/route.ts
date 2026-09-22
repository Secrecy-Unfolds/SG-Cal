import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteEmployeeDocument, getEmployeeDocument } from "@/lib/hr";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function DELETE(_req: NextRequest, { params }: { params: { userId: string; docId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete employee documents" }, { status: 403 });
  }

  const userId = parseId(params.userId);
  const docId = parseId(params.docId);
  if (!userId || !docId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const doc = await getEmployeeDocument(docId);
  if (!doc || doc.user_id !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteEmployeeDocument(docId);
  return NextResponse.json({ ok: true });
}
