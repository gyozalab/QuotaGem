pub mod models;
pub mod provider;
pub mod providers;

#[tauri::command]
async fn fetch_usage_state() -> Result<Vec<models::UsageSnapshot>, String> {
  let snapshots = providers::get_all_snapshots(None, None).await;
  Ok(snapshots)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![fetch_usage_state])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
