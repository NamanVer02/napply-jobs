import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { userDataRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";
import { requireSession } from "@/lib/auth";

function cvPath(username?: string) {
  return path.join(userDataRoot(username), "cv.md");
}

const MAX_CV_BYTES = 200_000;

export async function GET() {
  const session = await requireSession();
  if (session instanceof Response) return session;
  try {
    return NextResponse.json({ content: fs.readFileSync(cvPath(session), "utf8"), exists: true });
  } catch {
    return NextResponse.json({ content: "", exists: false });
  }
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (session instanceof Response) return session;
  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  if (Buffer.byteLength(body.content, "utf8") > MAX_CV_BYTES) {
    return NextResponse.json({ error: "CV is too large (over 200KB)" }, { status: 413 });
  }
  // DATA_CONTRACT: cv.md is user-layer and gitignored (no git recovery). Never
  // blind-overwrite — snapshot the prior CV to a .bak first, write atomically.
  try {
    const bak = atomicWriteWithBackup(cvPath(session), body.content);
    return NextResponse.json({ ok: true, backedUp: !!bak });
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
