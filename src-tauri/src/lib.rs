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

#[derive(Serialize)]
pub struct ScannedFile {
  pub path: String,
  pub name: String,
  pub category: String,
  pub file_type: String,
  pub size: u64,
}

/// Walks a vault folder up to 3 levels deep and returns all .docx and .pdf files.
/// Category is derived from the immediate parent folder name matched against
/// known MITS document category folder names.
#[tauri::command]
fn scan_vault(path: String) -> Result<Vec<ScannedFile>, String> {
  if path.is_empty() {
    return Err("No vault path provided".to_string());
  }
  let root = Path::new(&path);
  if !root.exists() {
    return Err(format!("Path does not exist: {}", path));
  }

  let category_map: &[(&str, &str)] = &[
    ("runbooks", "Runbooks"),
    ("runbook", "Runbooks"),
    ("sops", "SOPs"),
    ("sop", "SOPs"),
    ("standard operating", "SOPs"),
    ("checklists", "Checklists"),
    ("checklist", "Checklists"),
    ("client guides", "Client Guides"),
    ("client-guides", "Client Guides"),
    ("clientguides", "Client Guides"),
    ("scripts reference", "Scripts Reference"),
    ("scripts", "Scripts Reference"),
    ("script", "Scripts Reference"),
    ("letters", "Letters"),
    ("letter", "Letters"),
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

    if ext != "docx" && ext != "pdf" {
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

    let parent_name = p.parent()
      .and_then(|parent| parent.file_name())
      .and_then(|n| n.to_str())
      .unwrap_or("")
      .to_lowercase();

    let category = category_map.iter()
      .find(|(key, _)| parent_name.contains(key))
      .map(|(_, label)| label.to_string())
      .unwrap_or_else(|| "Other".to_string());

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
    .invoke_handler(tauri::generate_handler![scan_vault])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let open_i = MenuItem::with_id(app, "open", "Open DocManager", true, None::<&str>)?;
      let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&open_i, &quit_i])?;

      TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("MITS DocManager")
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
