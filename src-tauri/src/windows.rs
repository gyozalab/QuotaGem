use crate::models::{coerce_provider_visibility, load_settings, AppStore};
use tauri::{
    App, AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

const COMPACT_WINDOW_LABEL: &str = "compact";
const EXPANDED_WINDOW_LABEL: &str = "main";
const WINDOW_MARGIN: f64 = 14.0;
const COMPACT_HEIGHT: f64 = 150.0;
const PANEL_SCALE_OPTIONS: [f64; 5] = [85.0, 100.0, 115.0, 130.0, 150.0];

// expanded 面板基準（移植自 1.0 `expanded-layout.ts` / `panel-layout.ts`）
const EXPANDED_BASE_WIDTH: f64 = 376.0;
const EXPANDED_PANEL_MAX_HEIGHT: f64 = 680.0;
const EXPANDED_PANEL_MIN_HEIGHT: f64 = 220.0;
const EXPANDED_SETTINGS_HEIGHT: f64 = 500.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CompactLayout {
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub zoom_factor: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PanelAction {
    Show,
    Hide,
}

pub fn panel_action(is_visible: bool) -> PanelAction {
    if is_visible {
        PanelAction::Hide
    } else {
        PanelAction::Show
    }
}

fn normalize_panel_scale(value: f64) -> f64 {
    if !value.is_finite() || (value > 85.0 && value < 100.0) {
        return 100.0;
    }

    PANEL_SCALE_OPTIONS
        .into_iter()
        .min_by(|left, right| {
            (left - value)
                .abs()
                .partial_cmp(&(right - value).abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .unwrap_or(100.0)
}

pub fn compact_layout(
    provider_count: usize,
    panel_scale: f64,
    work_area: WorkArea,
    monitor_scale: f64,
) -> CompactLayout {
    let base_width = match provider_count.clamp(1, 3) {
        1 => 200.0,
        2 => 212.0,
        _ => 296.0,
    };
    let zoom_factor = normalize_panel_scale(panel_scale) / 100.0;
    let width = (base_width * zoom_factor).round() as u32;
    let height = (COMPACT_HEIGHT * zoom_factor).round() as u32;
    let physical_width = (f64::from(width) * monitor_scale).round() as i32;
    let physical_height = (f64::from(height) * monitor_scale).round() as i32;
    let physical_margin = (WINDOW_MARGIN * monitor_scale).round() as i32;

    CompactLayout {
        width,
        height,
        x: work_area.x + work_area.width as i32 - physical_width - physical_margin,
        y: work_area.y + work_area.height as i32 - physical_height - physical_margin,
        zoom_factor,
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ExpandedLayout {
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub zoom_factor: f64,
}

/// 高度 clamp，1:1 移植 1.0 `expanded-layout.ts` 的 `getExpandedWindowHeight`。
pub fn expanded_window_height(content_height: f64, settings_open: bool) -> u32 {
    if settings_open {
        return EXPANDED_SETTINGS_HEIGHT as u32;
    }

    if !content_height.is_finite() || content_height <= 0.0 {
        return EXPANDED_PANEL_MAX_HEIGHT as u32;
    }

    content_height
        .round()
        .clamp(EXPANDED_PANEL_MIN_HEIGHT, EXPANDED_PANEL_MAX_HEIGHT) as u32
}

pub fn expanded_layout(
    content_height: f64,
    settings_open: bool,
    panel_scale: f64,
    work_area: WorkArea,
    monitor_scale: f64,
) -> ExpandedLayout {
    let base_height = f64::from(expanded_window_height(content_height, settings_open));
    let zoom_factor = normalize_panel_scale(panel_scale) / 100.0;
    let width = (EXPANDED_BASE_WIDTH * zoom_factor).round() as u32;
    let height = (base_height * zoom_factor).round() as u32;
    let physical_width = (f64::from(width) * monitor_scale).round() as i32;
    let physical_height = (f64::from(height) * monitor_scale).round() as i32;
    let physical_margin = (WINDOW_MARGIN * monitor_scale).round() as i32;

    ExpandedLayout {
        width,
        height,
        x: work_area.x + work_area.width as i32 - physical_width - physical_margin,
        y: work_area.y + work_area.height as i32 - physical_height - physical_margin,
        zoom_factor,
    }
}

/// expanded 面板最近一次回報的內容高度與設定面板開關狀態，
/// 供 `show_expanded_panel` 在 renderer 尚未 sync 前先以正確尺寸定位。
#[derive(Debug)]
pub struct ExpandedWindowState {
    inner: std::sync::Mutex<ExpandedLayoutInput>,
}

#[derive(Clone, Copy, Debug)]
struct ExpandedLayoutInput {
    content_height: f64,
    settings_open: bool,
}

impl Default for ExpandedWindowState {
    fn default() -> Self {
        // 預設內容高度 0 → expanded_window_height 退回最大高度，首次顯示不會過小
        Self {
            inner: std::sync::Mutex::new(ExpandedLayoutInput {
                content_height: 0.0,
                settings_open: false,
            }),
        }
    }
}

fn compact_provider_count(settings: &AppStore) -> usize {
    let visibility = coerce_provider_visibility(&settings.provider_visibility);
    [visibility.claude, visibility.codex, visibility.antigravity]
        .into_iter()
        .filter(|visible| *visible)
        .count()
        .max(1)
}

fn position_compact_window(window: &WebviewWindow, settings: &AppStore) -> tauri::Result<()> {
    let monitor = window
        .primary_monitor()?
        .or(window.current_monitor()?)
        .ok_or_else(|| tauri::Error::AssetNotFound("primary monitor".into()))?;
    let area = monitor.work_area();
    let layout = compact_layout(
        compact_provider_count(settings),
        settings.panel_scale.unwrap_or(100.0),
        WorkArea {
            x: area.position.x,
            y: area.position.y,
            width: area.size.width,
            height: area.size.height,
        },
        monitor.scale_factor(),
    );

    window.set_size(LogicalSize::new(
        f64::from(layout.width),
        f64::from(layout.height),
    ))?;
    window.set_position(PhysicalPosition::new(layout.x, layout.y))?;
    window.set_zoom(layout.zoom_factor)?;
    Ok(())
}

pub fn setup(app: &mut App) -> tauri::Result<()> {
    let settings = load_settings();
    let initial_layout = compact_layout(
        compact_provider_count(&settings),
        settings.panel_scale.unwrap_or(100.0),
        WorkArea {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        },
        1.0,
    );
    let compact = WebviewWindowBuilder::new(
        app,
        COMPACT_WINDOW_LABEL,
        WebviewUrl::App("index.html?mode=compact".into()),
    )
    .title("QuotaGem")
    .inner_size(
        f64::from(initial_layout.width),
        f64::from(initial_layout.height),
    )
    .visible(false)
    .focused(false)
    .decorations(false)
    .transparent(true)
    .resizable(false)
    .skip_taskbar(true)
    .always_on_top(true)
    .shadow(false)
    .build()?;

    position_compact_window(&compact, &settings)
}

pub fn show_compact_panel(app: &AppHandle) -> tauri::Result<()> {
    let settings = load_settings();
    let compact = app
        .get_webview_window(COMPACT_WINDOW_LABEL)
        .ok_or_else(|| tauri::Error::WebviewNotFound)?;

    position_compact_window(&compact, &settings)?;
    if let Some(expanded) = app.get_webview_window(EXPANDED_WINDOW_LABEL) {
        expanded.hide()?;
    }
    compact.show()?;
    compact.set_focus()?;
    compact.emit("usage:refreshRequested", ())?;
    Ok(())
}

fn position_expanded_window(
    window: &WebviewWindow,
    settings: &AppStore,
    input: ExpandedLayoutInput,
) -> tauri::Result<()> {
    let monitor = window
        .primary_monitor()?
        .or(window.current_monitor()?)
        .ok_or_else(|| tauri::Error::AssetNotFound("primary monitor".into()))?;
    let area = monitor.work_area();
    let layout = expanded_layout(
        input.content_height,
        input.settings_open,
        settings.panel_scale.unwrap_or(100.0),
        WorkArea {
            x: area.position.x,
            y: area.position.y,
            width: area.size.width,
            height: area.size.height,
        },
        monitor.scale_factor(),
    );

    window.set_size(LogicalSize::new(
        f64::from(layout.width),
        f64::from(layout.height),
    ))?;
    window.set_position(PhysicalPosition::new(layout.x, layout.y))?;
    window.set_zoom(layout.zoom_factor)?;
    Ok(())
}

pub fn show_expanded_panel(app: &AppHandle) -> tauri::Result<()> {
    if let Some(compact) = app.get_webview_window(COMPACT_WINDOW_LABEL) {
        compact.hide()?;
    }
    let expanded = app
        .get_webview_window(EXPANDED_WINDOW_LABEL)
        .ok_or_else(|| tauri::Error::WebviewNotFound)?;

    let settings = load_settings();
    let input = *app
        .state::<ExpandedWindowState>()
        .inner
        .lock()
        .expect("expanded window state poisoned");
    position_expanded_window(&expanded, &settings, input)?;

    expanded.show()?;
    expanded.set_focus()?;
    expanded.emit("usage:refreshRequested", ())?;
    Ok(())
}

/// renderer 量到內容高度後回報，重算 expanded 視窗高度並重新定位。
pub fn sync_expanded_layout(
    app: &AppHandle,
    content_height: f64,
    settings_open: bool,
) -> tauri::Result<()> {
    let input = ExpandedLayoutInput {
        content_height,
        settings_open,
    };
    {
        let state = app.state::<ExpandedWindowState>();
        let mut guard = state.inner.lock().expect("expanded window state poisoned");
        *guard = input;
    }

    let expanded = app
        .get_webview_window(EXPANDED_WINDOW_LABEL)
        .ok_or_else(|| tauri::Error::WebviewNotFound)?;
    let settings = load_settings();
    position_expanded_window(&expanded, &settings, input)
}

pub fn close_panels(app: &AppHandle) -> tauri::Result<()> {
    if let Some(expanded) = app.get_webview_window(EXPANDED_WINDOW_LABEL) {
        expanded.hide()?;
    }
    if let Some(compact) = app.get_webview_window(COMPACT_WINDOW_LABEL) {
        compact.hide()?;
    }
    Ok(())
}

pub fn toggle_preferred_panel(app: &AppHandle) -> tauri::Result<()> {
    let settings = load_settings();
    let preferred_label = if settings.preferred_display_mode.as_deref() == Some("compact") {
        COMPACT_WINDOW_LABEL
    } else {
        EXPANDED_WINDOW_LABEL
    };
    let is_visible = app
        .get_webview_window(preferred_label)
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false);

    match panel_action(is_visible) {
        PanelAction::Hide => close_panels(app),
        PanelAction::Show if preferred_label == COMPACT_WINDOW_LABEL => show_compact_panel(app),
        PanelAction::Show => show_expanded_panel(app),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        compact_layout, expanded_layout, expanded_window_height, panel_action, CompactLayout,
        ExpandedLayout, PanelAction, WorkArea,
    };

    #[test]
    fn expanded_window_height_matches_typescript_contract() {
        // 對齊 1.0 `expanded-layout.test.ts` 的契約
        assert_eq!(expanded_window_height(318.0, false), 318);
        assert_eq!(expanded_window_height(640.0, false), 640);
        assert_eq!(expanded_window_height(900.0, false), 680);
        assert_eq!(expanded_window_height(318.0, true), 500);
        // 邊界：非有限 / 非正值 → 退回最大高度
        assert_eq!(expanded_window_height(0.0, false), 680);
        assert_eq!(expanded_window_height(f64::NAN, false), 680);
        // 邊界：低於下限 → clamp 到 220
        assert_eq!(expanded_window_height(100.0, false), 220);
    }

    #[test]
    fn expanded_layout_uses_376_base_and_clamped_height() {
        let work_area = WorkArea {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        };

        assert_eq!(
            expanded_layout(318.0, false, 100.0, work_area, 1.0),
            ExpandedLayout {
                width: 376,
                height: 318,
                x: 1530,
                y: 708,
                zoom_factor: 1.0,
            }
        );
    }

    #[test]
    fn expanded_layout_settings_open_scales_with_panel_scale_and_dpi() {
        let work_area = WorkArea {
            x: 100,
            y: 50,
            width: 2400,
            height: 1350,
        };

        let layout = expanded_layout(318.0, true, 150.0, work_area, 1.5);

        // settings 開啟固定 500，再乘 panel scale 1.5 → 750；寬 376*1.5 → 564
        assert_eq!(layout.width, 564);
        assert_eq!(layout.height, 750);
        assert_eq!(layout.zoom_factor, 1.5);
        // 右下角定位（physical：寬 564*1.5=846、高 750*1.5=1125、margin 14*1.5=21）
        assert_eq!(layout.x, 100 + 2400 - 846 - 21);
        assert_eq!(layout.y, 50 + 1350 - 1125 - 21);
    }

    #[test]
    fn panel_action_toggles_visible_state() {
        assert_eq!(panel_action(false), PanelAction::Show);
        assert_eq!(panel_action(true), PanelAction::Hide);
    }

    #[test]
    fn compact_width_matches_one_two_and_three_provider_layouts() {
        let work_area = WorkArea {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        };

        assert_eq!(
            compact_layout(1, 100.0, work_area, 1.0),
            CompactLayout {
                width: 200,
                height: 150,
                x: 1706,
                y: 876,
                zoom_factor: 1.0,
            }
        );
        assert_eq!(compact_layout(2, 85.0, work_area, 1.0).width, 180);
        assert_eq!(compact_layout(2, 85.0, work_area, 1.0).height, 128);
        assert_eq!(compact_layout(3, 100.0, work_area, 1.0).width, 296);
    }

    #[test]
    fn compact_layout_clamps_provider_count_and_uses_monitor_dpi_for_position() {
        let work_area = WorkArea {
            x: 100,
            y: 50,
            width: 2400,
            height: 1350,
        };

        let layout = compact_layout(9, 150.0, work_area, 1.5);

        assert_eq!(layout.width, 444);
        assert_eq!(layout.height, 225);
        assert_eq!(layout.x, 1813);
        assert_eq!(layout.y, 1041);
        assert_eq!(layout.zoom_factor, 1.5);
    }
}
