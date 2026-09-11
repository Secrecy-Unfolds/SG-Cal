"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserRole = "user" | "admin";

export default function AddUserForm({ actorRole }: { actorRole: "admin" | "super_admin" }) {
  const router = useRouter();
  const canPickRole = actorRole === "super_admin";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
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
      setSuccess(`Added "${username.trim()}".`);
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("user");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-4"
    >
      <h2 className="text-sm font-semibold">Add a user</h2>

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
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                role === "user" ? "bg-accent text-white" : "text-black/50 dark:text-white/50"
              }`}
            >
              User
            </button>
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                role === "admin" ? "bg-accent text-white" : "text-black/50 dark:text-white/50"
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
      {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-accent text-white py-2 text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Adding..." : "Add user"}
      </button>
    </form>
  );
}
