# QuotaGem

[English](./README.md) | 繁體中文 | [简体中文](./README.zh-CN.md)

<img src="./docs/images/cover.png" alt="QuotaGem 封面圖" width="60%" />

QuotaGem 是一個 Windows 系統匣工具，用來讓 AI 使用量保持在桌面上一眼可見。它可以顯示 `Claude`、`Codex` 與 Google `Antigravity` 類型的使用狀態，並在本機資料可用時提供本機歷史用量統計。

它只專注一件安靜但重要的事：在額度撞線前，讓你先看見壓力。

## 預覽

### 大面板

<img src="./docs/images/expanded-panel.png" alt="QuotaGem 大面板" width="66%" />

### 小面板

<img src="./docs/images/compact-panel.png" alt="QuotaGem 小面板" width="66%" />

### 聚焦顯示

<p>
  <img src="./docs/images/only-claude.png" alt="QuotaGem 只顯示 Claude" width="49%" />
  <img src="./docs/images/only-codex.png" alt="QuotaGem 只顯示 Codex" width="49%" />
</p>

### 設定頁

<img src="./docs/images/settings-panel.png" alt="QuotaGem 設定頁" width="66%" />

### 淺色主題

<img src="./docs/images/expanded-panel-white.png" alt="QuotaGem 淺色面板" width="66%" />

### 系統匣入口

<img src="./docs/images/tray-icon-list.png" alt="QuotaGem 系統匣入口" width="66%" />

## 功能

- 以 Windows 系統匣為核心，快速開啟與隱藏。
- 提供大面板與小面板，適合不同桌面佈局。
- 顯示項目可切換：顯示所有、只顯示 Claude、只顯示 Codex、只顯示 Antigravity。
- Codex 可選資料來源：官方資料或本機桌面資料。
- 支援透過 `ccusage` 讀取相容的本機歷史用量。
- 顯示每日、每週、每月與歷史 token / 費用摘要。
- 最近 7 天用量圖表，滑鼠停留可查看當日 token 與換算金額。
- 每個供應商可獨立切換是否顯示剩餘用量。
- 可自訂警告與危險門檻。
- 支援背景通知提醒。
- 可調整主題、縮放、透明度、時間格式、日期格式與語言。
- 支援英文、繁體中文與簡體中文介面。

## 資料來源

QuotaGem 會盡可能整合供應商狀態與本機歷史資料：

- `Claude`：透過連線流程取得使用狀態，並在本機相容資料存在時補充歷史統計。
- `Codex`：預設使用官方資料，也可切換為讀取使用者目錄下 `.codex` 的本機資料。
- `Antigravity`：在相容本機資料存在時提供用量偵測。
- 本機 token 與費用摘要會盡可能使用 `ccusage` 的模型用量拆分。

本機用量只讀取電腦上既有的資料檔案；解析本機歷史資料不需要模型 API key。

## 下載

前往 [Releases](https://github.com/gyozalab/QuotaGem/releases) 頁面，下載最新的 `QuotaGem-*.exe`。

Windows 版本為可攜式執行檔，直接執行即可。

## 開發

```powershell
git clone https://github.com/gyozalab/QuotaGem.git
cd QuotaGem
npm install
npm run dev
```

## 建置

```powershell
npm run build
.\node_modules\.bin\electron-builder.cmd --win --x64
```

打包產物會輸出到 `release/`。

## 備註

QuotaGem 是獨立桌面工具。文件中的供應商名稱僅用於描述此工具協助監看的使用量介面。
