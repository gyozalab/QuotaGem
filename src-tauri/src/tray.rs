use tauri::{
    menu::MenuBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Emitter, Manager,
};

const SETTINGS_MENU_ID: &str = "settings";
const QUIT_MENU_ID: &str = "quit";

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

pub fn setup(app: &mut App) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text(SETTINGS_MENU_ID, "設定")
        .separator()
        .text(QUIT_MENU_ID, "結束")
        .build()?;

    let mut tray = TrayIconBuilder::new()
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

#[cfg(test)]
mod tests {
    use super::{menu_action, MenuAction};

    #[test]
    fn tray_menu_ids_map_to_settings_and_quit_actions() {
        assert_eq!(menu_action("settings"), Some(MenuAction::OpenSettings));
        assert_eq!(menu_action("quit"), Some(MenuAction::Quit));
        assert_eq!(menu_action("unknown"), None);
    }
}
