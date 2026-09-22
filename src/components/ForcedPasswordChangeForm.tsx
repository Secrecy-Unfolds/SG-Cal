"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { HudFrameForm } from "@/components/hud/HudFrame";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

// Shown after a Super-Admin password reset: the only page a flagged session
// can reach. "Current password" is the temporary one from the email.
export default function ForcedPasswordChangeForm({ username, required }: { username: string; required: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <HudFrameForm
        onSubmit={handleSubmit}
        corners="all"
        className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-black/5 dark:border-white/10 p-8 space-y-4"
      >
        <div className="text-center">
          <h1 className="font-heading font-semibold text-xl uppercase tracking-wide">Change password</h1>
          <p className="text-sm text-black/50 dark:text-white/50 mt-1">
            {required
              ? `${username}, your password was reset. Choose your own to continue.`
              : `Signed in as ${username}.`}
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{required ? "Temporary password" : "Current password"}</label>
          <input
            type="password"
            className={inputClass}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoFocus
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">New password</label>
          <input
            type="password"
            className={inputClass}
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
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <span className="btn-glow block w-full">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-accent text-ink btn-skew py-2 text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
          >
            {saving ? "Saving..." : "Change password"}
          </button>
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full text-xs text-black/50 dark:text-white/50 hover:underline"
        >
          Sign out
        </button>
      </HudFrameForm>
    </main>
  );
}
