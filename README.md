# QuotaGem

繁體中文 | [English](./README.en.md)

一個為 `Claude` 與 `Codex` 用量而生的 Windows 系統匣小工具。

它讓你不用一直打開網頁或切換分頁，就能在桌面上快速看到：

- 目前用量
- Session 與 Weekly 狀態
- 重設時間
- 警告與危險門檻

<img src="./docs/images/expanded-panel.png" alt="QuotaGem 展開面板" width="66%" />

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

<img src="./docs/images/tray-icon-list.png" alt="QuotaGem tray icon" width="66%" />

## 你可以期待什麼

- 系統匣常駐，打開就看
- `expanded` 與 `compact` 兩種面板
- 同時查看 `Claude` 與 `Codex`
- 也可以單獨只顯示 `Claude` 或 `Codex`
- 自訂警告與危險門檻
- 背景通知提醒
- 可調整主題、透明度與縮放
- 內建 `Connect Claude` 流程

## 為什麼做這個

QuotaGem 想解決的是很簡單的一件事：

當你在高頻使用 AI 工具時，不應該等到額度快撞線了才發現。

它不是大型 dashboard，也不是複雜的管理平台。  
它比較像一顆安靜地待在桌面角落的小寶石，讓你隨時知道現在的使用狀態。

## 快速開始

```powershell
Set-Location 'D:\coding\projects\QuotaGem'
npm install
npm run dev
```

## 目前狀態

目前核心體驗已經可用：

- 面板切換正常
- 主題與品牌已更新為 `QuotaGem`
- 通知、門檻、日期格式、面板縮放都已完成
- 新的獨立 repo 已建立

## 接下來

- 準備 Windows `.exe` 打包流程
- 驗證安裝版的開機啟動與 tray 行為
- 依實際使用情境持續微調體驗
