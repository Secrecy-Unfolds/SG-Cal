"use client";

import { useEffect, useRef, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import {
  EMPLOYEE_DOCUMENT_TYPES,
  EMPLOYEE_DOCUMENT_TYPE_LABELS,
  type EmployeeDocumentRow,
  type EmployeeDocumentType,
} from "@/lib/hrDisplay";
import { formatFileSize } from "@/lib/procurementDisplay";
import { formatMuscat } from "@/lib/time";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx";
const optionClass = "bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100";

// An employee's documents (Civil ID, Passport, Visa, Contract, Degree,
// other). `canManage` (Admin-level, via EmployeeDetailsModal) shows the
// upload form and Delete; without it (self on Profile, or a hierarchical
// superior's "My Team" view) the list is read-only — download only. Only
// the CURRENT version of each doc_type is shown by default; older versions
// are listed but visually de-emphasized (re-upload keeps history, confirmed
// 2026-09-18 — nothing is ever silently overwritten).
export default function EmployeeDocumentsPanel({
  userId,
  canManage,
}: {
  userId: number;
  canManage: boolean;
}) {
  const [documents, setDocuments] = useState<EmployeeDocumentRow[] | null>(null);
  const [docType, setDocType] = useState<EmployeeDocumentType>("civil_id");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<EmployeeDocumentRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function load() {
    fetch(`/api/hr/employees/${userId}/documents`)
      .then((res) => (res.ok ? res.json() : { documents: [] }))
      .then((data) => setDocuments(data.documents ?? []))
      .catch(() => setDocuments([]));
  }

  useEffect(load, [userId]);

  // Not a <form onSubmit> — this panel is nested inside EmployeeDetailsModal's
  // own <form>, and HTML forms can't nest, so the upload button is a plain
  // type="button" click handler instead.
  async function handleUpload() {
    setError(null);
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setError("Choose a file first");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", docType);
      const res = await fetch(`/api/hr/employees/${userId}/documents`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to upload");
        return;
      }
      if (fileInput.current) fileInput.current.value = "";
      load();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: EmployeeDocumentRow) {
    setConfirmingDelete(null);
    setError(null);
    setDeletingId(doc.id);
    try {
      const res = await fetch(`/api/hr/employees/${userId}/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Failed to delete");
        return;
      }
      load();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  if (documents === null) {
    return <p className="text-xs text-black/40 dark:text-white/40 mt-2">Loading documents…</p>;
  }

  const currentVersionIds = new Set(
    EMPLOYEE_DOCUMENT_TYPES.map((t) => documents.find((d) => d.doc_type === t)?.id).filter((id): id is number => !!id)
  );

  return (
    <div className="mt-2 space-y-3">
      {documents.length === 0 ? (
        <p className="text-xs text-black/50 dark:text-white/50">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((doc) => {
            const isCurrent = currentVersionIds.has(doc.id);
            return (
              <li
                key={doc.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                  isCurrent
                    ? "border-black/5 dark:border-white/10"
                    : "border-black/5 dark:border-white/10 opacity-50"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 font-medium bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60 shrink-0">
                      {EMPLOYEE_DOCUMENT_TYPE_LABELS[doc.doc_type]}
                    </span>
                    {!isCurrent && (
                      <span className="text-[10px] text-black/40 dark:text-white/40 shrink-0">
                        v{doc.version_number} (superseded)
                      </span>
                    )}
                    <a
                      href={doc.blob_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium truncate hover:underline"
                    >
                      {doc.file_name}
                    </a>
                  </div>
                  <div className="text-xs text-black/40 dark:text-white/40">
                    {formatFileSize(doc.size_bytes)} ·{" "}
                    {formatMuscat(new Date(doc.uploaded_at), { day: "2-digit", month: "short", year: "numeric" })}
                    {doc.uploaded_by_username ? ` · ${doc.uploaded_by_username}` : ""}
                  </div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="text-xs text-red-600 dark:text-red-400 disabled:opacity-50"
                  >
                    {deletingId === doc.id ? "Deleting..." : "Delete"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as EmployeeDocumentType)}
              className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-xs [color-scheme:light] dark:[color-scheme:dark]"
            >
              {EMPLOYEE_DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t} className={optionClass}>
                  {EMPLOYEE_DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <input ref={fileInput} type="file" accept={ACCEPT} className="text-xs max-w-full" />
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
          <p className="text-xs text-black/40 dark:text-white/40">
            PDF, images, or Word — up to 4MB. Re-uploading a type keeps the older version, it doesn&rsquo;t overwrite it.
          </p>
        </>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {confirmingDelete && (
        <ConfirmModal
          title="Delete document"
          message={`Delete "${confirmingDelete.file_name}"? The file is removed permanently.`}
          confirmLabel="Delete"
          loading={deletingId === confirmingDelete.id}
          onConfirm={() => handleDelete(confirmingDelete)}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}
    </div>
  );
}
