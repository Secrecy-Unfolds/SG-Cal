// Client-safe deliverable types/helpers — no server-only imports (mirrors
// events.ts's split into eventDisplay.ts). lib/planDeliverables.ts
// re-exports everything here and adds the `query`-based (pg-dependent)
// CRUD functions — client components must import from THIS file, not
// planDeliverables.ts, or they'll pull `pg` into the browser bundle.

export type DeliverableKind = "text" | "image" | "pdf";

export function isDeliverableKind(value: unknown): value is DeliverableKind {
  return value === "text" || value === "image" || value === "pdf";
}

export type DeliverableFileRow = {
  id: number;
  deliverable_def_id: number;
  version_number: number;
  blob_url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number | null;
  uploaded_by: number | null;
  uploaded_by_username: string | null;
  uploaded_at: Date;
};

export type DeliverableDefRow = {
  id: number;
  step_id: number;
  kind: DeliverableKind;
  label: string;
  sort_order: number;
  text_value: string | null;
  filled_by: number | null;
  filled_by_username: string | null;
  filled_at: Date | null;
  created_at: Date;
  // Newest version first — files[0] is "current".
  files: DeliverableFileRow[];
};

// A deliverable def is satisfied once it has real content: a non-empty
// text answer, or at least one uploaded file version.
export function isDeliverableDefFilled(def: Pick<DeliverableDefRow, "kind" | "text_value" | "files">): boolean {
  if (def.kind === "text") return !!def.text_value && def.text_value.trim().length > 0;
  return def.files.length > 0;
}
