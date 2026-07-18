# Multi-Tenant Support in career-ops

This deployment of career-ops has been configured to support multi-tenancy. Multiple users can share a single server checkout with complete data isolation, maintaining separate CVs, pipeline targets, logs, and API keys.

---

## Architecture Overview

All user-layer files are isolated per-user under:
```
brain/users/<username>/
```

### Isolated User Files

| Path in User Directory | Purpose |
|-------------------------|---------|
| `cv.md` | Your markdown CV |
| `config/profile.yml` | Identity, target roles, comp range |
| `portals.yml` | Your target company watchlists |
| `data/` | Applications tracker and scan histories |
| `reports/` | Generated A–F fit evaluations |
| `output/` | Tailored CV PDFs |
| `modes/_profile.md` | Persona archetypes and voice customization |
| `modes/_custom.md` | House rules for LLM scoring |
| `.env` | Personal API keys (Gemini, OpenRouter, etc.) |

---

## User Management

User accounts can only be managed by someone with ssh/terminal access to the hosting VM (admin-only). All user administration is performed via the interactive CLI:

### 1. Register a New User
```bash
node users/manage.mjs add <username>
```
You will be prompted to enter and confirm a password. The password is hashed using bcrypt with a high work factor (12 rounds) and written to `users/registry.yml`.

### 2. Reset a User's Password
```bash
node users/manage.mjs reset <username>
```
Prompts for a new password and updates the hash in `registry.yml`.

### 3. Delete a User
```bash
node users/manage.mjs delete <username>
```
Removes the user from the registry. Note: This does *not* delete the user's data directory. You can delete `users/<username>/` manually if desired.

### 4. List Registered Users
```bash
node users/manage.mjs list
```
Displays all registered users.

---

## Separate API Keys per User

Each user can maintain separate API keys (such as `GEMINI_API_KEY`, `OPENAI_API_KEY`, etc.) by creating a `.env` file directly inside their user directory:
```
brain/users/<username>/.env
```
When a user runs a scan, evaluation, or PDF generation, their personal `.env` is automatically loaded and merged with the system environment. If no user-specific `.env` is present, the system falls back to the server-wide `.env` in the repository root.

---

## How Single-User Mode Still Works

If you delete `users/registry.yml` or if the file does not exist, the web UI automatically reverts to **Single-User Mode**.
- No login is required.
- All file reads and writes are directed back to the repository root.
- Scans and evaluations run relative to the repo root folder.
- This ensures 100% backward-compatibility for standard local CLI workflows.
