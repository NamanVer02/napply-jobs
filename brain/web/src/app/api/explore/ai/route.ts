import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveCli } from "@/lib/clis";
import { careerOpsRoot, userDataRoot, readMemory } from "@/lib/career-ops";
import { assembleDedupContext } from "@/lib/core/discover";
import { requireSession } from "@/lib/auth";

// AI search orchestrates modes/discover.md by running the USER'S configured CLI
// headless (CLI-agnostic, like the assistant). Web hunting is slow → generous
// budget. The agent is a PROPOSER: Write/Edit/Bash are disabled so it structurally
// cannot persist; the only writes happen when the user later ADDs a candidate.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

const OUTPUT_CONTRACT = `

--- OUTPUT CONTRACT (the career-ops WEB is parsing your stream) ---
Follow modes/discover.md exactly. You are running headless for the web:
- You are a PROPOSER — never write a file (Write/Edit/Bash are disabled).
- Emit each candidate as ONE line, never inside a code fence:
  <<offer:{"url":"…","title":"…","company":"…","location":"…","source":"ai-search","why":"…","postedHint":"…","ats":"…","verification":"unconfirmed"}>>
  Valid JSON, one per line, the moment you're confident — stream them as you go.
- Between envelopes, narrate briefly (plain text) what you're searching — shown live as your reasoning.
- Be frugal (~3–6 searches, stop at a strong set). EVERY candidate is UNVERIFIED.
- Be a GENEROUS FINDER, not a judge: when a constraint (location, seniority, stage) can't be confirmed from the shallow signal, INCLUDE + flag the uncertainty in "why" — don't discard. NEVER score or judge fit; the A–F evaluation does that later, with the full JD.
- DEDUP: skip anything already known below; don't re-propose the user's existing companies.
`;

export async function POST(req: Request) {
  const session = await requireSession();
  if (session instanceof Response) return session;

  let body: { query?: string; cliId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const query = (body.query || "").trim();
  const cliId = body.cliId;
  if (!query || !cliId) return Response.json({ error: "query and cliId required" }, { status: 400 });

  const resolved = resolveCli(cliId);
  if (!resolved) return Response.json({ error: `CLI '${cliId}' not found on this machine` }, { status: 404 });
  const { spec, binPath } = resolved;

  // Read the CANONICAL mode at request time — single source of truth, never a
  // homegrown prompt. Missing (older core) → graceful 400 so the Scan tab stays usable.
  let mode: string;
  try {
    mode = fs.readFileSync(path.join(careerOpsRoot(), "modes", "discover.md"), "utf8");
  } catch {
    return Response.json({ code: "MODE_MISSING", error: "AI search needs a newer career-ops — update to enable it." }, { status: 400 });
  }

  const { lines } = assembleDedupContext(session);
  const memory = readMemory(session);
  const memoryLine = memory.trim() ? `\n\nWHAT YOU KNOW ABOUT THE USER (persistent memory):\n${memory.trim()}` : "";
  const knownBlock = lines.length ? `\n\n--- ALREADY KNOWN (dedup — do NOT propose these) ---\n${lines.join("\n")}` : "";
  const prompt = `${mode}${OUTPUT_CONTRACT}${memoryLine}${knownBlock}\n\n--- USER INTENT ---\n${query}\n`;

  const isClaude = cliId === "claude";
  const args = isClaude
    ? [
        "-p",
        prompt,
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--permission-mode",
        "acceptEdits",
        "--allowedTools",
        "Read,WebFetch,WebSearch,Glob,Grep", // WebSearch ADDED vs the read-only assistant
        "--disallowedTools",
        "Bash,Write,Edit,NotebookEdit,Task", // proposer-not-writer, by construction
      ]
    : spec.args(prompt);

  const dataRoot = userDataRoot(session);
  const userEnvFile = path.join(dataRoot, ".env");
  const userEnv: Record<string, string> = {};
  if (fs.existsSync(userEnvFile)) {
    try {
      const content = fs.readFileSync(userEnvFile, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const k = trimmed.slice(0, eq).trim();
          const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
          userEnv[k] = v;
        }
      }
    } catch {
      /* ignore */
    }
  }

  const child = spawn(binPath, args, { cwd: dataRoot, env: { ...process.env, ...userEnv } });

  const encoder = new TextEncoder();
  let closed = false;
  let killer: ReturnType<typeof setTimeout> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let buf = "";
      let emitted = false;
      killer = setTimeout(() => {
        try {
          child.kill("SIGTERM");
        } catch {
          /* ignore */
        }
      }, 480_000);
      const safeClose = () => {
        if (!closed) {
          closed = true;
          if (killer) clearTimeout(killer);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };
      const safeEnqueue = (s: string): boolean => {
        if (closed || !s) return false;
        try {
          controller.enqueue(encoder.encode(s));
          return true;
        } catch {
          closed = true; // controller already closed underneath us — stop, never crash
          return false;
        }
      };
      const emit = (s: string) => {
        if (safeEnqueue(s)) emitted = true;
      };

      child.stdout.on("data", (d: Buffer) => {
        if (closed) return;
        if (!isClaude) {
          emit(d.toString());
          return;
        }
        buf += d.toString();
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.type === "stream_event" && obj.event?.type === "content_block_delta") {
              const text = obj.event.delta?.text;
              if (typeof text === "string") emit(text);
            }
          } catch {
            /* partial / non-json line — skip */
          }
        }
      });
      child.stderr.on("data", (d: Buffer) => {
        const s = d.toString();
        if (/error|not found|denied|fatal/i.test(s)) {
          safeEnqueue(`\n[${spec.name}] ${s.trim()}\n`);
        }
      });
      child.on("error", (e) => {
        safeEnqueue(`\n[error launching ${spec.name}: ${e.message}]`);
        safeClose();
      });
      child.on("close", () => {
        if (!emitted) safeEnqueue("_(no output — is the CLI authenticated?)_");
        safeClose();
      });
    },
    cancel() {
      closed = true;
      if (killer) clearTimeout(killer);
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
