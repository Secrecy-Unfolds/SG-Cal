"use client";

import { useRef, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import {
  VENDOR_DOCUMENT_CATEGORIES,
  VENDOR_DOCUMENT_CATEGORY_LABELS,
  formatFileSize,
  type VendorDocumentCategory,
  type VendorDocumentRow,
} from "@/lib/procurementDisplay";
import { formatMuscat } from "@/lib/time";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip";

// A vendor's documents (company profile, product catalogue, price list,
// ...) — collapsed under the vendor card, with an upload row and per-file
// delete. Files go to Vercel Blob through the vendor's documents route.
export default function VendorDocumentsPanel({
  vendorId,
  documents,
  onChanged,
  canManage = true,
}: {
  vendorId: number;
  documents: VendorDocumentRow[];
  onChanged: () => void;
  // Organization structure Phase 4: false for a department-module
  // "procurement" viewer — the list stays visible, upload/delete don't.
  canManage?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<VendorDocumentCategory>("company_profile");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<VendorDocumentRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
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
      formData.append("category", category);
      const res = await fetch(`/api/procurement/vendors/${vendorId}/documents`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to upload");
        return;
      }
      if (fileInput.current) fileInput.current.value = "";
      onChanged();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: VendorDocumentRow) {
    setConfirmingDelete(null);
    setError(null);
    setDeletingId(doc.id);
    try {
      const res = await fetch(`/api/procurement/vendors/${vendorId}/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete");
        return;
      }
      onChanged();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-3 border-t border-black/5 dark:border-white/10 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-accent dark:text-blue-300 hover:underline"
      >
        {open ? "Hide" : "Show"} documents ({documents.length})
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          {documents.length === 0 ? (
            <p className="text-xs text-black/50 dark:text-white/50">No documents uploaded yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/5 dark:border-white/10 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 font-medium bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60 shrink-0">
                        {VENDOR_DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category}
                      </span>
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
              ))}
            </ul>
          )}

          {canManage && (
            <>
              <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as VendorDocumentCategory)}
                  className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-xs [color-scheme:light] dark:[color-scheme:dark]"
                >
                  {VENDOR_DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
                      {VENDOR_DOCUMENT_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
                <input ref={fileInput} type="file" accept={ACCEPT} className="text-xs max-w-full" />
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </form>
              <p className="text-xs text-black/40 dark:text-white/40">
                PDF, images, Word/Excel/PowerPoint, CSV, TXT or ZIP — up to 4MB each.
              </p>
            </>
          )}
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}

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
