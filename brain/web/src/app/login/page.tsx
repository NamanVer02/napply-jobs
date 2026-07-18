"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CoMark } from "@/components/co-mark";
import { instrumentSerif } from "@/lib/fonts";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // If already logged in, redirect immediately
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.username) router.replace("/");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        router.replace("/");
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch {
      setError("Network error — check your connection");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="animate-pulse text-[var(--faint)]">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <CoMark size={48} />
          <h1
            className={`${instrumentSerif.className} text-3xl font-normal tracking-tight text-[var(--landing)]`}
          >
            career-ops
          </h1>
          <p className="text-sm text-[var(--muted)]">Sign in to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="login-username" className="block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--faint)] outline-none transition-colors focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/30"
              placeholder="your username"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--faint)] outline-none transition-colors focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/30"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-[var(--faint)]">
          Private instance · Tailscale network
        </p>
      </div>
    </div>
  );
}
