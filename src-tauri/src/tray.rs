use tauri::{
    menu::MenuBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Emitter, Manager,
};

use crate::models::load_settings;

const SETTINGS_MENU_ID: &str = "settings";
const QUIT_MENU_ID: &str = "quit";
const TRAY_ID: &str = "quota-gem-tray";

#[derive(Debug, PartialEq, Eq)]
pub enum MenuAction {
    OpenSettings,
    Quit,
}

pub fn menu_action(id: &str) -> Option<MenuAction> {
    match id {
        SETTINGS_MENU_ID => Some(MenuAction::OpenSettings),
        QUIT_MENU_ID => Some(MenuAction::Quit),
        _ => None,
    }
}

/// 托盤選單標籤的在地化（對齊 1.0：選單跟著語言切換，不寫死）。
/// 對應 i18n key `settings` / `quit`。
fn menu_labels(language: &str) -> (&'static str, &'static str) {
    if language == "zh-TW" {
        ("設定", "結束")
    } else {
        ("Settings", "Quit")
    }
}

pub fn setup(app: &mut App) -> tauri::Result<()> {
    let language = load_settings()
        .language
        .unwrap_or_else(|| "en".to_string());
    let (settings_label, quit_label) = menu_labels(&language);

    let menu = MenuBuilder::new(app)
        .text(SETTINGS_MENU_ID, settings_label)
        .separator()
        .text(QUIT_MENU_ID, quit_label)
        .build()?;

    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("QuotaGem")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match menu_action(event.id().as_ref()) {
            Some(MenuAction::OpenSettings) => {
                let _ = crate::windows::show_expanded_panel(app);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("settings:requested", ());
                }
            }
            Some(MenuAction::Quit) => app.exit(0),
            None => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = crate::windows::toggle_preferred_panel(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        tray = tray.icon(icon);
    }

    tray.build(app)?;
    Ok(())
}

/// 語言變更時即時重建托盤選單（對應 1.0 save 時更新托盤）。
/// on_menu_event handler 綁在 tray 上不受影響，選單項 ID 不變所以動作仍正確。
pub fn update_tray_language(app: &AppHandle, language: &str) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    let (settings_label, quit_label) = menu_labels(language);
    if let Ok(menu) = MenuBuilder::new(app)
        .text(SETTINGS_MENU_ID, settings_label)
        .separator()
        .text(QUIT_MENU_ID, quit_label)
        .build()
    {
        let _ = tray.set_menu(Some(menu));
    }
}

#[cfg(test)]
mod tests {
    use super::{menu_action, menu_labels, MenuAction};

    #[test]
    fn tray_menu_ids_map_to_settings_and_quit_actions() {
        assert_eq!(menu_action("settings"), Some(MenuAction::OpenSettings));
        assert_eq!(menu_action("quit"), Some(MenuAction::Quit));
        assert_eq!(menu_action("unknown"), None);
    }

    #[test]
    fn menu_labels_localize_by_language() {
        assert_eq!(menu_labels("zh-TW"), ("設定", "結束"));
        assert_eq!(menu_labels("en"), ("Settings", "Quit"));
        // 未知語言 fallback 英文（對齊 i18n t() 的 fallback）
        assert_eq!(menu_labels("fr"), ("Settings", "Quit"));
    }
}
