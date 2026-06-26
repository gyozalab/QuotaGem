//! 視窗狀態診斷（Windows-only）。
//!
//! 前 4 次修復都失敗在「相信 Tauri 抽象」：`is_visible()` 走 `IsWindowVisible` 只看
//! WS_VISIBLE bit，一個 transparent + skipTaskbar 的 layered window 即使被完全遮住、
//! 推到螢幕外、alpha=0，仍回 true。`is_focused()` 走 `GetFocus()` 是 thread-local
//! 在背景 process 中可能誤判。
//!
//! 這個模組直接打 Win32 API 取得**真實**狀態，並寫入持久 log（GUI app 走 stderr
//! 會被 Windows 吞掉）。每個關鍵節點都呼叫 `snapshot()` 取得當下的：
//!   - foreground window HWND + process name（看誰拿著前景鎖）
//!   - 目標視窗的 ex-style（WS_EX_TOPMOST / WS_EX_LAYERED / WS_EX_NOACTIVATE bits）
//!   - IsWindowVisible 直接結果（跟 Tauri is_visible 對照）
//!   - GetWindowRect（看是不是被推到螢幕外）
//!   - z-order 上方的鄰居 HWND + 其 process（看是不是被別的視窗壓住）
//!
//! Non-Windows 平台所有 API 都退化為 no-op，編譯不依賴 windows-sys。

#[cfg(windows)]
mod windows_impl {
    use std::ffi::OsString;
    use std::fs::OpenOptions;
    use std::io::Write;
    use std::os::windows::ffi::OsStringExt;
    use std::path::PathBuf;
    use std::sync::OnceLock;
    use std::time::{SystemTime, UNIX_EPOCH};

    use windows_sys::Win32::Foundation::{CloseHandle, HWND};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindow, GetWindowLongPtrW, GetWindowRect,
        GetWindowThreadProcessId, IsWindowVisible, GWL_EXSTYLE, GW_HWNDPREV, WS_EX_LAYERED,
        WS_EX_NOACTIVATE, WS_EX_TOPMOST, WS_EX_TRANSPARENT,
    };

    static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

    fn log_path() -> &'static PathBuf {
        LOG_PATH.get_or_init(|| {
            let base = std::env::var_os("LOCALAPPDATA")
                .map(PathBuf::from)
                .unwrap_or_else(std::env::temp_dir);
            let dir = base.join("com.gyozalab.quotagem");
            let _ = std::fs::create_dir_all(&dir);
            dir.join("debug.log")
        })
    }

    fn now_iso() -> String {
        let ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        format!("{}", ms)
    }

    pub fn log_line(line: &str) {
        let entry = format!("[{}] {}\n", now_iso(), line);
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(log_path()) {
            let _ = f.write_all(entry.as_bytes());
        }
    }

    fn process_name_for_hwnd(hwnd: HWND) -> String {
        if hwnd.is_null() {
            return String::from("<null>");
        }
        unsafe {
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            if pid == 0 {
                return String::from("<no-pid>");
            }
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() {
                return format!("pid={}(open-failed)", pid);
            }
            let mut buf = [0u16; 260];
            let mut size: u32 = buf.len() as u32;
            // 第二參數 0 = full path; 不需要常數，傳 0 即可
            let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size);
            CloseHandle(handle);
            if ok == 0 {
                return format!("pid={}(name-failed)", pid);
            }
            let path = OsString::from_wide(&buf[..size as usize]);
            let display = path.to_string_lossy().into_owned();
            let name = display
                .rsplit(|c| c == '\\' || c == '/')
                .next()
                .unwrap_or(&display)
                .to_string();
            format!("{}(pid={})", name, pid)
        }
    }

    fn decode_ex_style(ex: isize) -> String {
        let ex = ex as u32;
        let mut bits: Vec<&str> = Vec::new();
        if ex & WS_EX_TOPMOST != 0 {
            bits.push("TOPMOST");
        }
        if ex & WS_EX_LAYERED != 0 {
            bits.push("LAYERED");
        }
        if ex & WS_EX_NOACTIVATE != 0 {
            bits.push("NOACTIVATE");
        }
        if ex & WS_EX_TRANSPARENT != 0 {
            bits.push("TRANSPARENT");
        }
        format!("0x{:08X}[{}]", ex, bits.join("|"))
    }

    /// 對單一 HWND 做完整狀態 dump。tag 是節點名稱（e.g. "show_expanded:before"）。
    pub fn snapshot(tag: &str, hwnd_raw: isize) {
        let hwnd = hwnd_raw as HWND;
        if hwnd.is_null() {
            log_line(&format!("{} hwnd=<null>", tag));
            return;
        }
        unsafe {
            let visible = IsWindowVisible(hwnd) != 0;
            let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
            let mut rect = std::mem::zeroed();
            let rect_ok = GetWindowRect(hwnd, &mut rect) != 0;
            let prev = GetWindow(hwnd, GW_HWNDPREV);
            let prev_proc = if prev.is_null() {
                String::from("<top>")
            } else {
                process_name_for_hwnd(prev)
            };
            let fg = GetForegroundWindow();
            let fg_proc = process_name_for_hwnd(fg);

            let rect_str = if rect_ok {
                format!(
                    "({},{})-({},{}) w={} h={}",
                    rect.left,
                    rect.top,
                    rect.right,
                    rect.bottom,
                    rect.right - rect.left,
                    rect.bottom - rect.top
                )
            } else {
                String::from("<rect-failed>")
            };

            log_line(&format!(
                "{} hwnd={:p} visible={} ex_style={} rect={} z_prev={:p}({}) fg={:p}({})",
                tag,
                hwnd,
                visible,
                decode_ex_style(ex_style),
                rect_str,
                prev,
                prev_proc,
                fg,
                fg_proc,
            ));
        }
    }

    /// 強制把目標 HWND 重綁為 topmost 並拉到 z-order 最頂。
    pub fn force_topmost(hwnd_raw: isize) -> bool {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            BringWindowToTop, SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        };
        let hwnd = hwnd_raw as HWND;
        if hwnd.is_null() {
            return false;
        }
        unsafe {
            let set_ok = SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            ) != 0;
            let bring_ok = BringWindowToTop(hwnd) != 0;
            log_line(&format!(
                "force_topmost hwnd={:p} SetWindowPos={} BringWindowToTop={}",
                hwnd, set_ok, bring_ok
            ));
            set_ok
        }
    }
}

#[cfg(windows)]
pub use windows_impl::{force_topmost, log_line, snapshot};

#[cfg(not(windows))]
pub fn log_line(_line: &str) {}

#[cfg(not(windows))]
pub fn snapshot(_tag: &str, _hwnd_raw: isize) {}

#[cfg(not(windows))]
pub fn force_topmost(_hwnd_raw: isize) -> bool {
    false
}
