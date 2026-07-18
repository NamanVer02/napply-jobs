import { pipelineSummary } from "@/lib/career-ops";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read fresh local files

// Exposes the user's pipeline (inbox + tracker) to the client so the assistant
// can resolve "all the Anthropic ones" to concrete postings CLIENT-SIDE — the
// model only ever emits a company name, never URLs (no hallucination, no tokens).
export async function GET() {
  const session = await requireSession();
  if (session instanceof Response) return session;
  const s = pipelineSummary(session);
  return Response.json({
    inbox: s.inbox,
    applications: s.applications,
    root: s.root,
    rootExists: s.rootExists,
  });
}
