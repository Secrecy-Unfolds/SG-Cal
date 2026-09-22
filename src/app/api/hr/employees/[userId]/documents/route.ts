import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { addEmployeeDocument, getEmployeeDetailsForViewer, listEmployeeDocuments } from "@/lib/hr";
import { isEmployeeDocumentType } from "@/lib/hrDisplay";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB — same cap as every other upload in the app
const ALLOWED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif", "doc", "docx"]);

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Same self/Admin-level/hierarchical-superior rule as the employee record
// itself (documents are scans of the same sensitive fields, so the read gate
// matches — see lib/hr.ts's getEmployeeDetailsForViewer).
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseId(params.userId);
  if (!userId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const view = await getEmployeeDetailsForViewer(userId, session.uid, session.role);
  if (!view.ok) {
    return NextResponse.json(
      { error: view.reason === "not_found" ? "Not found" : "Not allowed" },
      { status: view.reason === "not_found" ? 404 : 403 }
    );
  }
  return NextResponse.json({ documents: await listEmployeeDocuments(userId) });
}

// Admin-level only — uploading/editing an employee's record (and its
// documents) stays Admin-level-only, matching every other employee_details
// write; only the READ side got the new hierarchical rule.
export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can upload employee documents" }, { status: 403 });
  }

  const userId = parseId(params.userId);
  if (!userId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Uploads aren't configured yet (missing BLOB_READ_WRITE_TOKEN) — see SETUP.md" },
      { status: 500 }
    );
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const docType = formData?.get("docType");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (!isEmployeeDocumentType(docType)) {
    return NextResponse.json({ error: "Pick a document type" }, { status: 400 });
  }
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "Unsupported file type — use PDF, an image, or Word" }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "That file is empty" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File must be 4MB or smaller" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const blob = await put(`hr/employees/${userId}-${docType}-${Date.now()}-${safeName}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const document = await addEmployeeDocument({
    userId,
    docType,
    blobUrl: blob.url,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    uploadedBy: session.uid,
  });

  return NextResponse.json({ document }, { status: 201 });
}
