import { NextResponse } from "next/server";
import { detectClis } from "@/lib/clis";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Detects which agnostic CLIs are installed on THIS machine (local-first). The
// web delegates career-ops to one of these in headless mode, on the user's own
// auth/tokens — no API key needed.
export async function GET() {
  const session = await requireSession();
  if (session instanceof Response) return session;

  return NextResponse.json({ clis: detectClis() });
}
