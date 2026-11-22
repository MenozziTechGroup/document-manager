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
- `src-tauri/src/lib.rs` — Rust: SQLite migrations (currently up to **v9**), and commands:
  `scan_vault` (category = the file's **nearest parent folder name**, verbatim; max depth 3),
  `paths_exist`,
  `write_text_file`/`read_text_file`, `import_into_vault`, `convert_to_pdf` (Word COM via
  PowerShell), `extract_docx_text`, `extract_pdf_text`, `read_docx_props` (DocBuilder custom
  properties DocID/DocVersion/DocStatus + core title).
- `src/data/registry.js` — Doc ID Registry (Supabase, cloud-only): load, import from
  `IDX-IT-001_Registry.json`, `allocate_doc_id` RPC, retire/release, export in the same JSON shape.
  `src/data/docIds.js` — pure Doc ID rules (format, filename convention, `validateDocument`).
  `src/components/RegistryView.jsx` — the Registry page. **DocCenter is the registry's master copy**;
  the IDX-IT-001 DocBuilder script should build from DocCenter's export.
- `src/data/fileMeta.js` — pure parsing of file-sourced metadata (properties → cover table /
  script header → filename) and the rules for applying it (`fileMetaChanges`).

## Features (all built)

Vault scan + paired docx/PDF, dynamic folder-based categories (v0.1.9), new-documents metadata
review after a scan (v0.1.10), Smart Import (+ auto-PDF), Doc IDs + type/domain/audience taxonomy
Doc ID / version / effective date / status **read from the files on every scan** (v0.1.12; file
wins, never rolls back to an older version, archived stays archived; "Suggest" = highest existing
number + 1 until the registry lands),
review dates + reminders, version notes, source-chat links, favorites/recent, full-text search
(docx + pdf), sort/filter, bulk ops, By Type/Domain/Client browse, Playbooks 2.0 (phases + runnable
runs), Scripts as a type, metadata backup, missing-file relink, audit log, drag-drop, Ctrl+K,
CSV export, shared Supabase backend with per-user login, in-app Help, and auto-update.

## Making changes & releasing (Claude handles git)

- **Verify in the Vite browser preview** for JS/UI (cloud is testable in-browser too via the
  Supabase JS client; sign in with the development account named in `OPERATIONS.local.md`,
  which should be deleted before final rollout). Rust commands + migrations need a desktop
  build to test.
- **Categories are folder names, not a list.** Since v0.1.9 `scan_vault` derives a document's
  category from its **nearest parent folder** (verbatim, max depth 3), so any folder you add
  becomes a category with no code change (there is no longer a `category_map` in `lib.rs`). The
  sidebar lists only categories that have at least one document, so an empty folder shows nothing.
  Adding an entry to `CATEGORIES` in `categories.js` is optional — it gives that folder a colour
  and type code instead of the neutral grey fallback in `getCategoryInfo()`. **Adding a domain:**
  edit `DOMAINS` in `categories.js`.
- **DB migration:** append to the `migrations` array in `lib.rs` in **ascending version
  order** (next is v10).
- **Release:** bump version in `src-tauri/tauri.conf.json`, `package.json`, `src-tauri/Cargo.toml`,
  and the `app` entry in `src-tauri/Cargo.lock` → commit → **merge to `main`** (the workflow
  fires on any `v*` tag, so tagging an unmerged branch ships a release `main` never sees) →
  `git tag vX.Y.Z` → `git push origin
  vX.Y.Z` → GitHub Actions builds & signs → `gh release edit vX.Y.Z --draft=false` to publish.
  Installed apps then show an Install & Restart banner. See `RELEASING.md`.
- Local unsigned build: `npx tauri build --config "{\"bundle\":{\"createUpdaterArtifacts\":false}}"`.
- **Always quit the tray app before rebuilding** (close-to-tray holds the exe).
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Name the model that actually wrote the commit; update this line when the model changes.

## Backend

Supabase project URL and anon key are in `src/data/supabase.js` - public by design for a
desktop client. RLS, auth, and "add a tech" steps in `BACKEND_SETUP.md`. **Schema changes go in
`supabase/migrations/*.sql`** and must be run in the Supabase SQL editor *before* shipping a
release that uses them (the app writes every column on save, so a missing column breaks saves).
Tables: `documents` (unique on `rel_key`), `playbooks`, `playbook_members`, `runs`, `run_items`
(all of these reference docs by `rel_key`), `tags`, `audit_log`.

**This repo is public.** Account names, secret locations and rollout state live in
`OPERATIONS.local.md` beside this checkout (gitignored), not here. Releases are signed by
a key held in GitHub Actions secrets; that file says where the local copy lives.

## Rollout status / remaining (Michael's manual steps — written at v0.1.3, confirm what's done)

1. Install **v0.1.3** on each machine (last manual install; auto-update after).
2. Create Supabase logins for Michael + 2 techs; delete the development account (see `OPERATIONS.local.md`).
3. Each person: sync the SharePoint library → Settings → Vault Folder → point at it → sign in.
4. From the main machine: Settings → Account → "Migrate local library to cloud" once.

## In progress

**Doc ID Registry** — v0.1.13 shipped the tables, import, Registry page, validation, Reserve next,
Supersede → retire, and JSON export; v0.1.14 adds the Health tab (`src/data/health.js`) and the Excel
workbook (`src/data/excelExport.js`, exceljs loaded on demand, saved via `write_binary_file`). Next:
switch the IDX-IT-001 DocBuilder script to read DocCenter's export instead of its hardcoded lists,
then add a unique constraint on `documents.doc_id` once the duplicates are cleaned up.
Registry status vocabulary: Reserved, Draft (in the library, still in development — never auto-flipped),
Filed, Outside, Unlocated, Tool, Retired.
Doc ID format is `TYPE-DOMAIN-NNN`; filenames are `[DOC-ID]_[Title_With_Underscores].docx`
(optionally `_vN.N`; script titles may use hyphens). Retired IDs are never reused.

## Parked for later (not yet built)

More document types (Agreements, etc.), security/permissions refinements,
offline write cache. Folder reorg: drop the `NN_` prefixes, keep the category keyword in folder
names; nested folders are supported.
