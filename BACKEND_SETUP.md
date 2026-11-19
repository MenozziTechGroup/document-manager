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

## Playbook membership survives a document delete — on purpose

The local and cloud schemas are **not** mirrors of each other, and the difference is
deliberate rather than an oversight:

| | Local SQLite | Supabase |
|---|---|---|
| Table | `group_members` | `playbook_members` |
| Points at a document by | `document_id` → `documents(id)` `ON DELETE CASCADE` | `rel_key` (the vault-relative path) — **no foreign key** |

So `repo.deleteDocument()` clears a document's memberships, while
`cloud.deleteDocument()` deletes only the `documents` row and leaves
`playbook_members` alone. That is not a missing cascade — there is no key to cascade
through. Membership in the cloud is a *path* reference, which means:

- **Re-filing a document restores its playbooks.** Delete a record and let the next
  vault scan re-create it at the same path, and it rejoins every playbook it was in.
  The local path would have thrown that away. This is the behaviour you want on a
  shared team library where records come and go with rescans.
- **Orphans are invisible, not broken.** `getGroupMembers()` resolves each `rel_key`
  against the current documents and drops anything that no longer matches, so a
  playbook never shows a phantom step. The leftover rows just sit there.

Do **not** "fix" this by adding a `document_id` column or a cascade. The one real sharp
edge is resurrection: if a *different* document is later filed at a path a deleted one
used to occupy, it silently inherits the old playbook membership. If a document is
archived to a new path and something else takes its old one, check the playbooks.

## Housekeeping

- The throwaway `test@menozzi.tech` account used during development can be deleted in
  Supabase → Authentication → Users once you're done testing.
- **Orphaned playbook members.** Rows in `playbook_members` whose `rel_key` no longer
  matches a document are harmless (see above) but accumulate. To list them, and only
  then decide whether to clear them:

  ```sql
  select pm.* from playbook_members pm
  left join documents d on d.rel_key = pm.rel_key
  where d.id is null;
  ```
