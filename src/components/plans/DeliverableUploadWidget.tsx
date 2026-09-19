"use client";

import { useState } from "react";
import type { DeliverableDefRow } from "@/lib/planDeliverablesDisplay";
import { formatMuscatDateTime } from "@/lib/time";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function DeliverableUploadWidget({
  stepId,
  def,
  onChanged,
}: {
  stepId: number;
  def: DeliverableDefRow;
  onChanged: () => void;
}) {
  const [textValue, setTextValue] = useState(def.text_value ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveText() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/steps/${stepId}/deliverables/${def.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save");
        return;
      }
      onChanged();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/plans/steps/${stepId}/deliverables/${def.id}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to upload");
        return;
      }
      onChanged();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  const currentFile = def.files[0] ?? null; // files[0] is newest — see STEP_SELECT's ORDER BY version_number DESC
  const olderFiles = def.files.slice(1);

  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{def.label}</span>
        <span className="text-[10px] uppercase tracking-wide text-black/40 dark:text-white/40">{def.kind}</span>
      </div>

      {def.kind === "text" ? (
        <div className="flex gap-2">
          <textarea
            className={`${inputClass} min-h-[50px] flex-1`}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Fill in once known..."
          />
          <span className="btn-glow inline-block self-end">
            <button
              type="button"
              onClick={saveText}
              disabled={saving}
              className="bg-accent text-ink btn-skew px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {currentFile ? (
            <a
              href={currentFile.blob_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent dark:text-blue-300 hover:underline break-all"
            >
              {currentFile.file_name} (v{currentFile.version_number})
            </a>
          ) : (
            <p className="text-xs text-black/40 dark:text-white/40">No file uploaded yet</p>
          )}
          <input
            type="file"
            accept={def.kind === "image" ? "image/*" : "application/pdf"}
            onChange={handleFileChange}
            disabled={uploading}
            className="text-xs"
          />
          {uploading && <p className="text-xs text-black/40 dark:text-white/40">Uploading...</p>}
          {olderFiles.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="text-xs text-black/40 dark:text-white/40 hover:text-accent"
              >
                {showHistory ? "Hide" : "Show"} {olderFiles.length} earlier version{olderFiles.length > 1 ? "s" : ""}
              </button>
              {showHistory && (
                <ul className="mt-1 space-y-1">
                  {olderFiles.map((f) => (
                    <li key={f.id}>
                      <a
                        href={f.blob_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-black/50 dark:text-white/50 hover:underline break-all"
                      >
                        {f.file_name} (v{f.version_number}, {formatMuscatDateTime(new Date(f.uploaded_at))})
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
