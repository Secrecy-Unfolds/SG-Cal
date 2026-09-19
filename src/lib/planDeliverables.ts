import { query } from "@/lib/db";
import { del } from "@vercel/blob";

// Single source of truth for the client-safe pieces lives in
// planDeliverablesDisplay.ts (no server-only imports) — see its own
// comment. Re-exported here so every existing server-side import site
// (lib/planSteps.ts, the API routes) keeps working unchanged.
export type {
  DeliverableKind,
  DeliverableFileRow,
  DeliverableDefRow,
} from "@/lib/planDeliverablesDisplay";
export { isDeliverableKind, isDeliverableDefFilled } from "@/lib/planDeliverablesDisplay";

import type { DeliverableKind } from "@/lib/planDeliverablesDisplay";

export async function addDeliverableDef(input: {
  stepId: number;
  kind: DeliverableKind;
  label: string;
  sortOrder: number;
}): Promise<{ id: number }> {
  const res = await query<{ id: number }>(
    `INSERT INTO step_deliverable_defs (step_id, kind, label, sort_order)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.stepId, input.kind, input.label, input.sortOrder]
  );
  return res.rows[0];
}

// Every deliverable upload attaches immediately on select (there's no
// "unsaved, cancel to discard" step for a deliverable file the way
// Procurement's product-picture form has), so the orphaned-upload
// scenario here is different: a def's own uploaded file versions become
// orphaned Blob storage once the def itself is deleted, since Postgres
// only ever cascades the DB rows. Cleaned up best-effort, after the DB
// delete succeeds — a failed blob delete shouldn't roll back the def
// deletion the user actually asked for.
export async function deleteDeliverableDef(id: number): Promise<void> {
  const filesRes = await query<{ blob_url: string }>(
    `SELECT blob_url FROM step_deliverable_files WHERE deliverable_def_id = $1`,
    [id]
  );
  await query(`DELETE FROM step_deliverable_defs WHERE id = $1`, [id]);
  await Promise.all(filesRes.rows.map((f) => del(f.blob_url).catch(() => {})));
}

export async function getDeliverableDefStepId(id: number): Promise<number | null> {
  const res = await query<{ step_id: number }>(`SELECT step_id FROM step_deliverable_defs WHERE id = $1`, [id]);
  return res.rows[0]?.step_id ?? null;
}

export async function getDeliverableDefKind(id: number): Promise<DeliverableKind | null> {
  const res = await query<{ kind: DeliverableKind }>(`SELECT kind FROM step_deliverable_defs WHERE id = $1`, [id]);
  return res.rows[0]?.kind ?? null;
}

// Only meaningful for kind='text' — image/pdf defs are filled via
// addDeliverableFileVersion below instead.
export async function setDeliverableTextValue(id: number, textValue: string, filledBy: number): Promise<void> {
  await query(
    `UPDATE step_deliverable_defs SET text_value = $1, filled_by = $2, filled_at = now() WHERE id = $3`,
    [textValue, filledBy, id]
  );
}

// Re-uploading inserts a new version rather than overwriting — old
// versions stay retrievable (confirmed 2026-09-18). Also stamps the def's
// own filled_by/filled_at, mirroring the text-value path above.
export async function addDeliverableFileVersion(input: {
  deliverableDefId: number;
  blobUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: number;
}): Promise<{ id: number; version_number: number }> {
  const nextVersion = await query<{ next: number }>(
    `SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM step_deliverable_files WHERE deliverable_def_id = $1`,
    [input.deliverableDefId]
  );
  const versionNumber = nextVersion.rows[0].next;
  const res = await query<{ id: number }>(
    `INSERT INTO step_deliverable_files (deliverable_def_id, version_number, blob_url, file_name, mime_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [input.deliverableDefId, versionNumber, input.blobUrl, input.fileName, input.mimeType, input.sizeBytes, input.uploadedBy]
  );
  await query(
    `UPDATE step_deliverable_defs SET filled_by = $1, filled_at = now() WHERE id = $2`,
    [input.uploadedBy, input.deliverableDefId]
  );
  return { id: res.rows[0].id, version_number: versionNumber };
}
