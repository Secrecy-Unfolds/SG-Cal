import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { addDeliverableFileVersion, getDeliverableDefKind, getDeliverableDefStepId } from "@/lib/planDeliverables";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB — same cap as procurement/accounting uploads

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Reuses the same Vercel Blob upload pattern as procurement/accounting
// uploads, but this is the first one with real version history —
// re-uploading here inserts a new step_deliverable_files row rather than
// overwriting (see db/schema.sql's comment on that table).
export async function POST(req: NextRequest, { params }: { params: { id: string; defId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can upload a deliverable" }, { status: 403 });
  }

  const stepId = parseId(params.id);
  const defId = parseId(params.defId);
  if (!stepId || !defId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [defStepId, kind] = await Promise.all([getDeliverableDefStepId(defId), getDeliverableDefKind(defId)]);
  if (defStepId === null || defStepId !== stepId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (kind !== "image" && kind !== "pdf") {
    return NextResponse.json({ error: "This deliverable doesn't accept a file upload" }, { status: 400 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Uploads aren't configured yet (missing BLOB_READ_WRITE_TOKEN) — see SETUP.md" },
      { status: 500 }
    );
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (kind === "image" && !isImage) {
    return NextResponse.json({ error: "This deliverable only accepts image files" }, { status: 400 });
  }
  if (kind === "pdf" && !isPdf) {
    return NextResponse.json({ error: "This deliverable only accepts PDF files" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File must be 4MB or smaller" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const blob = await put(`plans/deliverables/${defId}-${Date.now()}-${safeName}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const version = await addDeliverableFileVersion({
    deliverableDefId: defId,
    blobUrl: blob.url,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    uploadedBy: session.uid,
  });

  return NextResponse.json({ id: version.id, versionNumber: version.version_number, url: blob.url }, { status: 201 });
}
