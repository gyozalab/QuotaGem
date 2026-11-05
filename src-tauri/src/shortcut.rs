//! 全域快捷鍵：按一下顯示面板、再按一下隱藏（等同點托盤圖示）。
//!
//! 快捷鍵字串由設定檔的 `globalShortcut` 決定（預設 `Ctrl+Alt+Q`），
//! 空字串代表停用。格式由 tauri-plugin-global-shortcut 解析，例如
//! `Ctrl+Alt+Q`、`Ctrl+Shift+F9`。

use std::str::FromStr;

use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub const DEFAULT_SHORTCUT: &str = "Ctrl+Alt+Q";

/// 解析快捷鍵字串。空字串（含空白）回 `Ok(None)` 表示停用。
pub fn parse(accelerator: &str) -> Result<Option<Shortcut>, String> {
    let trimmed = accelerator.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    Shortcut::from_str(trimmed)
        .map(Some)
        .map_err(|e| format!("無效的快捷鍵「{trimmed}」: {e}"))
}

/// 以新的快捷鍵取代目前已註冊的快捷鍵。失敗時舊的已被清掉，
/// 呼叫端應視情況用 `DEFAULT_SHORTCUT` 或前一個值重新註冊。
pub fn apply(app: &AppHandle, accelerator: &str) -> Result<(), String> {
    let parsed = parse(accelerator)?;
    let manager = app.global_shortcut();
    manager.unregister_all().map_err(|e| e.to_string())?;
    let Some(shortcut) = parsed else {
        crate::diag::log_line("shortcut:disabled");
        return Ok(());
    };
    manager
        .on_shortcut(shortcut, |app, _shortcut, event| {
            // 按下與放開都會觸發，只在按下時 toggle，避免連跳兩次。
            if event.state() == ShortcutState::Pressed {
                crate::diag::log_line("shortcut:pressed -> toggle");
                let _ = crate::windows::toggle_preferred_panel(app);
            }
        })
        .map_err(|e| format!("註冊快捷鍵「{}」失敗（可能已被其他程式占用）: {e}", accelerator.trim()))?;
    crate::diag::log_line(&format!("shortcut:registered {}", accelerator.trim()));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{parse, DEFAULT_SHORTCUT};

    #[test]
    fn default_shortcut_parses() {
        assert!(parse(DEFAULT_SHORTCUT).unwrap().is_some());
    }

    #[test]
    fn blank_means_disabled() {
        assert!(parse("").unwrap().is_none());
        assert!(parse("   ").unwrap().is_none());
    }

    #[test]
    fn garbage_is_rejected() {
        assert!(parse("Ctrl+Alt+").is_err());
        assert!(parse("not a shortcut").is_err());
    }
}
