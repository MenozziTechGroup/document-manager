# Document Manager — Project Brief

> **Status:** Not started. This file orients a fresh Claude Code session.
> **First action for the new session:** read this, then ask the kickoff
> questions in "Requirements to confirm" below before writing any code.

## Goal

Build an interface for **managing MITS documents**. Exact scope is still to be
defined with Michael — see the open questions below. The likely shape is a
desktop app to browse, search, tag/organize, preview, and possibly generate
documents.

## Who it's for

Michael Menozzi / Menozzi IT Solutions (MITS). Today this is expected to be
**single-user / local-first** (like the sister project), but confirm whether
the team needs shared access — that changes the architecture significantly.

## Proven approach to reuse (from the sister project)

The **Subscription_Tracker** app (sibling folder: `../Subscription_Tracker`,
GitHub: `MenozziTechGroup/subscription-tracker`) was built successfully with a
stack and set of patterns that worked very well and should be the default
starting point here unless requirements say otherwise:

- **Stack:** Tauri 2.x (Rust shell) + React + Vite + Tailwind v4, with
  **SQLite** via `tauri-plugin-sql` for storage.
- **Dual-mode data layer:** a `repo.js`/`db.js` abstraction that uses SQLite in
  the desktop app but falls back to `localStorage` in a plain browser — so the
  fast browser-preview workflow stays usable during development. Reuse this
  pattern.
- **Versioned SQLite migrations** defined in `src-tauri/src/lib.rs`.
- **MITS branding:** primary red `#e1251b`; grays `#97989a` / `#b1b1b1`;
  charcoal `#3a3a3a`; white/black. App background `#e1eae9` (cool slate).
  Logo/icon assets live under
  `…/07_Branding_Assets/` — the app icon source used was
  `Logos/02_Menozzi_IT_Solutions_Logos/03_Altered_Icon_Files/MITS-Logo-only.png`
  (puzzle-piece logomark; pad to square, then `npx tauri icon <png>`).
- **Desktop polish that's already solved there (copy the patterns):** system
  tray + close-to-tray, native notifications, autostart, and a **signed
  auto-update pipeline** via GitHub Releases + GitHub Actions
  (`.github/workflows/release.yml`, updater signing key in `~/.tauri/`). See
  that repo's `RELEASING.md` for the release recipe.
- **Verification workflow that worked:** iterate against the Vite browser
  preview (screenshots) for UI, then validate the real desktop build.

## Requirements to confirm (ask Michael first)

1. **Core function:** browse/search files? metadata + tagging/organization?
   generate documents from templates? version control? preview/annotate?
   A mix? What's the #1 job it must do well?
2. **Where do the documents live?** local folders, SharePoint/OneDrive
   (MITS uses these), a database, a mix?
3. **Single-user or team/shared?** (local-first vs. cloud backend like Supabase)
4. **Platform:** same Tauri desktop app, a web app, or integrate with existing
   MITS systems?
5. **File types** in scope (PDF, Word/docx, images, etc.) and roughly how many.

## Notes

- One folder = one project in Claude Code. This is its own git repo (not yet
  initialized) — separate from Subscription_Tracker.
- Rust toolchain, Node, and the Tauri CLI are already installed on this machine.
- GitHub org: `MenozziTechGroup`. A code-signing cert is not yet purchased
  (SmartScreen will warn on install until then) — fine for internal use.
