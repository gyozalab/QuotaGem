# QuotaGem

繁體中文 | [English](README.en.md)

Windows 系統匣 App，把 `Claude` 和 `Codex` 的用量整合在同一個地方查看。

## 功能

- 系統匣常駐，支援**展開面板**與**精簡面板**兩種模式
- 同時顯示兩個服務的用量，或單獨查看 `Claude` / `Codex`
- 用量進度條依比例變色（可自訂警告與危險門檻）
- 背景用量通知（單次 Session 與每週用量）
- `Connect Claude` 登入流程
- 面板個人化設定：
  - 主題
  - 透明度
  - 縮放比例
  - 語言
  - 時間格式
  - 日期格式
- 可選擇**開機自動啟動**

## 目前狀態

核心功能已可正常運作：

- 同一時間只顯示一個面板
- 展開面板與精簡面板可互相切換
- 面板置頂顯示
- 關閉按鈕為隱藏語意，不是真的結束程式
- Codex JSONL 解析（容錯處理格式錯誤的行）
- 展開面板高度動態調整
- QuotaGem 品牌圖示與系統匣圖示

## 技術架構

- `Electron`
- `React`
- `TypeScript`
- `Vite`
- `electron-store`
- `Vitest`
- `Testing Library`

## 快速開始

```powershell
npm install
npm run dev
```

## 驗證

```powershell
npm test
npm run build
```

## 專案結構

- `src/main` — Electron 主程序、系統匣連結、服務協調
- `src/renderer` — React UI、面板渲染、設定、主題樣式
- `src/providers` — Claude 與 Codex 用量讀取器
- `src/shared` — 共用狀態、用量格式化、i18n、面板主題輔助函式
- `public` — 系統匣與品牌圖示

## 注意事項

- 本專案以 **Windows 優先**開發
- 開機自動啟動功能已實作，但打包版本尚未完整驗證
- Claude 附加功能用量尚未支援

## 開發注意

請勿讓編譯產生的 `.js` 或 `.d.ts` 檔案出現在 `src/` 目錄內。

本專案曾有過舊的編譯檔殘留在 `src/`，導致程式載入舊版程式碼而非實際的 `.ts` 原始碼。
