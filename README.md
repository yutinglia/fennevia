# my-firefox-shell

在 **stock Firefox** 上建立自訂 browser chrome / browser shell 的實驗性專案。

本專案不打算成為另一個通用 `userChrome.js` loader，也不以長期堆疊 CSS/JS patch 為主要架構。目標是使用一個極小的 AutoConfig 啟動入口，註冊自有 Chrome Registry package，載入 privileged ES modules，然後由現代化 frontend stack 建立自己的瀏覽器介面。

> 狀態：規劃與可行性驗證階段。尚未提供可日用的實作。

## 核心方向

```text
Stock Firefox
  └─ minimal AutoConfig bootstrap
      └─ register chrome.manifest
          ├─ chrome://my-firefox-shell/...
          └─ resource://my-firefox-shell/...
              └─ privileged runtime / Firefox bridge
                  └─ Svelte shell
                      ├─ tabs
                      ├─ navigation
                      ├─ address bar
                      └─ sidebar
```

專案會保留 Firefox 的核心 browser infrastructure，例如 `gBrowser`、tab content、SessionStore、Places、Downloads、permissions、dialogs 與 DevTools；原生可見 UI 只會在自訂 shell 成功啟動後收起，而不是在 startup 時直接刪除。

## 初始技術選擇

- Firefox：只跟隨實作時的最新版 stable；不承諾舊版相容
- 第一優先平台：Windows；架構不得無故封死 Linux/macOS
- Bootstrap：AutoConfig，只做註冊 manifest 與載入單一入口
- Runtime：privileged `.sys.mjs`
- UI：Svelte 5 + TypeScript，先以可行性 spike 驗證
- Build：Vite，production bundle 必須 deterministic、無 CDN、無 runtime network dependency
- Styling：自有 scoped CSS；Tailwind 屬待驗證選項，使用時必須停用 Preflight 並加 prefix

## 文件入口

- [AGENTS.md](AGENTS.md)：所有 coding/research agent 必須遵守的規則
- [總體計劃](plans/000-master-plan.md)
- [Bootstrap 可行性驗證](plans/001-bootstrap-spike.md)
- [Shell 實作路線](plans/002-shell-roadmap.md)
- [架構](docs/architecture.md)
- [研究與除錯手冊](docs/research-playbook.md)
- [Firefox internals 邊界圖](docs/firefox-internals-map.md)
- [測試與復原](docs/testing-and-recovery.md)
- [架構決策](docs/architecture-decisions.md)

## 實作方式

實作工作以 GitHub Issues 為單位。Agent 應先閱讀 `AGENTS.md`、相關 plan/doc，以及完整 issue body；一個 PR 原則上只處理一個 issue。

## 重要警告

這個專案會執行具有 system principal 權限的程式碼，並使用 Firefox 未承諾穩定的 internal APIs。錯誤可能令 browser chrome 無法操作。所有開發與測試必須使用獨立 Firefox profile，並保留原生 UI fallback。