pub mod models;
pub mod provider;
pub mod providers;
pub mod tray;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![fetch_usage_state])
    .on_window_event(|window, event| {
      if window.label() == "main" {
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
      tray::setup(app)?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
