pub mod alerts;
pub mod models;
pub mod provider;
pub mod providers;
pub mod refresh;
pub mod tray;
pub mod windows;

use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;

/// 把回傳給前端的 preferences 的 launch_at_login 改成系統「實際」開機自啟狀態，
/// 而非存檔值。對齊 1.0：開機自啟開關顯示真實 OS 狀態，不會在 enable() 失敗或
/// 被外部工具改動後「說謊」。
fn with_real_autostart(
  app: &tauri::AppHandle,
  mut prefs: models::WidgetPreferences,
) -> models::WidgetPreferences {
  if let Ok(enabled) = app.autolaunch().is_enabled() {
    prefs.launch_at_login = enabled;
  }
  prefs
}

/// 一次性清除 1.0（Electron）殘留的開機自啟登錄機碼。
///
/// 舊版 Electron autostart 會在 `HKCU\...\Run` 寫入 `electron.app.QuotaGem`
/// 與 `electron.app.Electron` 兩個固定機碼值。1.0→2.0 升級者若不清，開機時
/// 空殼舊版會被拉起佔住托盤、新版反而起不來。這裡只刪這兩個固定名稱，
/// **不動** 2.0 自己（`tauri-plugin-autostart`）寫的 `QuotaGem` 機碼。
/// 刪失敗（機碼不存在、權限不足等）一律忽略，不影響啟動。
#[cfg(windows)]
fn cleanup_legacy_electron_autostart() {
  use winreg::enums::{HKEY_CURRENT_USER, KEY_SET_VALUE};
  use winreg::RegKey;

  let run = match RegKey::predef(HKEY_CURRENT_USER)
    .open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Run", KEY_SET_VALUE)
  {
    Ok(key) => key,
    Err(_) => return,
  };

  for legacy in ["electron.app.QuotaGem", "electron.app.Electron"] {
    let _ = run.delete_value(legacy);
  }
}

#[cfg(not(windows))]
fn cleanup_legacy_electron_autostart() {}

#[tauri::command]
async fn fetch_usage_state(app: tauri::AppHandle) -> Result<models::UsageStateResponse, String> {
  let store = models::load_settings();
  let prefs = store.to_preferences();
  let claude_key = store.claude_session_key.clone();
  let claude_org = store.claude_organization_id.clone();
  let snapshots = providers::get_all_snapshots(claude_key, claude_org).await;
  alerts::process_alerts(&app, &snapshots, &prefs);
  Ok(models::UsageStateResponse {
    snapshots,
    preferences: with_real_autostart(&app, prefs),
  })
}

#[tauri::command]
async fn save_settings(
  app: tauri::AppHandle,
  preferences: models::WidgetPreferences,
) -> Result<models::UsageStateResponse, String> {
  let mut store = models::load_settings();
  store.preferred_display_mode = Some(preferences.preferred_display_mode);
  store.launch_at_login = Some(preferences.launch_at_login);
  store.provider_visibility = Some(serde_json::to_value(&preferences.provider_visibility).map_err(|e| e.to_string())?);
  store.refresh_interval_minutes = Some(preferences.refresh_interval_minutes);
  store.warning_threshold = Some(preferences.warning_threshold);
  store.danger_threshold = Some(preferences.danger_threshold);
  store.notifications_enabled = Some(preferences.notifications_enabled);
  store.notification_level = Some(preferences.notification_level);
  store.language = Some(preferences.language);
  store.time_display = Some(preferences.time_display);
  store.time_format = Some(preferences.time_format);
  store.date_format = Some(preferences.date_format);
  store.panel_scale = Some(preferences.panel_scale);
  store.panel_opacity = Some(preferences.panel_opacity);
  store.panel_tone = Some(preferences.panel_tone);

  models::save_settings(&store).map_err(|e| e.to_string())?;

  let autostart = app.autolaunch();
  if preferences.launch_at_login {
    let _ = autostart.enable();
  } else {
    let _ = autostart.disable();
  }

  let _ = windows::update_window_geometries(&app, &store);

  // 語言可能改變 → 即時重建托盤選單語言（對齊 1.0 save 時更新托盤）
  tray::update_tray_language(
    &app,
    &store.language.clone().unwrap_or_else(|| "en".to_string()),
  );

  let claude_key = store.claude_session_key.clone();
  let claude_org = store.claude_organization_id.clone();
  let snapshots = providers::get_all_snapshots(claude_key, claude_org).await;

  Ok(models::UsageStateResponse {
    snapshots,
    preferences: with_real_autostart(&app, store.to_preferences()),
  })
}

#[tauri::command]
async fn connect_claude(app: tauri::AppHandle) -> Result<models::UsageStateResponse, String> {
  let _login_window = tauri::WebviewWindowBuilder::new(
    &app,
    "claude_login",
    tauri::WebviewUrl::App("https://claude.ai/login".parse().unwrap()),
  )
  .title("Log in to Claude")
  .inner_size(1000.0, 700.0)
  .focused(true)
  .resizable(true)
  .build()
  .map_err(|e| e.to_string())?;

  let mut session_key = None;
  loop {
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    // 檢查視窗是否已關閉（使用者手動關閉）
    let win = match app.get_webview_window("claude_login") {
      Some(w) => w,
      None => break,
    };

    if let Ok(cookies) = win.cookies() {
      if let Some(cookie) = cookies.into_iter().find(|c| c.name() == "sessionKey" && !c.value().is_empty()) {
        session_key = Some(cookie.value().to_string());
        let _ = win.close();
        break;
      }
    }
  }

  let key = match session_key {
    Some(k) => k,
    None => return Err("Claude login window was closed before sign-in finished.".to_string()),
  };

  let provider = providers::claude::ClaudeProvider::new(None, None);
  let org_id = provider.resolve_organization_id(&key).await.map_err(|e| e.to_string())?;

  let mut store = models::load_settings();
  store.claude_session_key = Some(key);
  store.claude_organization_id = Some(org_id);

  models::save_settings(&store).map_err(|e| e.to_string())?;

  let snapshots = providers::get_all_snapshots(store.claude_session_key.clone(), store.claude_organization_id.clone()).await;

  Ok(models::UsageStateResponse {
    snapshots,
    preferences: with_real_autostart(&app, store.to_preferences()),
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

#[tauri::command]
async fn refresh_usage(app: tauri::AppHandle) -> Result<(), String> {
  windows::broadcast_refresh(&app).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_autostart::Builder::default().build())
    .plugin(tauri_plugin_notification::init())
    .manage(windows::ExpandedWindowState::default())
    .manage(std::sync::Mutex::new(alerts::AlertTracker::new()))
    .invoke_handler(tauri::generate_handler![
      fetch_usage_state,
      save_settings,
      connect_claude,
      open_compact_panel,
      open_expanded_panel,
      close_panels,
      sync_expanded_layout,
      refresh_usage
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

      // 一次性清掉 1.0（Electron）殘留的開機自啟機碼，避免升級者開機被空殼舊版佔位。
      cleanup_legacy_electron_autostart();

      // 開機自啟：啟動時依儲存偏好重新套用到系統，修復外部改動造成的漂移
      // （對齊 1.0 syncLaunchAtLoginPreference）。
      {
        let store = models::load_settings();
        let autostart = app.handle().autolaunch();
        if store.launch_at_login.unwrap_or(false) {
          let _ = autostart.enable();
        } else {
          let _ = autostart.disable();
        }
      }

      refresh::start_auto_refresh(app.handle().clone());
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
