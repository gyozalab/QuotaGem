# QuotaGem

繁體中文 | [English](./README.en.md)

QuotaGem 是一個為 `Claude`、`Codex` 與 `Antigravity` 用量而生的 Windows 系統匣小工具。

它讓你不用一直開網頁或切換分頁，就能在桌面角落快速看到：

- 目前用量
- 五小時與每週額度狀態
- 重設時間
- 警告與危險門檻

<img src="./docs/images/expanded-panel.png" alt="QuotaGem 展開面板" width="66%" />

## 2.0 重點

- 改用 Tauri 2 重寫，以 Rust 負責系統匣、視窗、取數、通知與開機自啟。
- 新增 `Antigravity` provider，並拆成 `Gemini` 與 `Claude and GPT` 兩組額度。
- 精簡面板改成圓環設計，主顯五小時用量，每週用量放在提示與展開面板。
- 展開面板使用整行進度條，Antigravity 會依模型群組分行顯示。
- 加入 single-instance 保護，重複開啟或開機自啟時只保留一個 QuotaGem。
- 建議以免安裝 portable zip 發布，安裝器先保留為建置產物。

## 畫面預覽

### 精簡面板

<img src="./docs/images/compact-panel.png" alt="QuotaGem 精簡面板" width="66%" />

### 單獨顯示 Claude 或 Codex

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

## 支援的用量來源

### Claude

透過內建 `Connect Claude` 流程取得必要 session 資訊，並用後端直接讀取 Claude 用量狀態。2.0 不再依賴隱藏瀏覽器視窗。

### Codex

讀取本機 `.codex/sessions` 中最新 session 紀錄，解析最後的 `token_count` 事件，顯示目前 rate limit 狀態。

### Antigravity

偵測本機已登入的 Antigravity language server，透過唯讀 RPC 取得額度摘要。QuotaGem 只讀取額度，不送出 prompt，也不消耗模型額度。

## 功能

- Windows 系統匣常駐，左鍵開關面板，右鍵顯示選單。
- `compact` 與 `expanded` 兩種面板。
- 三個 provider 可自由顯示或隱藏。
- 五小時與每週用量視覺化。
- 自訂 warning / danger 門檻。
- Windows 通知，可選全部通知或只通知危險狀態。
- 同一門檻跨刷新去重，避免重複提醒。
- 自動刷新與手動立即刷新。
- 深色與淺色主題。
- 透明度、縮放、時間格式與日期格式設定。
- 繁體中文與英文介面。
- 開機自啟，portable exe 搬動後重新執行即可更新啟動路徑。

## 下載使用

前往 [Releases](https://github.com/gyozalab/QuotaGem/releases) 頁面，下載最新的免安裝版：

```text
QuotaGem_2.0.0_x64-portable.zip
```

解壓縮後執行 `quotagem.exe`。若想讓 QuotaGem 跟著 Windows 啟動，可在設定面板開啟「開機自啟」。

目前 Windows 發布建議以 portable zip 為主。MSI / NSIS 安裝器仍會產出，但等程式碼簽章與 Microsoft Defender 誤判處理穩定後，再升為預設下載。

## 開發

QuotaGem 2.0 使用 Tauri 2、Rust、React 與 TypeScript。

```powershell
git clone https://github.com/gyozalab/QuotaGem.git
cd QuotaGem
npm install
npm run dev
```

## 建置

```powershell
npm test
npm run build
npm run tauri:build
npm run package:portable
```

portable zip 會輸出到：

```text
src-tauri\target\release\bundle\portable\QuotaGem_2.0.0_x64-portable.zip
```

## 截圖維護

README 使用的圖片清單與重截狀態記錄在 [README 截圖更新指南](./docs/screenshot-guide.md)。
