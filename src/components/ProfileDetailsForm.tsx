"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User as UserIcon } from "lucide-react";
import { HudFrame } from "@/components/hud/HudFrame";
import type { UserSummary } from "@/lib/users";

type ProfileFields = {
  name: string;
  username: string;
  email: string;
  phone: string;
};

function EditableField({
  label,
  value,
  onSave,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<string | null>;
  type?: string;
  required?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setError(null);
    setEditing(false);
  }

  async function save() {
    const trimmed = draft.trim();
    if (required && !trimmed) {
      setError(`${label} is required`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const err = await onSave(trimmed);
      if (err) {
        setError(err);
        return;
      }
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="py-3 border-b border-black/5 dark:border-white/10 last:border-b-0">
      <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide mb-1">{label}</div>
      {editing ? (
        <div className="space-y-2">
          <input
            type={type}
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <span className="btn-glow inline-block">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="bg-accent text-ink btn-skew px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </span>
            <span className="btn-glow inline-block">
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                className="btn-skew border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/[0.03] dark:hover:bg-white/5"
              >
                Cancel
              </button>
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm truncate">{value || "—"}</span>
          <span className="btn-glow shrink-0 inline-block">
            <button
              type="button"
              onClick={startEditing}
              className="text-xs btn-skew border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Update
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

export default function ProfileDetailsForm({ user }: { user: UserSummary }) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileFields>({
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
  });
  const [pictureUrl, setPictureUrl] = useState(user.picture_url);
  const [uploading, setUploading] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveField(field: keyof ProfileFields, newValue: string): Promise<string | null> {
    const next = { ...profile, [field]: newValue };
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Failed to save";
      setProfile(next);
      if (field === "username") router.refresh();
      return null;
    } catch {
      return "Network error — check your connection and try again.";
    }
  }

  async function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPictureError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/picture", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPictureError(data.error ?? "Failed to upload picture");
        return;
      }
      setPictureUrl(data.url);
      router.refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemovePicture() {
    setPictureError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/profile/picture", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPictureError(data.error ?? "Failed to remove picture");
        return;
      }
      setPictureUrl(null);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <HudFrame corners="all" className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-6">
      <h2 className="font-heading font-semibold text-sm uppercase tracking-wide mb-4">Account details</h2>

      <div className="flex items-center gap-4 mb-2 pb-4 border-b border-black/5 dark:border-white/10">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
          {pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pictureUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <UserIcon size={28} className="text-black/30 dark:text-white/30" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide mb-1">Profile picture</div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePictureChange}
              disabled={uploading}
              className="text-xs"
            />
            {pictureUrl && !uploading && (
              <button
                type="button"
                onClick={handleRemovePicture}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          {uploading && <p className="text-xs text-black/40 dark:text-white/40 mt-1">Uploading…</p>}
          {pictureError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{pictureError}</p>}
        </div>
      </div>

      <EditableField label="Name" value={profile.name} onSave={(v) => saveField("name", v)} />
      <EditableField
        label="Username"
        value={profile.username}
        onSave={(v) => saveField("username", v)}
        required
      />
      <EditableField
        label="Email"
        value={profile.email}
        onSave={(v) => saveField("email", v)}
        type="email"
        required
      />
      <EditableField label="Phone number" value={profile.phone} onSave={(v) => saveField("phone", v)} type="tel" />
    </HudFrame>
  );
}
