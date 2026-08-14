# Architecture

## 1. 系統邊界

本專案不是 Gecko embedder，也不是 Firefox fork。Firefox process、browser windows、content processes、tabs、networking、security model 與 session persistence 仍由 stock Firefox 提供。

本專案擁有的是可見 browser shell 與一層 privileged integration runtime。

```text
┌────────────────────────────────────────────┐
│ Svelte shell                               │
│ components / local state / accessibility   │
└───────────────────┬────────────────────────┘
                    │ plain typed contracts
┌───────────────────▼────────────────────────┐
│ Application state / controllers            │
└───────────────────┬────────────────────────┘
                    │ bridge API
┌───────────────────▼────────────────────────┐
│ Firefox bridge                             │
│ gBrowser / commands / Places / Downloads   │
└───────────────────┬────────────────────────┘
                    │ privileged APIs
┌───────────────────▼────────────────────────┐
│ Stock Firefox browser chrome + Gecko        │
└────────────────────────────────────────────┘
```

## 2. 啟動層

### AutoConfig

只做：

1. 找到 active profile 的 package manifest。
2. 註冊 Chrome Registry manifest。
3. 載入單一 privileged bootstrap entry。
4. 在 fatal failure 時留下 log 並退出。

不做 script discovery、hot reload、metadata、sandbox abstraction、UI 或 business logic。

### Chrome Registry package

提供穩定的 logical URI：

```text
chrome://my-firefox-shell/content/...
resource://my-firefox-shell/...
```

Manifest 初期只使用 `content` / `resource`，是否使用 `style` 由 CSS spike 決定。`override` 預設禁止。

注意：`resource://` 可能被 web content 引用；不可把 secret、private data 或不應暴露的檔案放進 content-accessible mapping。

## 3. Runtime 層

Process-global runtime 負責：

- bootstrap state
- window discovery
- global logging/version info
- capability checks
- safe-start state

Per-window runtime 負責：

- 建立 shell hosts
- 建立該 window 的 Firefox bridge
- mount/unmount frontend
- native UI gate
- listener/observer cleanup

每個 window 必須有單一 disposer；shutdown 順序不能依賴 GC。

## 4. Firefox Bridge

`src/firefox/` 是唯一允許直接依賴 Firefox internal APIs 的主要位置。

Bridge 應：

- 將 native object 轉換成小型 snapshot。
- 將 native events 轉換成穩定的 application events。
- 提供 explicit subscribe/unsubscribe。
- 在 runtime 驗證 required symbol。
- 以 capability 表達 optional feature，而不是讓 component 猜測。
- 記錄每個 internal dependency 的 Searchfox source/reference。

Bridge 不應：

- 把 `gBrowser`、native tab DOM 或 `Services` 暴露給 Svelte。
- 假裝 internal API 跨版本穩定。
- 吞掉 upstream exception。
- 在單一巨型 module 包含所有 Firefox 功能。

## 5. Frontend 層

Svelte 只 mount 到本專案建立的 XHTML element。不得讓 Svelte 接管 `navigator-toolbox`、`tabbrowser-tabbox`、native sidebar 或其他 Firefox-owned children。

Frontend 只處理：

- render
- local interaction state
- accessible UI semantics
- 呼叫 application controller/bridge contract

Frontend 不負責：

- profile/file access
- privileged module import
- tab DOM lifecycle
- SessionStore persistence
- Firefox command lookup

## 6. CSS 與 DOM isolation

優先順序：

1. 所有 selector 從唯一 shell root 開始。
2. 自有 class/name 使用 project prefix。
3. 不對 `button`、`input`、`*` 等套無 scope global rule。
4. 如採用 Tailwind，禁用 Preflight 並加 prefix。
5. 修改保留的 native UI 時，使用獨立 `native-integration.css`，每條規則必須有原因與 source reference。
6. Agent/Author sheet 只在普通 stylesheet 無法合理處理時使用。

## 7. Native UI Gate

建議 root state：

```text
[data-mfs-mounted]
[data-mfs-healthy]
[data-mfs-active]
[data-mfs-safe-start]
```

只有 `healthy` 後才可設定 `active`。隱藏規則必須依賴 `active`；bootstrap/runtime exception 必須移除或不設定該 attribute。

Native UI 初期只隱藏，不刪除。這保留 Firefox 對 commands、popup、customization、window controls 等可能存在的隱含依賴。

## 8. Override Policy

`chrome.manifest` 的 `override` 能在載入前替換 Firefox resource，威力接近 source patch。其風險包括：

- upstream 檔案新增必要 include/side effect 時不會自動獲得。
- 相對 URI resolution 改變。
- 每次 Firefox update 都要做 source diff。
- 容易把本專案維護模型推向未編譯的 fork。

因此：

- `patches/` 初期保持空白。
- 每個 override 一個獨立 issue/ADR。
- 必須 pin 被替換 upstream revision/path。
- replacement 必須盡量保持 upstream structure，並有 update diff 流程。
- 整份 `browser.xhtml` override 在初期禁止。

## 9. Build 與 Artifact

Source of truth 是 `src/`。Production artifact 應：

- deterministic
- self-contained
- 無 CDN、dev server、HMR dependency
- 不要求 Node.js 存在於 Firefox runtime
- 可由單一 package manager command 重建
- 有 source map 策略，但不得讓 profile 安裝流程依賴網路

是否輸出 IIFE、ES module 或混合 entry，由 bootstrap spike 根據 Firefox chrome environment 驗證，不在未測試前固定。

## 10. Security Model

本專案程式碼具有高度權限：

- 外部 dependency 數量應小。
- lockfile 必須提交。
- 禁止 runtime remote code。
- 不把 browsing data、history、file path 傳送到外部服務。
- 對 package upgrade 做 changelog/source review。
- debug logging 不應預設輸出敏感 URL/history；需要時明確開啟。

## 11. 初始模組建議

```text
src/
  bootstrap/
    entry.ts
  runtime/
    Runtime.ts
    WindowManager.ts
    WindowShell.ts
    Logger.ts
  firefox/
    capabilities.ts
    tabs.ts
    navigation.ts
    commands.ts
    places.ts
    downloads.ts
  app/
    controllers/
    state/
  shell/
    App.svelte
    components/
  styles/
    shell.css
    native-integration.css
```

這只是目標邊界；Phase 1/2 未完成前，不先建立空泛 framework。