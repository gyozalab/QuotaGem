# QuotaGem

繁體中文 | [English](./README.en.md)

一個為 `Claude`、`Codex` 與 `Antigravity` 用量而生的 Windows 系統匣小工具。

它讓你不用一直打開網頁或切換分頁，就能在桌面上快速看到：

- 目前用量
- 五小時（Session）與每週（Weekly）狀態
- 重設時間
- 警告與危險門檻

<img src="./docs/images/expanded-panel.png" alt="QuotaGem 展開面板" width="66%" />

## 畫面預覽

### 精簡面板

<img src="./docs/images/compact-panel.png" alt="QuotaGem 精簡面板" width="66%" />

### 單獨顯示某個服務

<p>
  <img src="./docs/images/only-claude.png" alt="QuotaGem 只顯示 Claude" width="49%" />
  <img src="./docs/images/only-codex.png" alt="QuotaGem 只顯示 Codex" width="49%" />
</p>

### 設定面板

<img src="./docs/images/settings-panel.png" alt="QuotaGem 設定面板" width="66%" />

### 淺色主題

<img src="./docs/images/expanded-panel-white.png" alt="QuotaGem 淺色展開面板" width="66%" />

### 系統匣圖示

<img src="./docs/images/tray-icon-list.png" alt="QuotaGem tray icon" width="33%" />

## 你可以期待什麼

- 系統匣常駐，打開就看
- `expanded` 與 `compact` 兩種面板
- 同時查看 `Claude`、`Codex` 與 `Antigravity`
- 也可以自由選擇只顯示其中一兩個
- 精簡面板直接顯示五小時額度，每週用量收在 hover 提示裡
- 自訂警告與危險門檻
- 背景通知提醒
- 可調整主題、透明度與縮放
- 開機自啟，跟著 Windows 一起醒來
- 繁體中文與英文介面切換
- 內建 `Connect Claude` 流程

## 為什麼做這個

QuotaGem 想解決的是很簡單的一件事：

當你在高頻使用 AI 工具時，不應該等到額度快撞線了才發現。

它不是大型 dashboard，也不是複雜的管理平台。  
它比較像一顆安靜地待在桌面角落的小寶石，讓你隨時知道現在的使用狀態。

底層用 Tauri（Rust + 系統內建 WebView2）打造，安裝檔個位數 MB、記憶體佔用低，常駐一整天也很安靜。

## 下載使用

前往 [Releases](https://github.com/gyozalab/QuotaGem/releases) 頁面，下載最新的免安裝版（`QuotaGem_*_x64-portable.zip`）。解壓縮後執行 `quotagem.exe`，需要跟著 Windows 啟動時，再到設定面板開啟開機自啟。

目前 Windows 發佈建議以免安裝版為主；安裝器會等程式碼簽章與 Microsoft Defender 誤判申訴穩定後再作為預設下載。開機自啟會指向目前執行的 `quotagem.exe` 路徑；如果你搬動 exe，從新位置執行一次即可更新 Windows 開機啟動項。

## 開發者

以 Tauri 2（Rust + React）開發，需先安裝 Rust 工具鏈與 Node.js。

```powershell
git clone https://github.com/gyozalab/QuotaGem.git
cd QuotaGem
npm install
npx tauri dev      # 開發模式
npx tauri build    # 建置 app 與 Windows bundle
npm run package:portable
```
