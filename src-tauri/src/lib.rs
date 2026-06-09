use tauri_plugin_sql::{Migration, MigrationKind};
use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use walkdir::WalkDir;
use serde::Serialize;
use std::path::Path;
use std::fs;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Serialize)]
pub struct ScannedFile {
  pub path: String,
  pub name: String,
  pub category: String,
  pub file_type: String,
  pub size: u64,
}

/// Walks a vault folder up to 3 levels deep and returns all .docx and .pdf files.
/// Category is the nearest ancestor folder name (closest to the file), using its
/// original casing from the filesystem. This makes categories fully dynamic —
/// any folder you add to the vault automatically becomes a category.
#[tauri::command]
fn scan_vault(path: String) -> Result<Vec<ScannedFile>, String> {
  if path.is_empty() {
    return Err("No vault path provided".to_string());
  }
  let root = Path::new(&path);
  if !root.exists() {
    return Err(format!("Path does not exist: {}", path));
  }

  // Documents (.docx/.pdf) plus script files we treat as first-class items.
  let allowed_ext: &[&str] = &[
    "docx", "pdf", "ps1", "psm1", "bat", "cmd", "sh", "py",
  ];

  let mut files: Vec<ScannedFile> = Vec::new();

  for entry in WalkDir::new(root).min_depth(1).max_depth(3).follow_links(false) {
    let entry = match entry {
      Ok(e) => e,
      Err(_) => continue,
    };

    if !entry.file_type().is_file() {
      continue;
    }

    let p = entry.path();
    let ext = p.extension()
      .and_then(|e| e.to_str())
      .unwrap_or("")
      .to_lowercase();

    if !allowed_ext.contains(&ext.as_str()) {
      continue;
    }

    let file_name = match p.file_name().and_then(|n| n.to_str()) {
      Some(n) => n.to_string(),
      None => continue,
    };

    // Skip temp Word files
    if file_name.starts_with('~') {
      continue;
    }

    // Category = the nearest ancestor folder name (closest to the file),
    // preserving its original casing. Falls back to "Other" if the file
    // sits directly in the vault root with no parent folder.
    let category = {
      let rel = p.strip_prefix(root).unwrap_or(p);
      let folders: Vec<String> = rel
        .components()
        .filter_map(|c| c.as_os_str().to_str().map(|s| s.to_string()))
        .collect();
      // folders includes the file name as last element; we want the one before it
      if folders.len() >= 2 {
        folders[folders.len() - 2].clone()
      } else {
        "Other".to_string()
      }
    };

    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

    files.push(ScannedFile {
      path: p.to_string_lossy().to_string(),
      name: file_name,
      category,
      file_type: ext,
      size,
    });
  }

  Ok(files)
}

/// Returns, for each input path, whether a file currently exists at it.
/// Used to flag library documents whose underlying file was moved or deleted.
#[tauri::command]
fn paths_exist(paths: Vec<String>) -> Vec<bool> {
  paths
    .iter()
    .map(|p| !p.is_empty() && Path::new(p).exists())
    .collect()
}

/// Writes UTF-8 text to a file, creating parent directories as needed.
/// Used for the metadata JSON backup sidecar in the vault folder.
#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
  let p = Path::new(&path);
  if let Some(parent) = p.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::write(p, contents).map_err(|e| e.to_string())
}

/// Reads UTF-8 text from a file. Returns an empty string if the file is missing.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
  let p = Path::new(&path);
  if !p.exists() {
    return Ok(String::new());
  }
  fs::read_to_string(p).map_err(|e| e.to_string())
}

/// Copies a source file into <vault>/<category>/<file_name>, creating the
/// category subfolder if needed. Returns the destination path. Refuses to
/// overwrite an existing file. Used by the "Import from Claude" flow.
#[tauri::command]
fn import_into_vault(src: String, vault: String, category: String, file_name: String) -> Result<String, String> {
  if vault.is_empty() {
    return Err("No vault folder configured".to_string());
  }
  let src_path = Path::new(&src);
  if !src_path.exists() {
    return Err(format!("Source file not found: {}", src));
  }
  let dest_dir = Path::new(&vault).join(&category);
  fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
  let dest = dest_dir.join(&file_name);
  if dest.exists() {
    return Err(format!("A file named \"{}\" already exists in {}.", file_name, category));
  }
  fs::copy(src_path, &dest).map_err(|e| e.to_string())?;
  Ok(dest.to_string_lossy().to_string())
}

/// Converts a .docx to a PDF in the same folder using Microsoft Word
/// automation (via PowerShell). Returns the new PDF path. Requires Word
/// to be installed. Used to complete the docx/pdf pair on import.
#[tauri::command]
fn convert_to_pdf(src: String) -> Result<String, String> {
  let src_path = Path::new(&src);
  if !src_path.exists() {
    return Err(format!("Source file not found: {}", src));
  }
  let pdf = src_path.with_extension("pdf").to_string_lossy().to_string();
  let src_esc = src.replace('\'', "''");
  let pdf_esc = pdf.replace('\'', "''");

  // Robust Word automation: strip Mark-of-the-Web (avoids Protected View),
  // silence dialogs, and retry because Word can reject calls while it's still
  // starting up (RPC_E_CALL_REJECTED). ExportAsFixedFormat is more reliable
  // for PDF than SaveAs.
  let template = r#"
$ErrorActionPreference = 'Stop'
try { Unblock-File -LiteralPath '__SRC__' } catch {}
$w = New-Object -ComObject Word.Application
$w.Visible = $false
try { $w.DisplayAlerts = 0 } catch {}
$doc = $null
$ok = $false
for ($i = 0; $i -lt 6 -and -not $ok; $i++) {
  try {
    if ($null -eq $doc) { $doc = $w.Documents.Open('__SRC__', $false, $true) }
    $doc.ExportAsFixedFormat('__DST__', 17)
    $ok = $true
  } catch {
    Start-Sleep -Milliseconds 800
  }
}
if ($null -ne $doc) { try { $doc.Close($false) } catch {} }
try { $w.Quit() } catch {}
if (-not $ok) { throw 'Word kept rejecting the conversion after several retries.' }
"#;
  let script = template.replace("__SRC__", &src_esc).replace("__DST__", &pdf_esc);

  let mut cmd = std::process::Command::new("powershell");
  cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
  #[cfg(windows)]
  cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW — don't flash a console

  let output = cmd.output().map_err(|e| e.to_string())?;
  if !output.status.success() {
    let err = String::from_utf8_lossy(&output.stderr);
    return Err(format!("Word conversion failed: {}", err.trim()));
  }
  Ok(pdf)
}

/// Extracts the plain text from a .docx for full-text search. A .docx is a
/// zip; the body lives in word/document.xml. We strip the XML tags (turning
/// paragraph ends into newlines) — crude but plenty for keyword search.
#[tauri::command]
fn extract_docx_text(path: String) -> Result<String, String> {
  use std::io::Read;
  let file = fs::File::open(&path).map_err(|e| e.to_string())?;
  let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
  let mut xml = String::new();
  {
    let mut entry = archive
      .by_name("word/document.xml")
      .map_err(|e| e.to_string())?;
    entry.read_to_string(&mut xml).map_err(|e| e.to_string())?;
  }
  // Preserve paragraph boundaries, then drop every tag
  let xml = xml.replace("</w:p>", "\n");
  let mut out = String::with_capacity(xml.len());
  let mut in_tag = false;
  for c in xml.chars() {
    match c {
      '<' => in_tag = true,
      '>' => in_tag = false,
      _ if !in_tag => out.push(c),
      _ => {}
    }
  }
  let out = out
    .replace("&amp;", "&")
    .replace("&lt;", "<")
    .replace("&gt;", ">")
    .replace("&quot;", "\"")
    .replace("&apos;", "'");
  Ok(out)
}

/// Extracts plain text from a PDF for full-text search of PDF-only documents
/// (PDFs generated from a paired .docx are already covered by the docx index).
#[tauri::command]
fn extract_pdf_text(path: String) -> Result<String, String> {
  pdf_extract::extract_text(&path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let migrations = vec![
    Migration {
      version: 1,
      description: "create_initial_schema",
      sql: r#"
        CREATE TABLE IF NOT EXISTS documents (
          id          TEXT PRIMARY KEY,
          title       TEXT NOT NULL,
          category    TEXT NOT NULL DEFAULT 'other',
          file_path   TEXT NOT NULL UNIQUE,
          file_name   TEXT NOT NULL,
          file_type   TEXT NOT NULL DEFAULT 'docx',
          description TEXT NOT NULL DEFAULT '',
          status      TEXT NOT NULL DEFAULT 'active',
          tags        TEXT NOT NULL DEFAULT '[]',
          version     TEXT NOT NULL DEFAULT '',
          client_name TEXT NOT NULL DEFAULT '',
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
        CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

        CREATE TABLE IF NOT EXISTS document_groups (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          color       TEXT NOT NULL DEFAULT '#e1251b',
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS group_members (
          id          TEXT PRIMARY KEY,
          group_id    TEXT NOT NULL REFERENCES document_groups(id) ON DELETE CASCADE,
          document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          UNIQUE(group_id, document_id)
        );
        CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);

        CREATE TABLE IF NOT EXISTS tags (
          id    TEXT PRIMARY KEY,
          name  TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS settings (
          key    TEXT PRIMARY KEY,
          value  TEXT
        );
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 2,
      description: "add_paired_paths",
      sql: r#"
        ALTER TABLE documents ADD COLUMN docx_path TEXT NOT NULL DEFAULT '';
        ALTER TABLE documents ADD COLUMN pdf_path  TEXT NOT NULL DEFAULT '';
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 3,
      description: "add_review_and_changelog",
      sql: r#"
        ALTER TABLE documents ADD COLUMN review_by    TEXT NOT NULL DEFAULT '';
        ALTER TABLE documents ADD COLUMN version_notes TEXT NOT NULL DEFAULT '';
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 4,
      description: "add_favorite_and_last_opened",
      sql: r#"
        ALTER TABLE documents ADD COLUMN favorite    INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE documents ADD COLUMN last_opened TEXT NOT NULL DEFAULT '';
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 5,
      description: "add_source_url_and_content_index",
      sql: r#"
        ALTER TABLE documents ADD COLUMN source_url   TEXT NOT NULL DEFAULT '';
        ALTER TABLE documents ADD COLUMN content_text TEXT NOT NULL DEFAULT '';
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 6,
      description: "add_docid_domain_audience",
      sql: r#"
        ALTER TABLE documents ADD COLUMN doc_id   TEXT NOT NULL DEFAULT '';
        ALTER TABLE documents ADD COLUMN domain   TEXT NOT NULL DEFAULT '';
        ALTER TABLE documents ADD COLUMN audience TEXT NOT NULL DEFAULT 'Internal';
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 7,
      description: "playbooks_phases_and_runs",
      sql: r#"
        ALTER TABLE document_groups ADD COLUMN trigger_text TEXT NOT NULL DEFAULT '';
        ALTER TABLE document_groups ADD COLUMN outcome      TEXT NOT NULL DEFAULT '';
        ALTER TABLE group_members ADD COLUMN phase     TEXT NOT NULL DEFAULT 'Execute';
        ALTER TABLE group_members ADD COLUMN required  TEXT NOT NULL DEFAULT 'Required';
        ALTER TABLE group_members ADD COLUMN condition TEXT NOT NULL DEFAULT '';

        CREATE TABLE IF NOT EXISTS playbook_runs (
          id           TEXT PRIMARY KEY,
          group_id     TEXT NOT NULL REFERENCES document_groups(id) ON DELETE CASCADE,
          name         TEXT NOT NULL DEFAULT '',
          client_name  TEXT NOT NULL DEFAULT '',
          ticket       TEXT NOT NULL DEFAULT '',
          status       TEXT NOT NULL DEFAULT 'in_progress',
          started_at   TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_runs_group ON playbook_runs(group_id);

        CREATE TABLE IF NOT EXISTS playbook_run_items (
          id          TEXT PRIMARY KEY,
          run_id      TEXT NOT NULL REFERENCES playbook_runs(id) ON DELETE CASCADE,
          document_id TEXT NOT NULL,
          doc_title   TEXT NOT NULL DEFAULT '',
          phase       TEXT NOT NULL DEFAULT 'Execute',
          sort_order  INTEGER NOT NULL DEFAULT 0,
          required    TEXT NOT NULL DEFAULT 'Required',
          done        INTEGER NOT NULL DEFAULT 0,
          done_at     TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_runitems_run ON playbook_run_items(run_id);
      "#,
      kind: MigrationKind::Up,
    },
    Migration {
      version: 8,
      description: "audit_log",
      sql: r#"
        CREATE TABLE IF NOT EXISTS audit_log (
          id     TEXT PRIMARY KEY,
          ts     TEXT NOT NULL DEFAULT (datetime('now')),
          who    TEXT NOT NULL DEFAULT '',
          action TEXT NOT NULL DEFAULT '',
          detail TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
      "#,
      kind: MigrationKind::Up,
    },
  ];

  tauri::Builder::default()
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:docmanager.db", migrations)
        .build(),
    )
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_autostart::init(
      MacosLauncher::LaunchAgent,
      Some(vec!["--minimized"]),
    ))
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      scan_vault,
      paths_exist,
      write_text_file,
      read_text_file,
      import_into_vault,
      convert_to_pdf,
      extract_docx_text,
      extract_pdf_text
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let open_i = MenuItem::with_id(app, "open", "Open DocCenter", true, None::<&str>)?;
      let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&open_i, &quit_i])?;

      TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("MITS DocCenter")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
          "open" => show_main(app),
          "quit" => app.exit(0),
          _ => {}
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
          } = event
          {
            show_main(tray.app_handle());
          }
        })
        .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        let _ = window.hide();
        api.prevent_close();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn show_main(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
}
