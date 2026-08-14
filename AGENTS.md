# AGENTS.md

本文件對所有在此 repository 工作的 coding、research、review agent 生效。除非 issue 明確修改這些規則，否則不得繞過。

## 1. 開始工作前的閱讀順序

1. 本文件。
2. `plans/000-master-plan.md`。
3. 與 issue 相關的 `plans/` 與 `docs/`。
4. 完整 issue body、依賴 issue 和已連結的研究紀錄。
5. 現有程式碼與最近相關 commit。

若文件與 issue 衝突，以較新的明確決策為準；仍有衝突時，在 issue 留下阻塞原因，不要自行發明架構。

## 2. 專案定位與支援範圍

- 這是安裝在 **stock Firefox** 上的 custom Chrome package / browser frontend runtime。
- 不是通用 userscript loader，不支援任意 `.uc.js` discovery、metadata、sandbox 或舊腳本相容層。
- 初期只支援實作時的最新版 Firefox stable，以及 Windows 開發環境。
- 不為舊 Firefox 版本增加分支、polyfill 或相容 hack，除非 issue 明確要求。
- Firefox internal API 不穩定是已接受風險，但必須集中在 bridge/runtime layer。

## 3. 不可違反的架構規則

1. AutoConfig 只能是極小 bootstrap：定位 manifest、註冊 package、載入單一 privileged entry、記錄致命錯誤。
2. 自有程式碼使用獨立 `chrome://my-firefox-shell/` / `resource://my-firefox-shell/` namespace。
3. Svelte component 不得直接散落存取 `gBrowser`、`Services`、`PlacesUtils`、`SessionStore` 等 internal API；必須經 `src/firefox/` bridge。
4. Framework 只可管理本專案建立的 XHTML host；不得 mount 到 Firefox 擁有 children 的 native container。
5. 不得刪除 `browser.xhtml` 的核心 DOM 或 `tabbrowser` content infrastructure。
6. 原生 UI 只能在 custom shell 完整 mount 並通過健康檢查後，以 root attribute gate 收起。
7. 啟動失敗時原生 UI 必須保持可見；emergency fallback 不得在功能開發中被移除。
8. 所有 observer、listener、timer、stylesheet 和 framework root 都必須有 deterministic cleanup。
9. 禁止從 CDN 或網路動態載入 JS/CSS/font；禁止加入不必要的 `eval` / dynamic code execution。
10. `override chrome://...` 是最後手段。任何新 override 必須有獨立 issue、風險說明、upstream source pin、測試與移除策略。
11. 初期禁止 override 整份 `browser.xhtml`。
12. 不要把 loader project 的大段程式碼直接搬進本專案；先理解它解決的 upstream change，再寫最小實作。

## 4. Firefox 更新或異常時的必做研究流程

詳細流程見 `docs/research-playbook.md`。最低要求如下：

1. 記錄 Firefox version、build ID、channel、OS、profile 狀態與完整錯誤。
2. 在乾淨 dev profile 重現，確認不是舊 cache、殘留檔案或其他 customization。
3. 先看 Browser Console / Browser Toolbox 的第一個根因錯誤，不要只修後續 cascading errors。
4. 檢查相容性 canary：
   - `alice0775/userChrome.js`
   - `MrOtherGuy/fx-autoconfig`
   - `xiaoxiaoflood/firefox-scripts`
   - `aminomancer/uc.css.js`
5. 優先查看上述專案的最新 commit、current-version folder、issue/PR 和具體修正，而不是只讀 README。
6. 再到 Searchfox 搜尋失效 symbol、URI、DOM id、exception text 和呼叫者；檢查 blame/相關 Bugzilla。
7. 需要 Git 歷史或跨版本 diff 時，搜尋官方 `mozilla-firefox/firefox` repository 與相關 commit。
8. 將「upstream 改了甚麼」「loader 怎樣適配」「本專案採用甚麼最小修正」記錄在 issue。

這些 loader 是研究來源與相容性訊號，不是本專案 runtime dependency。

## 5. 來源優先級

由高至低：

1. 可重現的本地 evidence、Browser Console、Browser Toolbox。
2. 當前 Firefox source：Searchfox / 官方 `mozilla-firefox/firefox`。
3. Mozilla Firefox Source Docs、Bugzilla、upstream commit。
4. 維護中的 loader/customization repositories。
5. 其他 Firefox derivative source，例如 Floorp/Noraneko/Zen，用於 frontend pattern 參考。
6. Reddit、論壇、舊 blog，只能作線索，不能作最終依據。

複製外部程式碼前必須檢查 license，並在適當位置保留 provenance。不能把「看起來可用」當成授權允許。

## 6. 實作規則

- 一個 issue 一個清晰變更集；不要順便大改無關架構。
- 先寫最小 spike，再抽象化；未證實的 abstraction 不得先行擴張。
- 對 Firefox API 建立小型 adapter，輸出普通 TypeScript data/event interface。
- 在 privileged boundary 做 runtime validation；不要只依賴 TypeScript declaration。
- 對可能不存在或改名的 symbol，錯誤訊息必須包含 Firefox version、symbol/path 與處理階段。
- 不可吞掉例外。只有 bootstrap 最外層可以 catch fatal error 並恢復 native UI；仍必須 log stack。
- 不要假設只有一個 browser window；runtime 必須處理已存在與日後開啟的 window。
- private window、第二個 window、shutdown/unload 都是基本 lifecycle，不是後補功能。
- Build output 不手改；所有 `dist/` 內容必須可由 source 重建。
- 如採用 Tailwind：停用 Preflight，使用 project prefix，且 generated CSS 只能影響 shell root。

## 7. 測試最低要求

每個 runtime/UI issue 至少驗證：

- 冷啟動與重新啟動。
- custom shell 成功時正常顯示。
- 人為令 bundle/entry 失敗時原生 UI 仍可使用。
- 第二個 normal window。
- private window，或明確記錄為尚未支援並保持 native fallback。
- listener/observer cleanup 後不再收到事件。
- Browser Console 沒有新增未處理例外。

涉及隱藏 native UI 的 issue，還必須驗證 fullscreen、customize mode、Browser Toolbox 與 emergency toggle。

## 8. 文件與研究紀錄

- 長期有效的知識寫入 `docs/`；一次性實作步驟寫入 `plans/` 或 issue。
- 新架構取捨更新 `docs/architecture-decisions.md`。
- Firefox internal path/symbol 改動更新 `docs/firefox-internals-map.md`。
- 相容性事故至少在 issue 留下 research record：環境、症狀、來源、upstream change、修正、驗證。
- 不要寫沒有證據的「Firefox 應該會……」。不確定就建立 spike 或 research issue。

## 9. Definition of Done

Issue 完成必須同時符合：

- Acceptance criteria 全部可驗證。
- 相關 tests / smoke checks 已執行並記錄。
- 沒有破壞 native fallback。
- 新 Firefox internal dependency 已集中並有 source reference。
- 文件與 decision record 已同步。
- 沒有把高風險 workaround 偽裝成一般 abstraction。