"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

type AuthState = {
  multiTenant: boolean;
  username: string | null;
  loading: boolean;
  fetchedPath: string | null;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  multiTenant: false,
  username: null,
  loading: true,
  fetchedPath: null,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

/** Wraps the app. In multi-tenant mode, redirects unauthenticated users to /login.
 *  In single-user mode (no registry.yml), passes through transparently. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    multiTenant: false,
    username: null,
    loading: true,
    fetchedPath: null,
    logout: async () => {},
  });

  // Fetch session user
  useEffect(() => {
    // Only fetch if we are loading, don't have a user, or are transitioning paths
    if (!state.loading && state.username && pathname !== "/login" && state.fetchedPath === pathname) {
      return;
    }

    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setState({
          multiTenant: !!d.multiTenant,
          username: d.username ?? null,
          loading: false,
          fetchedPath: pathname,
          logout: async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            setState((s) => ({ ...s, username: null, fetchedPath: null }));
            router.replace("/login");
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, fetchedPath: pathname }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router, state.loading, state.username, state.fetchedPath]);

  // Handle redirects in useEffect to prevent "Cannot update a component while rendering a different component" warning
  useEffect(() => {
    const isTransitioning = state.fetchedPath !== pathname;
    const showLoading = state.loading || isTransitioning;

    if (!showLoading && state.multiTenant && !state.username && pathname !== "/login") {
      router.replace("/login");
    }
  }, [pathname, router, state.loading, state.multiTenant, state.username, state.fetchedPath]);

  // Don't guard the login page itself
  if (pathname === "/login") return <>{children}</>;

  // If the pathname has changed since our last fetch, show loading to allow the fetch to resolve
  const isTransitioning = state.fetchedPath !== pathname;
  const showLoading = state.loading || isTransitioning;

  // Loading state
  if (showLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-[var(--faint)]">Loading…</div>
      </div>
    );
  }

  // Multi-tenant but not authenticated → render redirecting view (handled by the redirect useEffect above)
  if (state.multiTenant && !state.username) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-[var(--faint)]">Redirecting…</div>
      </div>
    );
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
