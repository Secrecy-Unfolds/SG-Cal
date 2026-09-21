import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { addVendorDocument, getVendorById } from "@/lib/procurement";
import { isVendorDocumentCategory } from "@/lib/procurementDisplay";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB — same cap as every other upload in the app

// By extension rather than MIME type: browsers report inconsistent (or
// empty) MIME types for Office files, and this is a documents section, not
// a place for arbitrary executables.
const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "csv",
  "txt",
  "zip",
]);

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(req: NextRequest, { params }: { params: { vendorId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can upload vendor documents" }, { status: 403 });
  }

  const vendorId = parseId(params.vendorId);
  if (!vendorId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (!(await getVendorById(vendorId))) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Uploads aren't configured yet (missing BLOB_READ_WRITE_TOKEN) — see SETUP.md" },
      { status: 500 }
    );
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const category = formData?.get("category");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!isVendorDocumentCategory(category)) {
    return NextResponse.json({ error: "Pick a document category" }, { status: 400 });
  }
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      { error: "Unsupported file type — use PDF, an image, Word/Excel/PowerPoint, CSV, TXT or ZIP" },
      { status: 400 }
    );
  }
  if (file.size === 0) return NextResponse.json({ error: "That file is empty" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File must be 4MB or smaller" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const blob = await put(`procurement-vendors/${vendorId}-${Date.now()}-${safeName}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const document = await addVendorDocument({
    vendorId,
    category,
    blobUrl: blob.url,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    uploadedBy: session.uid,
  });

  return NextResponse.json({ document }, { status: 201 });
}
