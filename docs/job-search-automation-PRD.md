# PRD v4: career-ops Automation — Detailed Build Steps

**Owner:** You
**Status:** Draft v4 — same 3-phase scope as v3, now expanded into ordered, executable steps
**Environment locked in:** macOS · Antigravity CLI (`agy`) as primary/fallback agent · notification channel implementation deferred (built pluggable, wired later)
**Last updated:** July 16, 2026

**How to use this doc:** Each phase is a numbered, ordered checklist. Steps within a phase must be done in order — later steps assume earlier ones are complete. Each phase ends with a gate ("do not proceed until…") so an agent working through this doesn't skip ahead on a half-working foundation.

---

## Phase 0 — Prerequisites (do once, before Phase 1)

- [ ] **Node.js 20+** installed (career-ops's Gemini CLI integration needs 20+, even though the base tool only requires 18+). Check: `node -v`. Install via `brew install node` if missing (Homebrew required — install from brew.sh first if you don't have it).
- [ ] **git** installed. Check: `git -v`.
- [ ] **Google AI Studio account + Gemini API key.** Go to `aistudio.google.com`, create a free API key. Save it somewhere temporarily (password manager) — you'll put it in `.env` in Phase 1, never in git.
- [ ] **Antigravity CLI (`agy`)** installed and authenticated on this machine. Confirm with a trivial command before proceeding — Phase 1's onboarding step depends on this working.
- [ ] Decide now (don't skip this): **is this Mac reliably powered on and awake around your intended daily run time** (e.g. 8am)? This determines a Phase 2 detail. If it's a laptop that's often closed/asleep, note that now — macOS `launchd` (used in Phase 2) will run a missed job at next wake, but only if the machine wakes up at all that day.

**Gate:** `node -v` shows 20+, `git -v` works, you have a Gemini API key saved, and `agy` runs.

---

## Phase 1 — Local Setup, Pipeline, View-Only Dashboard

### 1.1 Clone and install
```bash
mkdir -p ~/dev && cd ~/dev
git clone https://github.com/santifer/career-ops.git
cd career-ops
npm install
npx playwright install chromium   # needed for PDF rendering later
```

### 1.2 Confirm `.gitignore` covers your personal data before adding anything
```bash
cat .gitignore | grep -E "cv.md|\.env|data/"
```
career-ops ships with these gitignored by default — confirm, don't assume. If any are missing, add them now, before Step 1.3 puts real personal data in the repo.

### 1.3 Run first-launch onboarding via Antigravity CLI
```bash
agy
```
Inside the session, run the interactive onboarding (career-ops's newer versions expose this as an "interview" mode — ask it to walk you through onboarding if it doesn't start automatically). Answer with your real data:
- CV content → written to `cv.md`
- Target roles, salary expectations, locations → written to `config/profile.yml`

While still in this session, also build `article-digest.md` with real proof points/STAR stories if career-ops's onboarding offers it — this is what keeps AI-tailored bullets grounded in things you actually did.

**Decision point — multiple role types:** you mentioned wanting to cover "a variety of roles." career-ops auto-detects archetype (LLMOps / Agentic / PM / SA / FDE / Transformation) per job description from a single `cv.md`, so try that first rather than maintaining separate CVs per role. Only fork into multiple profiles if the single-CV auto-detection produces noticeably worse tailoring for one of your target role types once you're testing in Step 1.6.

### 1.4 Add your Gemini API key
```bash
cd ~/dev/career-ops
touch .env
echo "GEMINI_API_KEY=your_key_here" >> .env
```
Confirm `.env` is in `.gitignore` (Step 1.2) before this step, not after.

### 1.5 Standalone test of the free-tier evaluation script
```bash
node gemini-eval.mjs --file path/to/a/sample_job_description.txt
```
(Grab any real JD you have handy — paste it into a `.txt` file for this test.) Confirm it runs, calls the Gemini API successfully, and produces output — this validates the API key and the token-saving path before anything else depends on it.

**Gate:** Steps 1.3–1.5 done, `gemini-eval.mjs` produces a real evaluation against a real JD.

### 1.6 Configure the scanner
```bash
cp templates/portals.example.yml config/portals.yml   # path may differ slightly — check templates/ if this fails
```
Edit `config/portals.yml`:
- Prune the 45+ pre-configured companies down to your actual target list, or extend it.
- Add search queries/keywords covering each of your target role types.

Run a manual scan:
```bash
node scan.mjs --verify
```
Check `scan-history.tsv` — confirm real, current listings came back, and run it a second time to confirm dedup works (second run should add ~0 new entries if nothing changed).

**Gate:** a real scan against your real target list returns clean, deduped listings.

### 1.7 Run the eval → tailor pipeline against real scan output
For each new listing from 1.6, either loop `gemini-eval.mjs` manually or use career-ops's batch mode if the version you have supports it (`modes/batch.md` — ask Antigravity CLI to run "career-ops batch mode" against your scanned listings).

Check that this produces, per listing:
- An evaluation report (A–F score, gaps, comp research)
- A tailored, ATS-optimized PDF
- A row in the tracker (`data/pipeline.md` / `.tsv`)

**Decide and document your output naming convention now** if the default doesn't already give you something sane, e.g.:
```
output/<company>/<role-slug>-<YYYY-MM-DD>.pdf
```
Retrofitting a naming convention after 50 files exist is worse than deciding it now.

### 1.8 Quality check before trusting the pipeline
Spot-check 5–10 of the tailored PDFs against their source JDs. You're checking for: does it invent experience not in `cv.md`? Are the reordered bullets actually more relevant, or just reshuffled? Is the ATS formatting intact?

**Keep a fixed "known good" test set:** save 3–5 real JDs you already checked as a small folder (e.g. `test-jds/`). Every time you touch `cv.md`, the prompt, or the template later, rerun these 3–5 and diff the output — this is how you catch a regression instead of discovering it three weeks later on a real application.

**Gate:** a batch of ~10 real listings produces 10 correctly named, correctly tailored, factually-grounded PDFs, with no manual cleanup step needed.

### 1.9 View-only dashboard
Try career-ops's built-in options first, in this order:
1. **Terminal dashboard:** `npm run serve:dashboard`. If this requires a Go binary/toolchain career-ops doesn't bundle, check its docs for a `go install` step or a prebuilt binary release — don't assume Go is preinstalled on macOS.
2. **2.0 web UI (RC as of this writing):**
   ```bash
   git clone --branch 2.0.0-rc.1 https://github.com/santifer/career-ops.git career-ops-web
   cd career-ops-web/web && npm install && npm run dev
   ```
   Point it at the same `data/` your CLI pipeline is writing to. Note it's a release candidate — check it doesn't error out on your data before relying on it.

Evaluate both against what you actually need: see every scanned job, its score, tailoring status, and an open-able link to its PDF, with zero write actions exposed (writes are explicitly deferred to Phase 3).

**Only build a custom dashboard if both built-in options are missing something you need.** If you do: a static page that reads `data/pipeline.md`/`.tsv` and links to the PDF folder is enough — no backend, no auth, nothing dynamic yet.

**Gate — Phase 1 complete when:** you can, without opening a terminal, see every job career-ops has scanned, its score, and open its tailored PDF. Everything up to and including tailoring runs correctly by manual trigger.

---

## Phase 2 — Scheduled Discovery + Notifications

Do not start Phase 2 until Phase 1's gate is met — the orchestrator below assumes every step it calls already works manually.

### 2.1 Write the orchestrator (`run-daily.mjs`)
New file, at the repo root. Logic, in order:
1. Run `scan.mjs --verify`, capture new (deduped) listings.
2. If zero new listings: log that, prepare a "nothing new today" summary, skip to step 6.
3. For each new listing: call `gemini-eval.mjs` (as in Phase 1.7).
4. On success: nothing further — career-ops's own pipeline already wrote the report/PDF/tracker row.
5. On failure (non-2xx or thrown error from the Gemini call): call `node agent-inbox.mjs add "Evaluate <company> — <role>: <url>"` — this queues it for your next interactive `agy` session, rather than retrying the API call unattended. **Do not implement a second automated fallback call** — Antigravity CLI needs an interactive/authenticated session, it's not meant to be invoked headlessly from cron.
6. Build a run summary object: `{date, new_listings, tailored_ok, queued_for_cli, errors}`.
7. Call a `notify(summary)` function (see 2.3) — implement this as a **pluggable interface now, with a single "log to console/file" adapter wired in for this phase.** Actual email/WhatsApp wiring is a decision you're deferring — build the seam so adding a channel later is a config change, not a rewrite.

### 2.2 Test manually before scheduling anything
```bash
cd ~/dev/career-ops
node run-daily.mjs
```
Run this a few times on different days with real data. Confirm the summary object is accurate and the `agent-inbox.mjs` fallback actually fires — deliberately break something (e.g. temporarily rename `.env`'s key) once to confirm the failure path queues correctly instead of crashing the whole run.

**Gate:** `run-daily.mjs` runs cleanly end-to-end, and its failure path has been tested at least once, not just assumed to work.

### 2.3 Notification interface (build now, wire a channel later)
Define one function, e.g. in `notify.mjs`:
```js
export async function notify(summary) {
  // adapter-based: read an env var (NOTIFY_CHANNEL=console|email|whatsapp)
  // and dispatch accordingly. Only "console" needs to work for Phase 2 to be done.
}
```
Implement the `console`/log-file adapter now. Leave `email` and `whatsapp` as stubs with a clear TODO — when you're ready to pick one (or both), it's a self-contained addition:
- **Email** would use Gmail (SMTP with an app password via `nodemailer` is simpler to set up than full OAuth for a single daily send).
- **WhatsApp** would use CallMeBot (free, single-recipient, personal-use — requires a one-time opt-in message to their bot number to get an API key).

Both are still valid choices from v3's research — deferring which one just means this phase doesn't block on that decision.

### 2.4 Logging
```bash
mkdir -p logs
```
`run-daily.mjs` should append a dated entry to `logs/daily.log` every run, success or failure — this is your only visibility until a real notification channel is wired in.

### 2.5 Schedule with `launchd` (macOS-native — do not use plain cron here)
macOS handles background scheduling better via `launchd` than crontab, particularly around sleep/wake behavior. Create `~/Library/LaunchAgents/com.userops.careerops.daily.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.userops.careerops.daily</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/YOUR_USERNAME/dev/career-ops/run-daily.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/YOUR_USERNAME/dev/career-ops</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>8</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>/Users/YOUR_USERNAME/dev/career-ops/logs/launchd-out.log</string>
  <key>StandardErrorPath</key><string>/Users/YOUR_USERNAME/dev/career-ops/logs/launchd-err.log</string>
</dict>
</plist>
```
Adjust the `node` path (`which node`) and username. Load it:
```bash
launchctl load ~/Library/LaunchAgents/com.userops.careerops.daily.plist
```
**Known macOS caveat:** if the Mac is asleep at 8:00am, `launchd` runs the job at next wake, not exactly on schedule — it does not skip the day, but it won't be punctual either. If your machine is a laptop that's regularly closed at that hour, decide now whether that's acceptable or whether the trigger time should move to whenever you typically open the laptop.

### 2.6 Run-health notification, not just job-discovery notification
Make sure `notify()` fires on **both** "new jobs found" and "run failed entirely" (e.g. `scan.mjs` itself errored) — not only on the happy path. A silent cron failure and "no jobs today" should never look identical in your logs, or you'll stop trusting the automation within a couple of weeks.

**Gate — Phase 2 complete when:** the pipeline has run unattended, on schedule, for several real days in a row, with `logs/daily.log` showing accurate summaries including at least one exercised failure/fallback path.

---

## Phase 3 — GUI Layer Over the CLI

Do not start Phase 3 until Phase 2 has run unattended successfully for at least a week — a GUI on top of an unproven pipeline just adds a second thing to debug at once.

### 3.1 Evaluate the built-in 2.0 web UI before building anything new
You already stood this up read-only in Phase 1.9. Now check specifically: does it (or can it be extended to) support triggering actions, not just viewing? If yes, **extending it is very likely less work than a fresh build** — check this before writing a single line of new backend code.

### 3.2 Scope decision
- **If extending the built-in web UI:** skip to 3.4, working within its existing structure.
- **If building fresh:** minimal stack — a small Node/Express backend (it already has Node/child_process available, matching the rest of the repo) that shells out to the same CLI commands you've been running manually, plus a lightweight frontend. Don't reach for a heavier framework than the task needs.

### 3.3 Auth (only if building fresh; skip if 2.0 UI already handles this)
- Bind to `127.0.0.1` only, no network exposure, as the default.
- Add a single shared password/session **only if** you plan remote access (e.g. via Tailscale) — decide this now rather than defaulting to "expose it and add auth later," which is backwards for something holding an API key.

### 3.4 Settings UI
- Form-based editing of `config/portals.yml` (companies/roles/queries) and `config/profile.yml` (salary, locations) instead of hand-editing YAML.
- API key management (Gemini key, and a fallback provider key if you ever add one) through the UI instead of `.env` editing. Keep it plaintext-in-`.env` while strictly localhost-only; only add encryption-at-rest if this ever becomes remotely accessible.
- Notification channel/schedule toggle — this is where Phase 2's deferred `email`/`whatsapp` decision actually gets made and wired into the `notify.mjs` adapter stubs from Step 2.3.

### 3.5 Action triggers
- **Re-tailor** a specific listing → calls `gemini-eval.mjs` again for that listing (useful after you edit `cv.md`).
- **Paste a JD/URL** → runs the same on-demand pipeline you already trigger manually via `agy` (e.g. "Evaluate this JD with career-ops auto-pipeline: `<url>`") — the GUI is just a friendlier input box for a command you already run.
- **Apply-assist** → triggers career-ops's existing `/career-ops apply` (Playwright opens the form, fills it, you review and click submit yourself in that browser window). **The GUI must never submit on your behalf** — same rule as every other phase in this project.
- Background job status shown live (polling is fine; a websocket is a nice-to-have, not required).

### 3.6 Inbox/failure visibility
- Read `agent-inbox.mjs`'s queue and surface the actual error per item, not just "queued" — this is what makes Phase 2's fallback path actually useful day to day instead of an opaque backlog.

**Explicit non-goals for Phase 3:** no multi-user support, no cloud hosting, no network exposure beyond your own machine unless you deliberately set up remote access yourself.

**Gate — Phase 3 complete when:** you can add a JD, trigger tailoring, and trigger apply-assist entirely from the browser, with the CLI still the tool of record underneath, and no new submission behavior anywhere in the system.

---

## Open items still deferred by design (not blockers, revisit when relevant)

- Which notification channel(s) to actually wire in (Phase 2, Step 2.3 stubs).
- Whether a single `cv.md` archetype-detection is sufficient for all your target role types, or whether you need multiple profiles (Phase 1, Step 1.3 decision point — revisit once you have real tailoring output to judge).
- Whether the built-in 2.0 web UI is stable/capable enough to extend rather than replace (Phase 3, Step 3.1 — genuinely can't be answered until you're at that point and test it).
