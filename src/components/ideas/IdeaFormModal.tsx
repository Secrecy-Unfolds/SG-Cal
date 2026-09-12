"use client";

import { useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";
import type { IdeaRow } from "@/lib/ideas";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function IdeaFormModal({
  idea,
  onClose,
  onSaved,
  onDeleted,
}: {
  idea?: IdeaRow;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEdit = !!idea;

  const [name, setName] = useState(idea?.name ?? "");
  const [description, setDescription] = useState(idea?.description ?? "");
  const [prerequisites, setPrerequisites] = useState(idea?.prerequisites ?? "");
  const [expectedStartDate, setExpectedStartDate] = useState(idea?.expected_start_date ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/ideas/${idea!.id}` : "/api/ideas", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          prerequisites,
          expectedStartDate: expectedStartDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save idea");
        return;
      }
      onSaved();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!idea) return;
    setConfirmingDelete(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete idea");
        return;
      }
      onDeleted();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">{isEdit ? "Edit idea" : "New idea"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className={`${inputClass} min-h-[80px]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Pre-requisites</label>
          <textarea
            className={`${inputClass} min-h-[60px]`}
            value={prerequisites}
            onChange={(e) => setPrerequisites(e.target.value)}
            placeholder="What needs to be in place first"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Expected start date</label>
          <input
            type="date"
            className={`${inputClass} dark:[color-scheme:dark]`}
            value={expectedStartDate}
            onChange={(e) => setExpectedStartDate(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          {isEdit ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={deleting}
              className="text-sm text-red-600 dark:text-red-400 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <span className="btn-glow inline-block">
              <button
                type="button"
                onClick={onClose}
                className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
              >
                Cancel
              </button>
            </span>
            <span className="btn-glow inline-block">
              <button
                type="submit"
                disabled={saving}
                className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </span>
          </div>
        </div>
      </form>

      {confirmingDelete && idea && (
        <ConfirmModal
          title="Delete idea"
          message={`Delete "${idea.name}"?`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
