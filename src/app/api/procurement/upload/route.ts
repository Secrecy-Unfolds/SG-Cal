import { NextRequest, NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can upload pictures" }, { status: 403 });
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
  const blob = await put(`procurement/${Date.now()}-${safeName}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  return NextResponse.json({ url: blob.url }, { status: 201 });
}

// Lets a product form clean up a picture it uploaded but never attached to
// a saved product (modal closed, or replaced by a second upload, before
// Save) — otherwise that blob sits in storage forever with nothing pointing
// at it. Scoped to this route's own "procurement/" prefix so a bad/forged
// url can't be used to delete something unrelated.
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can delete pictures" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  const pathname = url ? (() => { try { return new URL(url).pathname; } catch { return ""; } })() : "";
  if (!pathname.startsWith("/procurement/")) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  await del(url).catch(() => {}); // best-effort — an already-gone blob isn't an error worth surfacing
  return NextResponse.json({ ok: true });
}
