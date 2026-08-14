# Bootstrap 與 Chrome Package 可行性 Spike

## 目的

用最少程式碼證明以下啟動鏈在當前 Firefox stable 可可靠運作：

```text
Firefox program AutoConfig
  → locate active profile chrome directory
  → register profile/chrome/my-firefox-shell/chrome.manifest
  → import one privileged Bootstrap.sys.mjs
  → observe browser windows
```

這個 spike 不建立通用 loader、不掃描 scripts、不解析 metadata，也不 mount 正式 UI。

## 需要回答的問題

1. AutoConfig 執行時可用的 global/privileged APIs 是甚麼？
2. `UChrm` 是否能可靠解析目前 profile 的 chrome directory？
3. `Components.manager.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(manifestFile)` 在當前 stable 是否可用？
4. manifest 註冊後，`ChromeUtils.importESModule()` 可否立即從自有 `chrome://` 或 `resource://` URI 載入 entry？
5. 註冊時機是否早於第一個 browser window 的必要 lifecycle hook？
6. 正常、第二個、private window 分別會在何時被觀察到？
7. 修改 bundle/manifest 後是否受 startup cache 影響？需要甚麼 deterministic invalidation 流程？
8. manifest 不存在、entry syntax error、import error 時，Firefox 是否仍以原生 UI 啟動？
9. 如何提供不進入 custom shell 的 safe-start switch？
10. 安裝與移除需改動哪些 Firefox program/profile files？

## 參考實作，但不可直接照抄

`MrOtherGuy/fx-autoconfig` 的 `program/config.js` 展示了一個值得驗證的最小模式：從 `UChrm` 找 manifest、呼叫 component registrar 的 `autoRegister()`，再 import 一個 `boot.sys.mjs`。這只作為 research seed；本專案不需要它後續的 script discovery/runtime。

同時檢查：

- `alice0775/userChrome.js` 最新對 AutoConfig、sandbox、compile/import 變更的適配。
- `xiaoxiaoflood/firefox-scripts` 的 current bootstrap。
- `aminomancer/uc.css.js` 如何註冊自有 content/skin/resource 與 overrides。
- Searchfox 中 `nsIComponentRegistrar.autoRegister`、Chrome Registry 與 browser startup 的當前 callers。

## 建議的臨時檔案

```text
spikes/bootstrap/
  program/
    defaults/pref/my-firefox-shell.js
    my-firefox-shell.cfg
  profile/chrome/my-firefox-shell/
    chrome.manifest
    Bootstrap.sys.mjs
```

最初 manifest 只應包含自有 namespace，例如：

```text
content my-firefox-shell ./
resource my-firefox-shell ./
```

不要在本 spike 使用 `override`。

## Bootstrap 行為要求

- 第一行遵守 AutoConfig 格式要求。
- 所有 path resolution 有明確錯誤訊息。
- manifest 不存在時只 log 並退出，不改變 browser UI。
- entry import 失敗時保留完整 stack。
- 同一 process 只初始化 global runtime 一次。
- runtime 對每個 browser window 只初始化一次。
- bootstrap 不建立 framework、CSS 或 UI。
- 不下載任何資源。

## Evidence 要求

Issue/PR 必須附上：

- Firefox version、build ID、channel、OS。
- 實際 program/profile layout。
- 冷啟動 Browser Console log。
- normal、second、private window 的 lifecycle log。
- manifest missing 與 entry syntax error 的失敗測試。
- 完整 uninstall 後的驗證。
- 使用過的 upstream source/loader commit link。

## Acceptance criteria

- 在 clean dev profile 可重複完成至少三次冷啟動。
- 自有 ESM entry 可從已註冊 URI 載入。
- 第二個 window 不會建立第二份 process-global runtime。
- private window 行為被明確定義並驗證。
- 任一 bootstrap failure 都不會隱藏 native UI。
- 移除 AutoConfig files 與 package 後，Firefox 正常啟動且沒有殘留錯誤。
- 結果更新到 `docs/architecture.md` 與 `docs/testing-and-recovery.md`。