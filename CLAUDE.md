# DocCenter — Project Brief (for a fresh Claude Code session)

> **Status:** Shipped and in rollout. Published release **v0.1.3** (signed, auto-updating).
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
- `src/data/categories.js` — CATEGORIES (with type codes), DOMAINS, PHASES, AUDIENCES, helpers.
- `src-tauri/src/lib.rs` — Rust: SQLite migrations (currently up to **v8**), and commands:
  `scan_vault` (categorizes by nearest matching ancestor folder), `paths_exist`,
  `write_text_file`/`read_text_file`, `import_into_vault`, `convert_to_pdf` (Word COM via
  PowerShell), `extract_docx_text`, `extract_pdf_text`.

## Features (all built)

Vault scan + paired docx/PDF, Smart Import (+ auto-PDF), Doc IDs + type/domain/audience taxonomy,
review dates + reminders, version notes, source-chat links, favorites/recent, full-text search
(docx + pdf), sort/filter, bulk ops, By Type/Domain/Client browse, Playbooks 2.0 (phases + runnable
runs), Scripts as a type, metadata backup, missing-file relink, audit log, drag-drop, Ctrl+K,
CSV export, shared Supabase backend with per-user login, in-app Help, and auto-update.

## Making changes & releasing (Claude handles git)

- **Verify in the Vite browser preview** for JS/UI (cloud is testable in-browser too via the
  Supabase JS client; test login `test@menozzi.tech` / password in Keeper — delete this account
  before final rollout). Rust commands + migrations need a desktop build to test.
- **Adding a category:** edit `CATEGORIES` in `categories.js` AND the `category_map` in `lib.rs`
  (rebuild). **DB migration:** append to the `migrations` array in `lib.rs` in **ascending version
  order** (next is v9).
- **Release:** bump version in `src-tauri/tauri.conf.json`, `package.json`, `src-tauri/Cargo.toml`,
  and the `app` entry in `src-tauri/Cargo.lock` → commit → `git tag vX.Y.Z` → `git push origin
  vX.Y.Z` → GitHub Actions builds & signs → `gh release edit vX.Y.Z --draft=false` to publish.
  Installed apps then show an Install & Restart banner. See `RELEASING.md`.
- Local unsigned build: `npx tauri build --config "{\"bundle\":{\"createUpdaterArtifacts\":false}}"`.
- **Always quit the tray app before rebuilding** (close-to-tray holds the exe).
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Backend

Supabase project `vuhvqqeywaaeaohplxlk` (URL `https://vuhvqqeywaaeaohplxlk.supabase.co`).
Schema, RLS, auth, and "add a tech" steps in `BACKEND_SETUP.md`. Signing key in `~/.tauri/doccenter.key`
(+ password in Keeper); GitHub repo `MenozziTechGroup/document-manager` holds the signing secrets.

## Rollout status / remaining (Michael's manual steps)

1. Install **v0.1.3** on each machine (last manual install; auto-update after).
2. Create Supabase logins for Michael + 2 techs; delete `test@menozzi.tech`.
3. Each person: sync the SharePoint library → Settings → Vault Folder → point at it → sign in.
4. From the main machine: Settings → Account → "Migrate local library to cloud" once.

## Parked for later (not yet built)

New document types/categories (HR, Agreements, etc.), security/permissions refinements,
offline write cache. Folder reorg: drop the `NN_` prefixes, keep the category keyword in folder
names; nested folders are supported.
