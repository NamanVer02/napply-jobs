import fs from "node:fs";
import path from "node:path";
import { userDataRoot, doctorState, readApplications, readInbox, trackerCanDelete } from "@/lib/career-ops";
import { scannerSupportsJson } from "@/lib/core/scan";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// STRUCTURAL diagnostics for the in-app bug reporter: shapes, counts and
// capability probes only — never file contents. A malformed tracker shows up
// here as "12 candidate rows, 5 parsed", which is exactly what triage needs,
// without a single company name leaving the machine.

function lineCount(rel: string, predicate: (l: string) => boolean, username?: string): number {
  try {
    return fs
      .readFileSync(path.join(userDataRoot(username), rel), "utf8")
      .split("\n")
      .filter(predicate).length;
  } catch {
    return 0;
  }
}

function dirCount(rel: string, ext: string, username?: string): number {
  try {
    return fs.readdirSync(path.join(userDataRoot(username), rel)).filter((f) => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
}

export async function GET() {
  const session = await requireSession();
  if (session instanceof Response) return session;

  const doctor = doctorState(session);
  // "candidate" = a line that LOOKS like a row; parsed = what the tolerant
  // reader accepted. A gap between the two is the data-contract fingerprint.
  const inboxCandidates = lineCount("data/pipeline.md", (l) => /^\s*-\s*\[[ xX]\]/.test(l), session);
  const trackerCandidates = lineCount(
    "data/applications.md",
    (l) => l.trim().startsWith("|") && !/^\|\s*#\s*\|/.test(l.trim()) && !/^\|\s*:?-{2,}/.test(l.trim()),
    session,
  );
  return Response.json({
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    setup: {
      phase: doctor.phase,
      missing: doctor.missing, // system prereq FILENAMES only (cv.md, portals.yml…)
      hasCv: doctor.hasCv,
      hasData: doctor.hasData,
    },
    data: {
      inbox: { candidates: inboxCandidates, parsed: readInbox(session).length },
      tracker: { candidates: trackerCandidates, parsed: readApplications(session).length },
      reports: dirCount("reports", ".md", session),
      pdfs: dirCount("output", ".pdf", session),
      followupsFile: fs.existsSync(path.join(userDataRoot(session), "data", "follow-ups.md")),
    },
    capabilities: {
      scanJson: scannerSupportsJson(),
      trackerDelete: trackerCanDelete(),
    },
  });
}
