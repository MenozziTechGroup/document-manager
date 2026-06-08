# DocCenter — Technology Stack

What DocCenter is built on, and what each piece does.

## Desktop app foundation
| Tool | Function |
|---|---|
| **Tauri 2** | Desktop app framework — wraps the web UI in a lightweight native shell, produces the Windows `.exe`/`.msi`/installer, and provides system tray, file access, and auto-update. |
| **Rust** | Tauri's backend language. Powers the native commands: vault scanning, file copy/move, docx→PDF conversion, and text extraction for search. |
| **React 19** | The user interface — all screens, components, and state. |
| **Vite 8** | Frontend build tool + dev server (fast preview in development, production bundling). |
| **Tailwind CSS v4** | UI styling / utility classes. |
| **Node.js / npm** | JavaScript package management and the frontend build. |

## Local data & device features (Tauri plugins)
| Tool | Function |
|---|---|
| **tauri-plugin-sql (SQLite)** | Local database — offline/local mode and cache. |
| **tauri-plugin-opener** | Open files in Word / PDF viewer, reveal in Explorer, open links. |
| **tauri-plugin-dialog** | File/folder pickers and the CSV "save as" dialog. |
| **tauri-plugin-notification** | "Documents due for review" reminders. |
| **tauri-plugin-updater** | Checks for and applies new versions automatically. |
| **tauri-plugin-autostart / process / log** | Launch-at-startup, process control, logging. |

## Document handling (Rust crates + Windows)
| Tool | Function |
|---|---|
| **walkdir** | Recursively scans the vault folder during Sync. |
| **zip** | Reads inside `.docx` files to extract text for full-text search. |
| **pdf-extract** | Extracts text from PDF-only documents for search. |
| **Microsoft Word (COM via PowerShell)** | Generates the read-only PDF from a Word file on import. |

## Shared backend (the team layer)
| Tool | Function |
|---|---|
| **Supabase** | Cloud backend: hosted Postgres, user authentication, realtime updates, row-level security. Holds shared library metadata, playbooks, runs, tags, and the audit log. |
| **PostgreSQL** | The database engine under Supabase. |
| **@supabase/supabase-js** | JavaScript client the app uses to talk to Supabase. |

## File storage
| Tool | Function |
|---|---|
| **SharePoint / OneDrive** | Where the document *files* (the masters) live and sync to each machine. DocCenter reads/opens from there; it never stores the files itself. |

## Build, signing & distribution
| Tool | Function |
|---|---|
| **GitHub** | Source code repository (`MenozziTechGroup/document-manager`). |
| **GitHub Actions** | CI pipeline that builds, signs, and publishes each release. |
| **tauri-apps/tauri-action** | The Action that runs the Tauri build + uploads the release. |
| **WiX (MSI) + NSIS** | Generate the Windows installers. |
| **Tauri signer (minisign)** | The keypair that signs updates so installed apps trust them. |
| **GitHub CLI (`gh`)** | Create the repo, set signing secrets, publish releases. |

## Authoring & assets
| Tool | Function |
|---|---|
| **Claude / Claude Chat** | Authoring the actual documents (SOPs, Runbooks, etc.) and the standards doc, with MITS branding baked in. |
| **Claude Code** | The environment DocCenter was built in. |
| **Keeper** | Stores the updater signing-key password and credentials. |

## How the pieces fit together
- **Files** live in **SharePoint** (synced locally on each PC).
- **Shared metadata** (organization, playbooks, runs) lives in **Supabase**.
- The **Tauri/React app** reads files from the local SharePoint mirror and the shared data from Supabase, tied together by each document's vault-relative path.
- **GitHub Actions** builds and signs releases; installed apps **auto-update** from them.
