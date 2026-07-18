import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { isMultiTenant, registryPath } from "@/lib/multi-tenant";

// ── Types ───────────────────────────────────────────────────────────────────

type UserEntry = { username: string; password_hash: string };
type Registry = { users: UserEntry[] };

// ── Session secret ──────────────────────────────────────────────────────────

const SESSION_SECRET_PATH = () => path.join(careerOpsRoot(), "users", ".session-secret");
const SESSION_COOKIE = "co-session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/** Auto-generate and persist a random secret on first use. */
function getSessionSecret(): string {
  const p = SESSION_SECRET_PATH();
  try {
    const existing = fs.readFileSync(p, "utf8").trim();
    if (existing.length >= 32) return existing;
  } catch { /* doesn't exist yet */ }
  const secret = crypto.randomBytes(48).toString("base64url");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, secret, { mode: 0o600 });
  return secret;
}

// ── Registry ────────────────────────────────────────────────────────────────

function loadRegistry(): Registry {
  try {
    const raw = yaml.load(fs.readFileSync(registryPath(), "utf8"));
    if (raw && typeof raw === "object" && Array.isArray((raw as Registry).users)) {
      return raw as Registry;
    }
  } catch { /* no registry */ }
  return { users: [] };
}

/** Validate username + password against the bcrypt hashes in registry.yml. */
export async function validateCredentials(username: string, password: string): Promise<boolean> {
  const reg = loadRegistry();
  const user = reg.users.find((u) => u.username === username);
  if (!user?.password_hash) return false;
  return bcrypt.compare(password, user.password_hash);
}

/** Check if a username exists in the registry. */
export function userExists(username: string): boolean {
  const reg = loadRegistry();
  return reg.users.some((u) => u.username === username);
}

// ── Session token ───────────────────────────────────────────────────────────

/** Create an HMAC-signed session token: base64url(payload).base64url(hmac) */
function signToken(payload: { username: string; exp: number }): string {
  const secret = getSessionSecret();
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${hmac}`;
}

/** Verify and decode the session token. Returns the username or null. */
function verifyToken(token: string): string | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const secret = getSessionSecret();
    const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (typeof payload.username !== "string" || typeof payload.exp !== "number") return null;
    if (Date.now() / 1000 > payload.exp) return null;
    // Verify the user still exists in registry (in case they were removed)
    if (!userExists(payload.username)) return null;
    return payload.username;
  } catch {
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Create a session for the given username. Sets an httpOnly cookie. */
export async function createSession(username: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const token = signToken({ username, exp });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: false, // Tailscale private network — no TLS termination expected
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/** Destroy the session (clear the cookie). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Get the logged-in username from the session cookie.
 * In single-user mode (no registry.yml), returns undefined (no auth required).
 * In multi-tenant mode, returns the username or undefined if not authenticated.
 */
export async function getSessionUser(): Promise<string | undefined> {
  if (!isMultiTenant()) return undefined;
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE);
  if (!cookie?.value) return undefined;
  return verifyToken(cookie.value) ?? undefined;
}

/**
 * Require a valid session in multi-tenant mode. Returns the username.
 * In single-user mode, returns undefined (no scoping needed).
 * In multi-tenant mode with no valid session, returns a 401 Response.
 */
export async function requireSession(): Promise<string | undefined | Response> {
  if (!isMultiTenant()) return undefined;
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
