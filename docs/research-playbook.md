# Firefox Research and Debugging Playbook

本文件定義 Firefox update、bootstrap failure、internal API breakage、DOM/CSS 行為改變時的研究順序。目標是找出 upstream 原因，而不是堆疊偶然可用的 workaround。

## 1. 先建立可重現 evidence

每次研究先記錄：

```text
Date:
Firefox version:
Build ID:
Channel:
OS:
Profile: clean / existing
Project commit:
Symptom:
First root error + stack:
Minimal reproduction:
```

使用獨立 profile；先停用其他 userChrome、extension、policy 與 experiment。清楚分辨：

- AutoConfig 沒執行
- manifest 沒註冊
- ESM import 失敗
- window lifecycle 時機錯誤
- bridge symbol 改變
- framework/CSS 問題
- startup cache/舊 artifact

## 2. 使用 Firefox 自己的工具

優先查看：

- Browser Console：startup/import/runtime exception。
- Browser Toolbox：browser chrome DOM、computed style、event listener、window global。
- `about:support`：version、build ID、profile path。
- `about:profiles`：確定正在測試的 profile。
- 必要時開啟更小的 diagnostic logging；不要長期預設輸出 browsing data。

先找第一個 root error。後續 `null`、missing element 或 mount failure 常只是 cascading result。

## 3. 先查維護中的 compatibility canary

這些專案不是 dependency，但通常會很早遇到 AutoConfig、sandbox、script loader、Chrome Registry 或 browser DOM 變動。

### Alice0775 userChrome.js

- Repository：https://github.com/alice0775/userChrome.js
- 查看最新 commit、最近 Firefox version directory、root loader、issue。
- 搜尋 exception text、Bug number、改名 symbol、`@version` 註記。
- Alice 常直接按 Firefox 版本保存修正；不要只看最舊或最熟悉的檔案。

### MrOtherGuy fx-autoconfig

- Repository：https://github.com/MrOtherGuy/fx-autoconfig
- 主要研究 program `config.js`、`chrome.manifest`、`boot.sys.mjs` 與最近 commit。
- 特別適合查 manifest registration、module loading、window lifecycle 與 startup cache。

### xiaoxiaoflood firefox-scripts

- Repository：https://github.com/xiaoxiaoflood/firefox-scripts
- 適合交叉確認 AutoConfig/userChromeJS bootstrap 與 privileged extension patterns。
- Repository 更新時間與特定 component 維護狀態要分開判斷。

### aminomancer uc.css.js

- Repository：https://github.com/aminomancer/uc.css.js
- 主要研究 `chrome.manifest`、content/skin/resource registration、style sheet service、script/resource override。
- 大量 override 是研究案例，不是本專案預設做法。

研究 loader fix 時，回答三個問題：

1. Firefox upstream 改了甚麼？
2. loader 的 fix 哪部分是 generic loader 歷史包袱？
3. 本專案真正需要的最小修正是甚麼？

## 4. Searchfox 是主要 source browser

- Searchfox：https://searchfox.org/
- Browser main window：https://searchfox.org/mozilla-central/source/browser/base/content/browser.xhtml
- Navigator toolbox：https://searchfox.org/mozilla-central/source/browser/base/content/navigator-toolbox.inc.xhtml

建議搜尋順序：

1. exact exception text。
2. 失效的 symbol/class/id/URI。
3. symbol definition。
4. 所有 callers/usages。
5. 附近 tests。
6. blame/annotate 與關聯 Bugzilla。

不要只看 definition。Firefox internal API 的真正 contract 往往要從 callers、tests 和 lifecycle 判斷。

常用搜尋概念：

```text
"symbolName"
"chrome://browser/content/..."
"element-id"
"TabOpen" / "TabSelect"
path:browser/components/...
```

Path 可能跨版本搬動，所以先以 symbol 搜尋，再記錄當前 path。

## 5. 官方 source、docs 與 bug history

- Official Firefox source：https://github.com/mozilla-firefox/firefox
- Firefox Source Docs：https://firefox-source-docs.mozilla.org/
- Chrome Registration：https://firefox-source-docs.mozilla.org/build/buildsystem/chrome-registration.html
- Tabbed Browser / `gBrowser`：https://firefox-source-docs.mozilla.org/browser/components/tabbrowser/docs/index.html
- AutoConfig：https://support.mozilla.org/en-US/kb/customizing-firefox-using-autoconfig
- Bugzilla：https://bugzilla.mozilla.org/

需要跨版本理解時：

- 找修改 symbol/path 的 commit。
- 讀 commit message 與 linked Bugzilla。
- 比較修改前後 callers/tests。
- 確認 change 已進 stable，而不是只在 Nightly/main。

## 6. GitHub code/history 查詢

GitHub 適合：

- 搜 official mirror 的 commit/PR。
- 比較 loader fix。
- 找其他 browser frontend 如何使用同一 Firefox API。
- 對 source path 做跨 repository search。

搜尋時盡量使用英文 exact term。例：

```text
repo:mozilla-firefox/firefox "nsIComponentRegistrar" "autoRegister"
repo:alice0775/userChrome.js "freezeBuiltins"
repo:MrOtherGuy/fx-autoconfig "startup cache"
repo:aminomancer/uc.css.js "override chrome://browser"
```

不要以 GitHub search snippet 代替完整 source context。

## 7. Firefox derivative 只作 pattern 參考

Floorp/Noraneko/Zen 等可以提供現代 frontend、build、patch 分層的設計線索，但它們可能：

- fork/build Firefox source
- 有自有 patch pipeline
- 使用 stock Firefox 不可用的 build-time hook

採用其 pattern 前，明確標記哪些能力依賴 fork，哪些可在本專案 runtime 使用。

## 8. 外部程式碼與 license

- 先查 repository/file license。
- 只抄 concept 不代表可複製具體 implementation。
- 需要複製時保留 attribution、license header 與來源 commit。
- 無明確 license 的程式碼預設不可直接納入。
- 將第三方 code 和本專案原創 code 分開，避免日後無法重新授權。

## 9. Research Record 模板

```markdown
## Environment
- Firefox:
- Build ID:
- OS:
- Profile:
- Project commit:

## Symptom

## Minimal reproduction

## Evidence
- Browser Console:
- Browser Toolbox:

## Sources checked
- Alice0775:
- fx-autoconfig:
- xiaoxiaoflood:
- aminomancer:
- Searchfox:
- Mozilla commit/Bugzilla:

## Upstream change

## Options considered

## Decision

## Validation

## Follow-up / compatibility risk
```

長期有效結論移到 `docs/`；一次性的版本事故可留在 issue，但必須有完整來源和驗證。