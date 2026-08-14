# Architecture Decisions

本文件記錄目前有效的高層決策。重大變更應新增條目，不要靜默改寫歷史理由；若取代舊決策，標記 Superseded。

## ADR-001：使用 Stock Firefox，而不是 Fork

**Status:** Accepted

使用官方 Firefox binary，透過 AutoConfig + Chrome Registry + privileged runtime 安裝 custom shell。

理由：避免下載、編譯、merge 整個 Firefox source 與維護 release pipeline。代價是依賴 unsupported internal APIs，並受 AutoConfig/runtime hook 限制。

## ADR-002：不建立通用 userChrome Loader

**Status:** Accepted

Bootstrap 不掃描 `.uc.js`、不解析 userscript metadata、不提供 arbitrary script sandbox/compatibility。

理由：本專案只有一個受控 application，通用 loader 的 discovery、legacy compatibility、cache 與 sandbox abstraction 都是無必要負擔。

Alice0775、fx-autoconfig 等只作相容性研究來源。

## ADR-003：以 Chrome Registry 作資源邊界

**Status:** Accepted pending spike validation

註冊自有 `chrome://my-firefox-shell/` 與 `resource://my-firefox-shell/` URI，讓 privileged modules、UI assets 與 styles 不依賴 absolute file path。

Phase 1 必須驗證 `autoRegister`、import timing、cache 與卸載行為。

## ADR-004：初期不 Override `browser.xhtml`

**Status:** Accepted

保留 Firefox 原本 main window markup與 includes，在載入後建立 isolated hosts，再收起可見 native shell。

理由：整份 override 需要追蹤 upstream 每次 structural change，維護成本接近未編譯的 fork，且容易漏掉 security/dialog/startup infrastructure。

## ADR-005：Framework 採 Isolated Islands

**Status:** Accepted

UI framework 只 mount 到本專案建立的 XHTML roots。Firefox-owned DOM 不由 framework diff/reconcile。

Svelte 5 是初始候選，仍需 production build/XHTML lifecycle spike。若 spike 失敗，可以更換 frontend implementation，而不改 bootstrap/bridge contract。

## ADR-006：Firefox Internals 只經 Bridge

**Status:** Accepted

所有 `gBrowser`、Services、Places、SessionStore、Downloads、commands 等依賴集中於 `src/firefox/` 與少量 runtime bootstrap。

理由：Firefox update 時能在小範圍修復，並保持 UI 可測試與可替換。

## ADR-007：Native UI 採 Health-gated Hide，不刪除

**Status:** Accepted

Custom shell mount 與 capability checks 成功後才設定 active attribute。CSS 根據 active state 收起 native UI。失敗時 native UI 保持可用。

理由：Firefox internal code 可能仍假設 native elements存在；這亦提供 recovery path。

## ADR-008：Overrides 隔離且預設為零

**Status:** Accepted

`patches/` 初期為空。新增任何 manifest `override`、monkey patch 或 internal script replacement 都需要專用 issue、source pin、測試和 removal plan。

## ADR-009：Latest Stable Only，Windows First

**Status:** Accepted

開發只保證當前 latest Firefox stable；第一個安裝與測試流程以 Windows 為主。不得為舊版加入 compatibility branch。跨平台 path/window behavior 應留有明確 abstraction，但在有測試環境前不宣稱支援。

## ADR-010：Build Artifact 不作 Source of Truth

**Status:** Accepted

所有 production JS/CSS 由 TypeScript/Svelte/source styles 生成。不得手動修 `dist/`。Build 必須 deterministic、無 runtime CDN、無 dev-server dependency。