import { NextResponse } from "next/server";
import { validateCredentials, createSession } from "@/lib/auth";
import { isMultiTenant } from "@/lib/multi-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isMultiTenant()) {
    return NextResponse.json({ error: "auth not enabled" }, { status: 400 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json({ error: "username and password required" }, { status: 400 });
  }

  // Constant-time comparison via bcrypt (prevents timing-based username enumeration)
  const valid = await validateCredentials(username, password);
  if (!valid) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  await createSession(username);
  return NextResponse.json({ ok: true, username });
}
