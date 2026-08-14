# Master Plan：Stock Firefox Custom Browser Shell

## 1. 願景

在不自行編譯或 fork Firefox 的前提下，使用 stock Firefox 作為 Gecko/browser platform，建立一套可由現代 frontend toolchain 維護的自訂 browser chrome。

完成後，使用者可只看到本專案提供的 tabs、navigation、address bar、sidebar 與 command UI；Firefox 原生可見 shell 會被收起，但其底層 infrastructure 仍被保留並透過 bridge 使用。

## 2. 成功標準

- 不依賴 Alice0775、fx-autoconfig 等通用 loader 作 runtime。
- AutoConfig bootstrap 足夠小，可獨立理解、測試及維護。
- 使用 Chrome Registry 提供自有 `chrome://` / `resource://` namespace。
- UI framework 只管理自有 DOM，不與 Firefox native DOM reconciliation 互相踩踏。
- Firefox internals 只從集中 bridge 存取。
- custom shell 失敗時，Firefox 原生 UI 自動保留或可立即恢復。
- 最新 Firefox 更新造成 breakage 時，有可重現的研究與修復流程。
- 能在 clean profile 完成 tabs/navigation/basic address input/sidebar 的 MVP。

## 3. 非目標

- 通用 `.uc.js` loader 或 userscript manager。
- 支援多個歷史 Firefox 版本。
- 第一階段完整重寫 Urlbar suggestion engine、permission system、downloads backend 或 SessionStore。
- 第一階段 override `browser.xhtml`。
- 第一階段製作可公開給一般使用者的一鍵安裝產品。
- 模仿 Firefox fork 的 release/branding/update pipeline。

## 4. 架構原則

1. **Own, do not patch**：能建立自己的 UI，就不要 patch 原生 widget。
2. **Bridge, do not leak**：Firefox internal objects 不進入 Svelte component。
3. **Hide after healthy mount**：原生 UI 隱藏是最後一步，不是 startup 第一行。
4. **Preserve infrastructure**：保留 tab content、commands、dialogs、permissions、DevTools 等。
5. **Quarantine overrides**：所有 `override` 集中在明確的高風險區，預設為零。
6. **Evidence before abstraction**：先證明啟動鏈和 lifecycle，再建立 framework。

## 5. 階段與 Gate

### Phase 0：可行性與開發環境

交付：

- 獨立 dev profile 與可重現啟動方法。
- 記錄 Firefox version/build ID 的方式。
- Browser Console / Browser Toolbox 可用。
- AutoConfig 安裝、停用與移除草案。

Gate：不修改日用 profile 也能重現測試。

### Phase 1：最小 bootstrap 與 Chrome package

交付：

- AutoConfig 定位 profile chrome directory。
- `nsIComponentRegistrar.autoRegister()` 註冊本專案 manifest。
- 從自有 chrome/resource URI 載入單一 `.sys.mjs` entry。
- Fatal error 有完整 log，且不影響原生 browser UI。

Gate：最新 Firefox stable 冷啟動後，在 Browser Console 看到一次明確的 shell bootstrap success；移除 package 後 Firefox 回復正常。

### Phase 2：Window lifecycle 與 shell host

交付：

- 處理已存在、後續開啟、關閉的 browser windows。
- 為每個 window 建立獨立 XHTML hosts。
- mount health gate、cleanup、emergency toggle。
- 初始 UI 只顯示狀態，不隱藏 native UI。

Gate：normal/second/private window 沒有重複初始化或殘留 listener。

### Phase 3：Frontend build

交付：

- Svelte 5 + TypeScript + Vite production build spike。
- deterministic output，無 CDN、無 HMR runtime dependency。
- CSS 作用域策略；Tailwind 是否採用由 spike 決定。
- framework mount/unmount 與 Firefox XHTML environment 測試。

Gate：counter/state/event/CSS/unmount smoke test 在各 window 正常。

### Phase 4：Firefox bridge 與 state model

交付：

- tabs、selected tab、navigation state 的 typed adapters。
- 明確 event subscription/unsubscription。
- runtime capability checks 與可理解 error。
- UI 不直接持有 Firefox DOM element 作長期 state；必要 native handle 留在 bridge。

Gate：原生 tabs 改變時 shell state 一致，shell action 可安全反映到 Firefox。

### Phase 5：可用 UI slices

依序完成：

1. Custom tab strip MVP。
2. Back/forward/reload/new tab controls。
3. Address input MVP；先使用 Firefox navigation/search capability，不重寫完整 Urlbar engine。
4. Sidebar shell MVP。
5. Downloads/menu/command palette 等附加 UI。

Gate：在 native UI 仍可見時，custom shell 已能完成基本瀏覽。

### Phase 6：收起原生 UI

交付：

- 以 root attribute gate 隱藏 `navigator-toolbox`、native sidebar 等可見 shell。
- window controls、fullscreen、customize mode 的明確處理。
- custom mount 失敗時不設定 gate。
- emergency toggle 與 safe-start mechanism。

Gate：故意破壞 bundle、stylesheet 或 bridge 時仍可操作 Firefox 並恢復。

### Phase 7：Hardening 與更新流程

交付：

- Firefox update compatibility checklist。
- smoke test matrix 自動化可行部分。
- startup cache / build artifact / install script 行為文件化。
- internal API dependency inventory。
- override policy enforcement。

Gate：至少經歷一次 Firefox stable 更新並留下完整 research/fix record。

## 6. 初始目錄目標

```text
program/                       # 安裝到 Firefox program directory 的最小 AutoConfig files
profile/chrome/my-firefox-shell/
  chrome.manifest
  runtime/                     # build/install 後的 privileged runtime
  shell/                       # production UI assets
src/
  bootstrap/
  runtime/
  firefox/                     # Firefox internals boundary
  shell/                       # Svelte UI
  styles/
patches/                       # 預設空；高風險 overrides only
scripts/                       # build/install/dev-profile helpers
tests/
docs/
plans/
```

實際 layout 必須由 Phase 1 spike 驗證後再固定。

## 7. 主要風險

| 風險 | 對策 |
|---|---|
| AutoConfig/manifest registration 在新版改動 | loader canary + Searchfox + minimal bootstrap tests |
| Svelte runtime 與 XHTML/XUL namespace 不相容 | isolated host spike；不 mount native container |
| Firefox update 改 internal API | bridge 集中、capability checks、latest-only policy |
| 隱藏 UI 後無法操作 | mount gate、emergency toggle、safe-start、獨立 profile |
| `override` 令維護成本接近 fork | 預設禁止，獨立 ADR/issue/test 才可加入 |
| CSS 污染 Firefox native chrome | scoped root、停用 Tailwind Preflight、manifest style 精準套用 |
| 多 window/private lifecycle 漏 cleanup | WindowManager + per-window disposer + lifecycle tests |

## 8. Issue 執行原則

- Foundation issue 按依賴順序完成，不可直接跳到「隱藏全部 native UI」。
- Research issue 的成果必須是可重現 evidence 或明確否定結果，不是只列連結。
- 每個 UI issue 必須在 native UI 保留的狀態先完成驗證。
- 任何讓維護模型更像 Firefox fork 的方案，先更新 architecture decision 再實作。