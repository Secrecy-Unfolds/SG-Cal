import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canEditUserDetails, getUserById, isAdminLevel, updateProfile, usernameExists } from "@/lib/users";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit another user's details" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  if (id === session.uid) {
    return NextResponse.json({ error: "Use your Profile page to edit your own details" }, { status: 403 });
  }

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditUserDetails(session.role, target.role)) {
    return NextResponse.json(
      { error: "You don't have permission to edit this account's details" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!username || !email) {
    return NextResponse.json({ error: "Username and email are required" }, { status: 400 });
  }

  if (username !== target.username && (await usernameExists(username, id))) {
    return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
  }

  const user = await updateProfile(id, { name, username, email, phone });
  return NextResponse.json({ user });
}
