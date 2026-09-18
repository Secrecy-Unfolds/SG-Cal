"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User as UserIcon } from "lucide-react";
import type { UserSummary } from "@/lib/users";

export default function EditUserDetailsModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pictureUrl, setPictureUrl] = useState(user.picture_url);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPictureError(null);
    setUploadingPicture(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/users/${user.id}/picture`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPictureError(data.error ?? "Failed to upload picture");
        return;
      }
      setPictureUrl(data.url);
      router.refresh();
    } finally {
      setUploadingPicture(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemovePicture() {
    setPictureError(null);
    setUploadingPicture(true);
    try {
      const res = await fetch(`/api/users/${user.id}/picture`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPictureError(data.error ?? "Failed to remove picture");
        return;
      }
      setPictureUrl(null);
      router.refresh();
    } finally {
      setUploadingPicture(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !email.trim()) {
      setError("Username and email are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes");
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
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">Edit details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-4 pb-4 border-b border-black/5 dark:border-white/10">
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
                disabled={uploadingPicture}
                className="text-xs"
              />
              {pictureUrl && !uploadingPicture && (
                <button
                  type="button"
                  onClick={handleRemovePicture}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            {uploadingPicture && <p className="text-xs text-black/40 dark:text-white/40 mt-1">Uploading…</p>}
            {pictureError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{pictureError}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <input
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Username</label>
          <input
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Phone number</label>
          <input
            type="tel"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
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
              {saving ? "Saving..." : "Save changes"}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}
