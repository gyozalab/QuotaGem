# QuotaGem

[English](./README.md) | [繁體中文](./README.zh-TW.md) | 简体中文

<img src="./docs/images/cover.png" alt="QuotaGem 封面图" width="60%" />

QuotaGem 是一个 Windows 系统托盘工具，用来让 AI 使用量在桌面上一眼可见。它可以显示 `Claude`、`Codex` 与 Google `Antigravity` 类型的使用状态，并在本地数据可用时提供本地历史用量统计。

它只专注一件安静但重要的事：在额度撞线前，让你先看见压力。

## 预览

### 大面板

<img src="./docs/images/expanded-panel.png" alt="QuotaGem 大面板" width="66%" />

### 小面板

<img src="./docs/images/compact-panel.png" alt="QuotaGem 小面板" width="66%" />

### 聚焦显示

<p>
  <img src="./docs/images/only-claude.png" alt="QuotaGem 只显示 Claude" width="49%" />
  <img src="./docs/images/only-codex.png" alt="QuotaGem 只显示 Codex" width="49%" />
</p>

### 设置页

<img src="./docs/images/settings-panel.png" alt="QuotaGem 设置页" width="66%" />

### 浅色主题

<img src="./docs/images/expanded-panel-white.png" alt="QuotaGem 浅色面板" width="66%" />

### 系统托盘入口

<img src="./docs/images/tray-icon-list.png" alt="QuotaGem 系统托盘入口" width="66%" />

## 功能

- 以 Windows 系统托盘为核心，快速打开与隐藏。
- 提供大面板与小面板，适合不同桌面布局。
- 显示项目可切换：显示所有、只显示 Claude、只显示 Codex、只显示 Antigravity。
- Codex 可选数据来源：官方数据或本地桌面数据。
- 支持通过 `ccusage` 读取兼容的本地历史用量。
- 显示每日、每周、每月与历史 token / 费用摘要。
- 最近 7 天用量图表，鼠标悬停可查看当天 token 与换算金额。
- 每个供应商可独立切换是否显示剩余用量。
- 可自定义警告与危险阈值。
- 支持后台通知提醒。
- 可调整主题、缩放、透明度、时间格式、日期格式与语言。
- 支持英文、繁体中文与简体中文界面。

## 数据来源

QuotaGem 会尽可能整合供应商状态与本地历史数据：

- `Claude`：通过连接流程获取使用状态，并在本地兼容数据存在时补充历史统计。
- `Codex`：默认使用官方数据，也可切换为读取用户目录下 `.codex` 的本地数据。
- `Antigravity`：在兼容本地数据存在时提供用量检测。
- 本地 token 与费用摘要会尽可能使用 `ccusage` 的模型用量拆分。

本地用量只读取电脑上已有的数据文件；解析本地历史数据不需要模型 API key。

## 下载

前往 [Releases](https://github.com/gyozalab/QuotaGem/releases) 页面，下载最新的 `QuotaGem-*.exe`。

Windows 版本为便携式执行文件，直接运行即可。

## 开发

```powershell
git clone https://github.com/gyozalab/QuotaGem.git
cd QuotaGem
npm install
npm run dev
```

## 构建

```powershell
npm run build
.\node_modules\.bin\electron-builder.cmd --win --x64
```

打包产物会输出到 `release/`。

## 备注

QuotaGem 是独立桌面工具。文档中的供应商名称仅用于描述此工具协助监看的使用量界面。
