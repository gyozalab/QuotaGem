pub mod models;
pub mod provider;
pub mod providers;
pub mod tray;
pub mod windows;

#[tauri::command]
async fn fetch_usage_state() -> Result<models::UsageStateResponse, String> {
  let store = models::load_settings();
  let claude_key = store.claude_session_key.clone();
  let claude_org = store.claude_organization_id.clone();
  let snapshots = providers::get_all_snapshots(claude_key, claude_org).await;
  Ok(models::UsageStateResponse {
    snapshots,
    preferences: store.to_preferences(),
  })
}

#[tauri::command]
async fn open_compact_panel(app: tauri::AppHandle) -> Result<(), String> {
  windows::show_compact_panel(&app).map_err(|error| error.to_string())
}

#[tauri::command]
async fn open_expanded_panel(app: tauri::AppHandle) -> Result<(), String> {
  windows::show_expanded_panel(&app).map_err(|error| error.to_string())
}

#[tauri::command]
async fn close_panels(app: tauri::AppHandle) -> Result<(), String> {
  windows::close_panels(&app).map_err(|error| error.to_string())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpandedLayoutPayload {
  content_height: f64,
  settings_open: bool,
}

#[tauri::command]
async fn sync_expanded_layout(
  app: tauri::AppHandle,
  layout: ExpandedLayoutPayload,
) -> Result<(), String> {
  windows::sync_expanded_layout(&app, layout.content_height, layout.settings_open)
    .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(windows::ExpandedWindowState::default())
    .invoke_handler(tauri::generate_handler![
      fetch_usage_state,
      open_compact_panel,
      open_expanded_panel,
      close_panels,
      sync_expanded_layout
    ])
    .on_window_event(|window, event| {
      if matches!(window.label(), "main" | "compact") {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
          api.prevent_close();
          let _ = window.hide();
        }
      }
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      windows::setup(app)?;
      tray::setup(app)?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
