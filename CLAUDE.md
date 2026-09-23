# DocCenter — Project Brief (for a fresh Claude Code session)

> **Status:** Shipped and in rollout. Published release **v0.1.11** (signed, auto-updating).
> This file orients a new session. Companion docs: `STACK.md`, `BACKEND_SETUP.md`,
> `RELEASING.md`, `DOCCENTER_FOR_AUTHORING.md`. Read those for detail.

## What it is

**DocCenter** — a Tauri 2 + React desktop app (Windows) for Menozzi IT Solutions to
manage MITS documents (Runbooks, SOPs, Checklists, Client Guides, Scripts, Letters,
Reference, Policies). Single product, shared by Michael + two techs.

Internal name/identifier stays `tech.menozzi.docmanager` and the DB file is
`docmanager.db` — **do not rename these** (they'd orphan data). Display name is "DocCenter".

## Architecture (the key mental model)

- **Files** live in **SharePoint**, synced locally on each machine (the "vault"). DocCenter
  never stores files — it reads/opens from the local synced folder.
- **Shared metadata** (documents' metadata, playbooks, runs, tags, audit log) lives in
  **Supabase** (Postgres + auth + realtime + RLS). This is the source of truth for the team.
- **Document identity = vault-relative path** (`rel_key`, e.g. `Runbooks/Server`). Each
  machine's absolute path differs; the app prepends its own vault root. This is why the cloud
  stores relative paths, not absolute ones.
- **Local SQLite / localStorage** is the offline/browser fallback. The app is online-first when
  signed in.

## Code map

- `src/data/repo.js` — the data API the whole app calls. Each shared function **delegates to
  `cloud.js` when signed in** (`if (useCloud()) return cloud.X(...)`), else uses local SQLite
  (Tauri) / localStorage (browser).
- `src/data/cloud.js` — Supabase implementation of all shared data ops + rel-path mapping
  (`setVaultRoot`, `relativize`/`absolutize`). Realtime via `subscribeChanges`.
- `src/data/supabase.js` — client, auth, `useCloud()`, `currentEmail()`. **Anon key is public**;
  RLS + login protect the data.
- `src/data/updater.js` — launch update check + install.
- `src/App.jsx` — orchestration: auth gate, data load (waits for session + sets vault root first),
  views, realtime refresh, update banner, all handlers.
- `src/components/*` — Dashboard, DocumentList/Card, PreviewPane, DocumentModal, PlaybooksView,
  PlaybookRunView, StartRunModal, SupersedeModal, PdfPreviewModal, SettingsPanel, HelpView,
  Login, Sidebar, Onboarding, GroupModal, AddToGroupModal.
- `src/data/categories.js` — CATEGORIES (display color + type code for *known* folder names),
  DOMAINS (incl. `HR`), PHASES, AUDIENCES, helpers. `getCategoryInfo()` gives unknown folders a
  neutral default with **no type code**.
- `src-tauri/src/lib.rs` — Rust: SQLite migrations (currently up to **v8**), and commands:
  `scan_vault` (category = the file's **nearest parent folder name**, verbatim; max depth 3),
  `paths_exist`,
  `write_text_file`/`read_text_file`, `import_into_vault`, `convert_to_pdf` (Word COM via
  PowerShell), `extract_docx_text`, `extract_pdf_text`.

## Features (all built)

Vault scan + paired docx/PDF, dynamic folder-based categories (v0.1.9), new-documents metadata
review after a scan (v0.1.10), Smart Import (+ auto-PDF), Doc IDs + type/domain/audience taxonomy
(Doc ID is free text today; "Suggest" = highest existing number + 1),
review dates + reminders, version notes, source-chat links, favorites/recent, full-text search
(docx + pdf), sort/filter, bulk ops, By Type/Domain/Client browse, Playbooks 2.0 (phases + runnable
runs), Scripts as a type, metadata backup, missing-file relink, audit log, drag-drop, Ctrl+K,
CSV export, shared Supabase backend with per-user login, in-app Help, and auto-update.

## Making changes & releasing (Claude handles git)

- **Verify in the Vite browser preview** for JS/UI (cloud is testable in-browser too via the
  Supabase JS client; test login `test@menozzi.tech` / password in Keeper — delete this account
  before final rollout). Rust commands + migrations need a desktop build to test.
- **Adding a category:** just create the folder in the vault — any folder becomes a category on
  the next scan. Add an entry to `CATEGORIES` in `categories.js` only to give it a color and type
  code (no Rust change; `category_map` no longer exists). **Adding a domain:** edit `DOMAINS` in
  `categories.js`. **DB migration:** append to the `migrations` array in `lib.rs` in **ascending version
  order** (next is v9).
- **Release:** bump version in `src-tauri/tauri.conf.json`, `package.json`, `src-tauri/Cargo.toml`,
  and the `app` entry in `src-tauri/Cargo.lock` → commit → `git tag vX.Y.Z` → `git push origin
  vX.Y.Z` → GitHub Actions builds & signs → `gh release edit vX.Y.Z --draft=false` to publish.
  Installed apps then show an Install & Restart banner. See `RELEASING.md`.
- Local unsigned build: `npx tauri build --config "{\"bundle\":{\"createUpdaterArtifacts\":false}}"`.
- **Always quit the tray app before rebuilding** (close-to-tray holds the exe).
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Backend

Supabase project `vuhvqqeywaaeaohplxlk` (URL `https://vuhvqqeywaaeaohplxlk.supabase.co`).
RLS, auth, and "add a tech" steps are in `BACKEND_SETUP.md`. **The Supabase table DDL is not in the
repo**; it only exists in the Supabase dashboard. Tables: `documents` (unique on `rel_key`),
`playbooks`, `playbook_members`, `runs`, `run_items` (all of these reference docs by `rel_key`),
`tags`, `audit_log`. Signing key in `~/.tauri/doccenter.key`
(+ password in Keeper); GitHub repo `MenozziTechGroup/document-manager` holds the signing secrets.

## Rollout status / remaining (Michael's manual steps — written at v0.1.3, confirm what's done)

1. Install **v0.1.3** on each machine (last manual install; auto-update after).
2. Create Supabase logins for Michael + 2 techs; delete `test@menozzi.tech`.
3. Each person: sync the SharePoint library → Settings → Vault Folder → point at it → sign in.
4. From the main machine: Settings → Account → "Migrate local library to cloud" once.

## In design (not yet built)

**Doc ID Registry.** Move the IDX-IT-001 registry (type codes, domain codes, retired IDs, next
number) into Supabase, then use it to: validate on Add, suggest the next ID with retired IDs
counted, report registry-vs-SharePoint mismatches, and export the inventory and registry to Excel.
Doc ID format is `TYPE-DOMAIN-NNN`; filenames are `[DOC-ID]_[Title_With_Underscores].docx`
(optionally `_vN.N`). Retired IDs are never reused.

## Parked for later (not yet built)

More document types (Agreements, etc.), security/permissions refinements,
offline write cache. Folder reorg: drop the `NN_` prefixes, keep the category keyword in folder
names; nested folders are supported.
