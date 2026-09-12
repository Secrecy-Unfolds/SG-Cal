"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserRole = "user" | "admin";

export default function AddUserForm({
  actorRole,
  onClose,
}: {
  actorRole: "admin" | "super_admin";
  onClose: () => void;
}) {
  const router = useRouter();
  const canPickRole = actorRole === "super_admin";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          role: canPickRole ? role : "user",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add user");
        return;
      }
      router.refresh();
      onClose();
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
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">Add a user</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Username</label>
          <input
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
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
            placeholder="Where their reminder emails go"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Initial password</label>
          <input
            type="password"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <p className="text-xs text-black/40 dark:text-white/40">
            At least 8 characters. They can change it later from Change Password.
          </p>
        </div>

        {canPickRole ? (
          <div className="space-y-1">
            <label className="text-sm font-medium">Role</label>
            <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm">
              <button
                type="button"
                onClick={() => setRole("user")}
                className={`flex-1 btn-skew btn-glow py-1.5 font-medium transition-colors ${
                  role === "user" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
                }`}
              >
                User
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`flex-1 btn-skew btn-glow py-1.5 font-medium transition-colors ${
                  role === "admin" ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
                }`}
              >
                Admin
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-black/40 dark:text-white/40">
            New accounts you add get the User role. Only a Super Admin can add Admin accounts.
          </p>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-skew btn-glow px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-accent text-ink btn-skew btn-glow px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add user"}
          </button>
        </div>
      </form>
    </div>
  );
}
