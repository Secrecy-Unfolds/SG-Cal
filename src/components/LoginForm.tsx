"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { HudFrameForm } from "@/components/hud/HudFrame";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
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
        <div className="flex flex-col items-center text-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-square-navy.png" alt="SG-ERP" className="h-16 w-16 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-square-white.png" alt="SG-ERP" className="h-16 w-16 hidden dark:block" />
          <div>
            <h1 className="font-heading font-semibold text-xl uppercase tracking-wide">SG-ERP</h1>
            <p className="text-sm text-black/50 dark:text-white/50">Sign in to continue</p>
          </div>
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
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-ink [clip-path:polygon(6%_0,100%_0,94%_100%,0_100%)] py-2 text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </HudFrameForm>
    </main>
  );
}
