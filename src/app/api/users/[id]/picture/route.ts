import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { canEditUserDetails, getUserById } from "@/lib/users";
import { query } from "@/lib/db";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Admin-side upload of another user's avatar — same permission gate as
// editing that user's other account details (canEditUserDetails), not
// tied to isAdminLevel alone, so an Admin still can't touch a Super
// Admin's avatar. Self-service upload (own avatar) stays on
// /api/profile/picture, untouched.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (id === session.uid) {
    return NextResponse.json({ error: "Use your Profile page to change your own picture" }, { status: 403 });
  }

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditUserDetails(session.role, target.role)) {
    return NextResponse.json({ error: "You don't have permission to edit this account's picture" }, { status: 403 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Picture uploads aren't configured yet (missing BLOB_READ_WRITE_TOKEN) — see SETUP.md" },
      { status: 500 }
    );
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Image must be 4MB or smaller" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const blob = await put(`avatars/${id}-${Date.now()}-${safeName}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  await query("UPDATE users SET picture_url = $1 WHERE id = $2", [blob.url, id]);

  return NextResponse.json({ url: blob.url }, { status: 201 });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (id === session.uid) {
    return NextResponse.json({ error: "Use your Profile page to change your own picture" }, { status: 403 });
  }

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditUserDetails(session.role, target.role)) {
    return NextResponse.json({ error: "You don't have permission to edit this account's picture" }, { status: 403 });
  }

  await query("UPDATE users SET picture_url = NULL WHERE id = $1", [id]);

  return NextResponse.json({ ok: true });
}
