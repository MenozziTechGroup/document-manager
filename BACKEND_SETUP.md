# DocCenter — Shared Backend (Supabase)

DocCenter stores **documents in SharePoint** (synced locally on each machine) and the
**shared metadata layer in Supabase** — so all techs see one library and can run
playbooks together. Files never leave SharePoint; only metadata, playbooks, runs,
tags, and the audit log live in the cloud.

## Project

- **Supabase project:** `vuhvqqeywaaeaohplxlk`
- **URL:** `https://vuhvqqeywaaeaohplxlk.supabase.co`
- **Anon key:** embedded in `src/data/supabase.js`. This key is **public by design** —
  it grants nothing on its own. Access is gated by per-user login + row-level security.
- The **service_role key is secret** — never embed or commit it.
- DB password + any service keys belong in **Keeper**.

## How data is shared (and what stays local)

| Shared (Supabase) | Local per machine |
|---|---|
| Document metadata (tags, description, review date, version notes, Doc ID, domain, audience, status, client, favorite) | Vault folder path |
| Playbooks + phased document manifests | SharePoint URL, "Your Name" |
| Playbook runs + per-step checkmarks | "Recently opened" list |
| Tag library, audit log | Full-text search index (each machine indexes its own files) |

Documents are identified by their **vault-relative path** (e.g. `Runbooks/Server.docx`),
so the same record works on every machine regardless of its OneDrive sync root. Each app
prepends its own vault path to open the local file.

## Auth & security

- **Per-user login** (email + password) via Supabase Auth.
- **Row-level security** is ON for every table, with a policy granting any *signed-in*
  user full access (shared team library). Unauthenticated requests get nothing.
- Public sign-ups are **disabled** — only an admin adds users.

### Adding a tech (the final step)

1. Supabase → **Authentication → Users → Add user**
2. Enter their email + a temporary password, check **Auto Confirm User**
3. Tell them to install DocCenter, sign in, set their **vault path** and **name** in
   Settings — they'll immediately see the shared library.

To remove someone: delete their user in the same screen.

## First-run migration (per machine)

If a machine already has a local DocCenter library, push it to the cloud once:

- **Settings → Account → "Migrate local library to cloud"**

This uploads that machine's documents, metadata, playbooks, and tags. It's **idempotent**
(safe to run more than once — existing cloud records are updated, not duplicated). After
the first machine migrates, others just **Sync Vault** to attach their local file paths to
the already-shared metadata.

## Realtime

Runs, run items, documents, and playbooks are published to Supabase Realtime, so a change
one tech makes (e.g. checking off a playbook step) refreshes for the others automatically.

## Backups

- Supabase manages automatic Postgres backups (see Project → Database → Backups).
- **Settings → Back Up Now** still exports a JSON snapshot of the metadata into the vault
  folder as an extra, portable backup.

## Building / releasing

- Local verification build (no signing key needed):
  `npx tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'`
- Signed, auto-updating releases come from the GitHub Actions pipeline (`.github/workflows/release.yml`),
  which holds the signing key as a secret. (Repo + pipeline = the remaining milestone.)

## Housekeeping

- The throwaway `test@menozzi.tech` account used during development can be deleted in
  Supabase → Authentication → Users once you're done testing.
