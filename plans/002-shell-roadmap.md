# Shell 實作路線

本文件描述 bootstrap 成功後，custom browser chrome 應以甚麼順序建立。所有 UI 都先在 Firefox native UI 保留的狀態下驗證。

## Milestone A：Isolated Shell Host

建立每個 browser window 專屬的 XHTML host：

- top/chrome host
- optional sidebar host
- overlay host

要求：

- 使用 XHTML namespace 明確建立。
- host id/data attribute 由本專案 namespace 管理。
- Svelte 只管理 host descendants。
- host 可完整 remove，並執行 framework unmount。
- 不移動或刪除 Firefox native DOM。

完成後只 render diagnostic panel，例如 version、window type、mount status。

## Milestone B：Mount Gate 與 Recovery

建立兩個分離狀態：

- `mounted`：framework 成功 mount。
- `active`：健康檢查通過，允許收起 native UI。

第一階段永遠不自動進入 `active`，只驗證 state machine。必須加入：

- emergency keyboard toggle
- safe-start pref 或 sentinel
- fatal error banner/log
- cleanup on unload

## Milestone C：Frontend Build 與 Styling

驗證 Svelte 5 production bundle：

- state updates
- event handlers
- mount/unmount
- second/private window
- XHTML element namespace
- no runtime fetch/import from dev server

CSS 選項依序評估：

1. 單一 scoped stylesheet，只從 shell root 起始。
2. manifest `style` overlay 是否只用於載入 shell/native integration CSS。
3. Tailwind utility generation；如採用，禁用 Preflight 並使用 prefix。
4. Shadow DOM 只在確實解決 isolation 問題時考慮，不能妨礙 Firefox theme variables/accessibility。

## Milestone D：Firefox Bridge

先建立最小 interface，不做大型 service layer：

```ts
interface BrowserTabsBridge {
  snapshot(): TabSnapshot[];
  subscribe(listener: (event: TabEvent) => void): () => void;
  select(tabId: string): void;
  close(tabId: string): void;
  open(options?: OpenTabOptions): string;
}
```

同樣建立 navigation bridge。Native tab element/reference 不能成為 Svelte serializable state；bridge 自己維護 mapping。

## Milestone E：Custom Tab Strip MVP

功能順序：

1. 顯示 tabs、selected state、title、favicon fallback。
2. select/new/close。
3. pinned tabs。
4. loading/attention/audio state。
5. reorder/drag。
6. context actions。

前 1–3 完成前，不處理複雜 drag/drop 或 tab groups。

## Milestone F：Navigation 與 Address Input MVP

先完成：

- back/forward enabled state
- reload/stop
- new tab
- current URI/title/security placeholder
- input submit：URL 與 search 的基本分流

不要在 MVP 重寫完整 Firefox Urlbar providers、suggestions、search modes、extension integration。可先經由 Firefox 現有 command/navigation capability，後續另開 research issue。

## Milestone G：Sidebar MVP

建立 shell-owned sidebar layout，初期可只放：

- tabs/workspaces placeholder
- bookmarks/history adapter 的 read-only prototype
- settings/debug panel

Firefox native sidebar 保留，直到 custom sidebar 已能穩定 mount、resize、hide/show 和 cleanup。

## Milestone H：收起 Native Shell

只有 tabs、navigation、address input 和 recovery 都通過後才進行。

收起目標通常包括：

- `#navigator-toolbox`
- native tabs toolbar
- native navbar/urlbar
- bookmarks toolbar
- Firefox sidebar launcher/box

保留目標包括：

- browser content/tabbox
- commands/controllers
- popup/permission/dialog infrastructure
- notification UI，除非已有替代方案
- DevTools
- window controls，直到 custom titlebar 方案單獨驗證

使用 root attribute gate，不用永久全域 `display:none`。不要 `remove()`。

## Milestone I：Hardening

- normal/private/second window
- fullscreen
- customize mode
- browser restart/session restore
- failed build/missing CSS/missing entry
- startup cache
- update compatibility
- memory/listener leak checks
- install/update/uninstall scripts

## 延後功能

以下必須另開 plan/issue：

- 完整 Urlbar suggestion engine
- Firefox View replacement
- permissions/identity panel replacement
- downloads manager replacement
- extension toolbar/action replacement
- custom titlebar/window controls
- workspace/session model
- `browser.xhtml` 或 internal component override
- cross-platform installer/release packaging