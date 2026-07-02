use crate::models::{coerce_provider_visibility, load_settings, AppStore};
use crate::diag;
use std::sync::atomic::{AtomicI64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    App, AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

/// 托盤雙擊去抖閾值（ms）。低於此值的連續 tray click 直接吞掉。
const TRAY_DEBOUNCE_MS: i64 = 350;

#[derive(Debug, Default)]
pub struct PanelTimings {
    last_toggle_at: AtomicI64,
    last_shown_at: AtomicI64,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

const COMPACT_WINDOW_LABEL: &str = "compact";
const EXPANDED_WINDOW_LABEL: &str = "main";
const WINDOW_MARGIN: f64 = 14.0;
const COMPACT_HEIGHT: f64 = 174.0;
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
    let compact_builder = WebviewWindowBuilder::new(
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
    .resizable(false)
    .skip_taskbar(true)
    .always_on_top(true)
    .shadow(false);
    #[cfg(windows)]
    let compact_builder = compact_builder.transparent(true);
    let compact = compact_builder.build()?;

    position_compact_window(&compact, &settings)?;
    diag::log_line("windows::setup complete (windows created hidden)");
    Ok(())
}

pub fn show_compact_panel(app: &AppHandle) -> tauri::Result<()> {
    let settings = load_settings();
    let compact = app
        .get_webview_window(COMPACT_WINDOW_LABEL)
        .ok_or_else(|| tauri::Error::WebviewNotFound)?;

    diag::log_line("show_compact_panel:enter");
    #[cfg(windows)]
    if let Ok(hwnd) = compact.hwnd() {
        diag::snapshot("show_compact_panel:before-hide-expanded", hwnd.0 as isize);
    }

    if let Some(expanded) = app.get_webview_window(EXPANDED_WINDOW_LABEL) {
        let _ = expanded.hide();
    }
    // position → show → diag::force_topmost 強制重綁 topmost。
    // 不再用 Tauri set_always_on_top(true)——專家診斷：Tauri 走的 SetWindowPos
    // 在 transparent+layered 視窗上仍可能被 hide()->show() 循環清掉 HWND_TOPMOST，
    // 或被沒帶 SWP_NOZORDER 的 set_size/set_position 降級為 HWND_TOP。
    // force_topmost 直接打 Win32：SetWindowPos(HWND_TOPMOST, SWP_NOMOVE|SWP_NOSIZE|
    // SWP_NOACTIVATE) + BringWindowToTop，繞過所有抽象不可靠面。
    position_compact_window(&compact, &settings)?;
    compact.show()?;
    #[cfg(windows)]
    {
        if let Ok(hwnd) = compact.hwnd() {
            diag::snapshot("show_compact_panel:after-show", hwnd.0 as isize);
            diag::force_topmost(hwnd.0 as isize);
            diag::snapshot("show_compact_panel:after-force-topmost", hwnd.0 as isize);
        }
    }
    compact.emit("usage:refreshRequested", ())?;
    app.state::<PanelTimings>()
        .last_shown_at
        .store(now_ms(), Ordering::Relaxed);
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
        let _ = compact.hide();
    }
    let expanded = app
        .get_webview_window(EXPANDED_WINDOW_LABEL)
        .ok_or_else(|| tauri::Error::WebviewNotFound)?;

    let settings = load_settings();
    let input = match app.state::<ExpandedWindowState>().inner.lock() {
        Ok(guard) => *guard,
        Err(poisoned) => {
            // Mutex 在過去某次 panic 中毒。降級取 inner，並校驗 content_height 合法性；
            // 不合法則 reset 成預設值（content_height=0 → expanded_window_height 退回最大值）。
            let inner = *poisoned.into_inner();
            if !inner.content_height.is_finite() || inner.content_height < 0.0 {
                ExpandedLayoutInput {
                    content_height: 0.0,
                    settings_open: false,
                }
            } else {
                inner
            }
        }
    };
    // position → show → diag::force_topmost 強制重綁 topmost。
    // 詳細理由見 show_compact_panel 同段註解。
    diag::log_line("show_expanded_panel:enter");
    #[cfg(windows)]
    if let Ok(hwnd) = expanded.hwnd() {
        diag::snapshot("show_expanded_panel:before-position", hwnd.0 as isize);
    }
    position_expanded_window(&expanded, &settings, input)?;
    expanded.show()?;
    #[cfg(windows)]
    {
        if let Ok(hwnd) = expanded.hwnd() {
            diag::snapshot("show_expanded_panel:after-show", hwnd.0 as isize);
            diag::force_topmost(hwnd.0 as isize);
            diag::snapshot("show_expanded_panel:after-force-topmost", hwnd.0 as isize);
        }
    }
    expanded.emit("usage:refreshRequested", ())?;
    app.state::<PanelTimings>()
        .last_shown_at
        .store(now_ms(), Ordering::Relaxed);
    Ok(())
}

/// renderer 量到內容高度後回報，重算 expanded 視窗高度並重新定位。
///
/// 守門：(1) content_height 不合法（< 100、NaN、Inf）→ 拒絕寫入 state 也不動幾何，
/// 避免 settings sheet 卸載瞬間的污染值把後續 show 拉到 1px 高的縫。
/// (2) expanded 視窗 hidden 時 → 寫 state 但不動幾何，避免 layered window
/// 在 hidden 狀態下被 SetWindowPos 觸發 z-order 賬期混亂。
pub fn sync_expanded_layout(
    app: &AppHandle,
    content_height: f64,
    settings_open: bool,
) -> tauri::Result<()> {
    // settings_open=true 時 content_height 來自 ref，可能任何值（500px 是常數高度），
    // 不做 sanity check；只在 settings_open=false 時擋小值。
    if !settings_open && (!content_height.is_finite() || content_height < 100.0) {
        return Ok(());
    }
    let input = ExpandedLayoutInput {
        content_height,
        settings_open,
    };
    {
        let state = app.state::<ExpandedWindowState>();
        let lock_result = state.inner.lock();
        match lock_result {
            Ok(mut guard) => *guard = input,
            Err(poisoned) => *poisoned.into_inner() = input,
        };
    }

    let expanded = app
        .get_webview_window(EXPANDED_WINDOW_LABEL)
        .ok_or_else(|| tauri::Error::WebviewNotFound)?;
    if !expanded.is_visible().unwrap_or(false) {
        return Ok(());
    }
    let settings = load_settings();
    position_expanded_window(&expanded, &settings, input)?;
    #[cfg(windows)]
    if let Ok(hwnd) = expanded.hwnd() {
        // sync_expanded_layout 在 settings sheet 關閉後也會跑（content_height 變化）；
        // 不重綁 topmost，set_size/set_position 又把 z-order 推下去。
        diag::snapshot("sync_expanded_layout:after-position", hwnd.0 as isize);
        diag::force_topmost(hwnd.0 as isize);
    }
    Ok(())
}

/// 對目前可見的面板廣播刷新請求（隱藏的視窗不打擾），移植自 1.0 `broadcastRefresh`。
pub fn broadcast_refresh(app: &AppHandle) -> tauri::Result<()> {
    for label in [EXPANDED_WINDOW_LABEL, COMPACT_WINDOW_LABEL] {
        if let Some(window) = app.get_webview_window(label) {
            if window.is_visible().unwrap_or(false) {
                window.emit("usage:refreshRequested", ())?;
            }
        }
    }
    Ok(())
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

/// 托盤左鍵的入口。
///
/// **這次跟前 4 次失敗最大的差異：徹底拔除可見性狀態機**。前 4 次都基於
/// 「visible→hide、hidden→show」的 toggle 假設，但五位專家平行診斷確認：
///   - is_visible() 走 IsWindowVisible 只查 WS_VISIBLE bit，對 transparent +
///     skipTaskbar + layered 視窗在儲存設定後常回報 true 但實際被壓在 z-order 底層看不見
///   - 加 grace、加 AtomicBool、加 is_focused() 判斷都只是在不可靠抽象上堆狀態，治標不治本
///
/// 新語意：**tray click = 永遠強制 show**。隱藏由前端關閉按鈕 / Quit menu 處理。
/// debounce 仍保留以擋 Windows 雙擊被當成兩次 click 的情形。
pub fn toggle_preferred_panel(app: &AppHandle) -> tauri::Result<()> {
    let timings = app.state::<PanelTimings>();
    let now = now_ms();
    let last_toggle = timings.last_toggle_at.load(Ordering::Relaxed);
    if now - last_toggle < TRAY_DEBOUNCE_MS {
        diag::log_line("toggle_preferred_panel:debounced");
        return Ok(());
    }
    timings.last_toggle_at.store(now, Ordering::Relaxed);

    diag::log_line("toggle_preferred_panel:enter");
    #[cfg(windows)]
    {
        let settings_dbg = load_settings();
        let is_compact_dbg = settings_dbg.preferred_display_mode.as_deref() == Some("compact");
        let label = if is_compact_dbg { COMPACT_WINDOW_LABEL } else { EXPANDED_WINDOW_LABEL };
        if let Some(w) = app.get_webview_window(label) {
            let tauri_visible = w.is_visible().unwrap_or(false);
            if let Ok(hwnd) = w.hwnd() {
                diag::log_line(&format!(
                    "toggle:tauri-is-visible={} (compare Win32 IsWindowVisible below)",
                    tauri_visible
                ));
                diag::snapshot("toggle_preferred_panel:before-show", hwnd.0 as isize);
            }
        }
    }

    let settings = load_settings();
    let is_compact = settings.preferred_display_mode.as_deref() == Some("compact");

    // 永遠強制 show——不查可見性。show_*_panel 內部負責：position → show →
    // diag::force_topmost(Win32 SetWindowPos + BringWindowToTop)，即使視窗已 visible
    // 但被壓在 z-order 底層也會被拉回頂部。
    if is_compact {
        show_compact_panel(app)
    } else {
        show_expanded_panel(app)
    }
}

pub fn update_window_geometries(app: &AppHandle, settings: &AppStore) -> tauri::Result<()> {
    diag::log_line("update_window_geometries:enter");
    if let Some(compact) = app.get_webview_window(COMPACT_WINDOW_LABEL) {
        if compact.is_visible().unwrap_or(false) {
            position_compact_window(&compact, settings)?;
            // position_compact_window 內 set_size/set_position 走 SetWindowPos 但不帶
            // SWP_NOZORDER，把 HWND_TOPMOST 靜默降級成 HWND_TOP；改用 force_topmost
            // 直接打 Win32 SetWindowPos(HWND_TOPMOST) + BringWindowToTop 守住 z-order。
            #[cfg(windows)]
            if let Ok(hwnd) = compact.hwnd() {
                diag::force_topmost(hwnd.0 as isize);
            }
        }
    }
    if let Some(expanded) = app.get_webview_window(EXPANDED_WINDOW_LABEL) {
        if expanded.is_visible().unwrap_or(false) {
            let input = match app.state::<ExpandedWindowState>().inner.lock() {
                Ok(guard) => *guard,
                Err(poisoned) => *poisoned.into_inner(),
            };
            position_expanded_window(&expanded, settings, input)?;
            #[cfg(windows)]
            if let Ok(hwnd) = expanded.hwnd() {
                diag::snapshot("update_window_geometries:expanded-after-position", hwnd.0 as isize);
                diag::force_topmost(hwnd.0 as isize);
                diag::snapshot("update_window_geometries:expanded-after-force-topmost", hwnd.0 as isize);
            }
        }
    }
    diag::log_line("update_window_geometries:exit");
    Ok(())
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
                height: 174,
                x: 1706,
                y: 852,
                zoom_factor: 1.0,
            }
        );
        assert_eq!(compact_layout(2, 85.0, work_area, 1.0).width, 180);
        assert_eq!(compact_layout(2, 85.0, work_area, 1.0).height, 148);
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
        assert_eq!(layout.height, 261);
        assert_eq!(layout.x, 1813);
        assert_eq!(layout.y, 987);
        assert_eq!(layout.zoom_factor, 1.5);
    }
}
