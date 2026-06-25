# README 截圖更新指南

這份清單用來重截 `README.md` 與 `README.en.md` 目前引用的圖片。先替換必換項目，選配項目只有在畫面風格已明顯不同時再換。

## 必換圖片

| 檔名 | 要截的畫面 | 截圖標註 |
|---|---|---|
| `docs/images/expanded-panel.png` | 深色主題、展開面板、`Claude` / `Codex` / `Antigravity` 全開 | 需要看到 Antigravity 內的 `Gemini` 與 `Claude and GPT` 兩組，各自有五小時與每週用量 |
| `docs/images/compact-panel.png` | 深色主題、精簡面板、三個 provider 同列 | 需要看到圓環設計；Antigravity 圓環要呈現 Gemini / Claude and GPT 的雙色分割 |
| `docs/images/settings-panel.png` | 深色主題、設定面板 | 需要看到三個 provider 的顯示開關、開機自啟、警告/危險門檻與語系設定 |
| `docs/images/expanded-panel-white.png` | 淺色主題、展開面板、三個 provider 全開 | 跟 `expanded-panel.png` 同狀態，只換成淺色主題 |
| `docs/images/tray-icon-list.png` | Windows 系統匣展開或右鍵選單 | 需要看到 QuotaGem 的雙點 tray icon，畫面不要混入其他無關 app |

## 選配圖片

| 檔名 | 何時要換 | 截圖標註 |
|---|---|---|
| `docs/images/only-claude.png` | 只顯示單一 provider 的樣式有變時 | 設定只開 `Claude`，截展開面板 |
| `docs/images/only-codex.png` | 只顯示單一 provider 的樣式有變時 | 設定只開 `Codex`，截展開面板 |

## 不要誤換

- `docs/images/compact-panel-white.png`、`docs/images/settings-panel-white.png`、`docs/images/tray-icon.png` 目前沒有被 README 引用，除非刻意改 README 圖片清單，否則不需要處理。
- `docs/images/cover.png` 不是 README 目前引用的主圖，不屬於本輪必換清單。

## 截圖狀態

1. 語系使用繁體中文，縮放 `100%`，透明度約 `94%`。
2. 深色圖使用 `charcoal`；淺色圖切到白色/淺色主題。
3. 三個 provider 全開時，Antigravity 必須是可用狀態；如果沒有 live 資料，就用 UI preview 或 mock 狀態截圖。
4. 截 panel 本體即可，四周留 16-24px 空白，不要露出桌面私人資訊。
