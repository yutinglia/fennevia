# Firefox Internals Boundary Map

這是初始邊界圖，不是穩定 API 清單。實作前必須用 Searchfox 驗證當前 Firefox source。

## 1. 本專案擁有的部分

| 區域 | Ownership |
|---|---|
| shell XHTML hosts | 本專案建立、mount、remove |
| tabs/navigation/address/sidebar 可見 UI | 本專案 |
| shell state/controllers | 本專案 |
| Firefox bridge adapters | 本專案，但依賴 internal API |
| build/install scripts | 本專案 |
| native UI active gate | 本專案 |

## 2. 必須保留的 Firefox infrastructure

| Infrastructure | 原因 |
|---|---|
| `browser.xhtml` main window | browser startup、includes、commands、popups、content layout |
| `gBrowser` / tab infrastructure | tabs、selected browser、switching、open/close |
| browser content/tabbox | 真正 web content viewport |
| command/controller sets | back/forward/reload、tab commands、keyboard behavior |
| popup/permission/dialog infrastructure | security-sensitive native UI |
| SessionStore | session/window/tab restore |
| Places | bookmarks/history backend |
| Downloads backend | download state與生命周期 |
| DevTools / Browser Toolbox | 開發、診斷與 fallback |
| notification boxes | site/browser notifications，直到有明確替代 |

初期可隱藏部分 native element，但不要 `remove()` 或讓 framework 接管 descendants。

## 3. 最終可能收起的可見 UI

| Native UI | 初期策略 |
|---|---|
| `#navigator-toolbox` | custom shell healthy 後以 root gate 隱藏 |
| `#TabsToolbar` / native tab strip | custom tab MVP 完成後隱藏 |
| native navbar / Urlbar | navigation/address MVP 完成後隱藏 |
| bookmarks toolbar | custom menu/sidebar 有替代後隱藏 |
| Firefox sidebar launcher/box | custom sidebar 完成後隱藏 |
| app menu / toolbar buttons | 逐項提供替代，不一次刪除 |
| titlebar/window controls | 最後單獨處理；平台差異大 |

## 4. 主要研究入口

### Main window

- `browser/base/content/browser.xhtml`
- 確認 CSP、stylesheet/script includes、popupsets、browser content 與 window attributes。

### Navigator toolbox

- `browser/base/content/navigator-toolbox.inc.xhtml`
- 確認 tabs toolbar、navbar、Urlbar、window controls、customization targets。

### Tabs

- Firefox Source Docs 的 Tabbed Browser / `gBrowser`。
- Searchfox 搜 `gBrowser`、`tabContainer`、`TabOpen`、`TabClose`、`TabSelect`。
- 不依賴舊 `<xul:tabbrowser>` DOM 假設。

初始 bridge 候選：

- `gBrowser.tabs`
- `gBrowser.selectedTab`
- `gBrowser.selectedBrowser`
- `gBrowser.addTab()` / `removeTab()`
- `gBrowser.tabContainer` events

所有候選在使用前做 runtime capability check。

### Navigation and commands

優先研究 Firefox command/controller，而不是重寫 history navigation。搜尋：

- Browser back/forward/reload/stop commands
- enabled state update
- selectedBrowser navigation state

自訂 button 應呼叫 bridge；component 不直接找 command DOM。

### Urlbar

研究範圍：

- `browser/components/urlbar/`
- native Urlbar custom element/controller/providers
- current URI/search submission path

MVP 只需基本 address/search submit。完整 suggestions、autofill、search modes、extension providers 另立 research plan。

### Places

研究：

- `PlacesUtils`
- browser Places UI helpers
- bookmarks/history observers

初期由 bridge 輸出 read-only snapshots，不讓 component 直接持有 Places result objects。

### SessionStore

研究：

- `browser/components/sessionstore/`
- window/tab restore timing
- custom workspace state 是否需要獨立 persistence

不要在早期取代 SessionStore。

### Downloads

研究 browser/toolkit downloads modules、events 與 native panels。初期只讀 state；下載安全 prompt 仍交給 Firefox。

### Sidebar

研究 `browser/components/sidebar/` 與當前 sidebar DOM。Custom sidebar 是獨立 UI，不應直接重用/patch 大量 native sidebar children。

## 5. Native handle 規則

- Native tab/browser/window object 只留在 bridge/runtime。
- UI 使用 project-generated stable id/snapshot。
- mapping 隨 TabClose/window unload 清理。
- 不把 privileged object 放入可序列化 store、DOM dataset 或 log。
- native event callback 轉成 immutable application event。

## 6. 需要獨立決策的高風險區

- `browser.xhtml` override
- tab custom element/internal JS override
- Urlbar provider replacement
- permission/identity popup replacement
- titlebar/window controls
- Agent sheet 全域 native styling
- SessionStore schema/persistence hook
- internal script monkey patch

任何上述工作先更新 `docs/architecture-decisions.md` 並建立專用 issue。