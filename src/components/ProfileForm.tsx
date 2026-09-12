"use client";

import { useState } from "react";
import { HudFrameForm } from "@/components/hud/HudFrame";

export default function ProfileForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to change password");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <HudFrameForm
      onSubmit={handleSubmit}
      corners="all"
      className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-4"
    >
      <h2 className="font-heading font-semibold text-sm uppercase tracking-wide">Change password</h2>

      <div className="space-y-1">
        <label className="text-sm font-medium">Current password</label>
        <input
          type="password"
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">New password</label>
        <input
          type="password"
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          required
        />
        <p className="text-xs text-black/40 dark:text-white/40">At least 8 characters.</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Confirm new password</label>
        <input
          type="password"
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Password updated.</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-accent text-ink btn-skew btn-glow py-2 text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Saving..." : "Update password"}
      </button>
    </HudFrameForm>
  );
}
