# Build Prompt: Multi-Tenant Support for career-ops

Copy everything below into Claude Opus 4.6 (Claude Code recommended, since this needs repo read/write access).

---

## Context

I run [career-ops](https://github.com/santifer/career-ops), an open-source local job-search automation tool (Node.js + an AI coding CLI, e.g. Claude Code/Antigravity, for evaluation/tailoring; Playwright for PDF generation and form-fill). It's currently designed as a **single-user, single-machine tool**: one `cv.md`, one `config/profile.yml`, one `data/` folder, one `.env`, all at the repo root.

I'm deploying this to a small VM (Oracle Cloud) reachable only over a private Tailscale network — **not the public internet**. I want exactly two known people to be able to use it, each with their own isolated data (CV, profile, target companies, scan history, reports, tailored resumes), through a shared web UI login. This is not a public product — no signup flow, no email verification, no password reset via email, no billing. Just two pre-provisioned accounts that don't see each other's data.

## Objective

Add minimal, correct multi-tenant support: per-user data isolation + simple session-based login, without over-building infrastructure for a public user base that doesn't exist.

## Before you write any code: investigate first

The exact internal structure isn't fully documented to me — don't assume file layout. Before implementing anything:
1. Read `DATA_CONTRACT.md`, `AGENTS.md`, and `doctor.mjs` at the repo root — these define the current "system layer vs. user layer" split and what counts as user data.
2. Read the web UI code (likely under `web/`) to understand how it currently reads `cv.md`/`config/`/`data/` — does it hardcode repo-root-relative paths, or is there already a config layer to hook into?
3. Identify every script/module that reads or writes user data directly (scan, eval, tailor, tracker, apply-assist, dashboard) — multi-tenancy is only correct if **all** of these are scoped, not just the ones I happen to think of.
4. Report back a short plan (which files need changes, what the risk points are) before implementing, so I can sanity-check the approach before you touch data-handling code.

## Requirements

**1. Per-user directory structure**
Restructure user data (not system/logic code) into isolated per-user directories, e.g.:
```
users/
  <username>/
    cv.md
    config/profile.yml
    config/portals.yml
    data/            (tracker, scan-history.tsv, etc.)
    reports/
    output/          (tailored PDFs)
    .env             (their own Gemini API key, kept out of git)
```
Exact naming can follow whatever convention best matches the existing `DATA_CONTRACT.md` split — don't fight the existing system/user layer design, extend it.

**2. Migration**
Write a one-time migration script that moves my existing root-level `cv.md`, `config/`, `data/`, `.env`, `reports/`, `output/` into `users/<my-username>/` without data loss. I'll run this once by hand.

**3. Simple auth (not a public auth system)**
- A small, fixed list of users defined in config (e.g. `users/registry.yml` or similar) — not open signup.
- Passwords stored properly hashed (bcrypt or argon2, not plaintext, not reversibly encrypted) even though this sits behind Tailscale — defense in depth, not decoration.
- Session-based login (secure, httpOnly cookie), not JWT-in-localStorage.
- No password reset flow, no email verification, no OAuth — I'll manually reset a password in config if needed. Explicitly do not build these; they're solving a problem I don't have.

**4. Request-scoping**
Every existing web UI action (scan trigger, eval/tailor trigger, dashboard/tracker view, apply-assist trigger) must resolve to the logged-in user's directory, never the repo root and never another user's directory. This is the actual core requirement — get this precisely right, since a bug here means one person's resume data leaking into the other's session.

**5. CLI behavior unchanged for local/single-user use**
If someone runs the AI CLI directly in the repo root (not through the hosted web UI), it should still work exactly as it does today for a single local user — don't break the existing local workflow while adding the hosted multi-tenant path.

## Non-goals (explicitly do not build)
- Public signup/registration
- Email verification or password-reset-via-email
- OAuth/SSO
- Billing/subscriptions
- An admin UI beyond editing the user list in config
- Rate limiting or abuse protection (two known users, private network — not needed yet)

## Acceptance criteria
- [ ] Two users can log in with separate credentials and see only their own scanned jobs, tailored resumes, and tracker.
- [ ] A deliberate test: log in as user A, trigger a scan/eval, confirm nothing appears in user B's directory or session.
- [ ] Existing single-user CLI workflow (no login, run in repo root) still functions unmodified.
- [ ] Passwords are hashed at rest; inspect the stored file yourself to confirm no plaintext.
- [ ] Migration script successfully moves existing root-level data into the first user's directory with nothing lost.
- [ ] A short README note added explaining the new directory structure and how to add a second/third user manually.

## Deliverables
1. The investigation summary/plan (before code).
2. The implementation.
3. The migration script, run against my actual data with me watching, not assumed to work.
4. A note on anything from `DATA_CONTRACT.md`/`AGENTS.md` that this change had to deviate from, and why.