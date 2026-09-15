"use client";

import { useState } from "react";
import type { GovernmentSupporterRow } from "@/lib/governmentSupport";
import type { SupporterType } from "@/lib/governmentSupportDisplay";
import { SUPPORTER_TYPES, SUPPORTER_TYPE_LABELS } from "@/lib/governmentSupportDisplay";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function GovernmentSupporterFormModal({
  supporter,
  onClose,
  onSaved,
}: {
  supporter?: GovernmentSupporterRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(supporter?.name ?? "");
  const [supporterType, setSupporterType] = useState<SupporterType>(supporter?.supporter_type ?? "ministry");
  const [contact, setContact] = useState(supporter?.contact ?? "");
  const [saving, setSaving] = useState(false);
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
      const res = await fetch(supporter ? `/api/government-supporters/${supporter.id}` : "/api/government-supporters", {
        method: supporter ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), supporterType, contact: contact.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save supporter");
        return;
      }
      onSaved();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">
            {supporter ? "Edit supporter" : "New supporter"}
          </h2>
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
          <label className="text-sm font-medium">Type</label>
          <select className={inputClass} value={supporterType} onChange={(e) => setSupporterType(e.target.value as SupporterType)}>
            {SUPPORTER_TYPES.map((t) => (
              <option key={t} value={t} className="bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100">
                {SUPPORTER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Contact</label>
          <input className={inputClass} value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
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
      </form>
    </div>
  );
}
