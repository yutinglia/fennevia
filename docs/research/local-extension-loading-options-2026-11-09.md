<!-- SPDX-License-Identifier: MPL-2.0 -->

# 本機擴充套件載入方案研究：使用者側載情境

日期：2026-11-09。類型：文件與原始碼研究，**沒有實作或 runtime 驗證**。
Fennevia 基線：`6a0e32c4b8c1fa5dbe946fdf69bc1a60d2e94bb2`。
關聯提案：[`plans/020-local-extension-loader.md`](../../plans/020-local-extension-loader.md)。

## 1. 擁有者澄清與結論

擁有者明確說明目標是讓使用者下載別人提供的擴充套件後，像 Chrome 的
本機載入操作一樣加入並持續使用；不是要求開發者測試自己的程式碼。
因此「每次用開發 CLI 啟動」或「使用者自行送 Mozilla 簽章」不適合作為主流程。

建議把原本的「保存外部目錄並自動重載」改成：

**使用者選取本機套件 → 驗證與確認 → 匯入 Fennevia 管理的版本化副本 →
保存啟用狀態 → 正常啟動時以原生暫時安裝恢復。**

這是工程上的建議，不是已通過相容性測試的承諾。在 stock Firefox stable、
不修改簽章政策、不 patch Firefox、保持現有安全邊界的條件下，研究未找到
可把任意未簽章 WebExtension 真正永久安裝的另一個受支援入口。
管理副本改善檔案與更新可靠性；不能消除 temporary-addon 的啟動與資料語義差異。

已由原作者提供簽章 XPI 時，Firefox 的正常本機安裝仍更直接，應保留原生入口。
「操作像 Chrome」也不代表 Firefox 能執行所有 Chrome-only 擴充套件。

## 2. 研究範圍與版本

- Mozilla product-details 查詢回傳最新 stable **159.0.1**，
  `LAST_RELEASE_DATE=2026-11-06`；這是查詢資料，不是本機安裝資訊。
  [產品版本資料](https://product-details.mozilla.org/1.0/firefox_versions.json)。
- 透過 `gh api` 解析官方 `FIREFOX_159_0_1_RELEASE` tag，commit 為
  `6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213`。以下原始碼連結全部固定此 revision。
- 也比較前次計畫的 Firefox 157 pin
  `fdd757a2e09c9471cddf383e64e631e4ce178499`；159.0.1 的主要暫時安裝機制仍相同。
- 本機 Firefox version／BuildID、Browser Console、Browser Toolbox、
  乾淨 profile 載入與重啟：`not run`。沒有啟動、修改或安裝任何使用者擴充套件。
- 四個 loader canary 的前次索引與未完成範圍仍見計畫 §2；本次沒有採用
  canary 修正，亦未宣稱完成一次 Firefox stable 相容性 spike。

## 3. 替代方案比較

| 方案 | 對此需求的適合程度 | 主要取捨 |
| --- | --- | --- |
| 原作者提供簽章 XPI，使用 Firefox 原生安裝 | 已有簽章時最佳 | 正常持久安裝與原生管理，不需要 Fennevia 接管；不能解決只有未簽章檔案的情況。 |
| AMO unlisted／self-distribution 簽章 | 適合原作者發行，不是一般使用者的主流程 | 不必公開上架，但仍須上傳套件、使用作者帳號與處理後續版本；不是完全離線。 |
| `ExtensionSettings` 配合本機 XPI | 適合企業部署，不適合此 profile 的個人側載 | 支援本機 `file:///` XPI；在 stable 仍需簽章，不會變成任意資料夾載入器，且擴大政策／部署管理責任。 |
| 每次啟動暫時安裝外部資料夾 | 可滿足最小需求 | 實作較少，但移動／刪除 Downloads、外部原地修改與無固定 ID 都會影響可靠性。 |
| 管理副本＋每次啟動暫時安裝 | **此需求的建議方向** | 不依賴下載位置，更新可審閱且可保留前版；增加有界本機匯入／交易／清理責任，仍有暫時安裝限制。 |
| `web-ext run`／外部 launcher／remote debugging | 適合隔離開發 profile | 仍是暫時安裝，需工具或不同啟動入口；不能當成日常 profile 的透明持久方案。 |
| 換 ESR／Developer Edition／Nightly，或修改 Firefox 的簽章與內部安裝層 | 不採用於此專案 | 改變目前 stock stable 支援邊界或既有安全政策；沒有必要為此功能引入 fork 級維護。 |

Mozilla 說明 self-distribution 可以不在公開目錄上架，取得簽章後可從本機 XPI
安裝；送簽仍需上傳套件，部分建置產物另需提交原始碼。
[自主管理發行](https://extensionworkshop.com/documentation/publish/self-distribution/)、
[提交流程](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)。

企業文件仍要求 standard／beta 的一般安裝有簽章；`ExtensionSettings`
可使用本機 XPI URL，不能把「可從本機取檔」理解成「可免簽章永久安裝」。
[Enterprise distribution](https://extensionworkshop.com/documentation/enterprise/enterprise-distribution/)、
[ExtensionSettings](https://firefox-admin-docs.mozilla.org/reference/policies/extensionsettings/)。

`web-ext run` 是暫時安裝與檔案監看工具。其 `--keep-profile-changes` 文件
明示會保留包含關閉更新與允許靜默遠端連線等開發設定，不適合日常 profile；
`--pre-install` 是舊版 Firefox 相容路徑，不是本需求的現代永久安裝方案。
[web-ext command reference](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)。

一般 WebExtension 也不能充當這個安裝器：Firefox 的 `management.install()`
只支援指定來源的已簽章 theme，不能安裝任意另一個 extension。
[MDN management.install](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/management/install)。

## 4. 與使用者體驗直接相關的原始碼發現

### 4.1 API 可行，但同 ID 覆蓋仍須防護

[AddonManager][manager] 有 `readyPromise`、`isReady` 與
`installTemporaryAddon(nsIFile)`；[XPIInstall][install] 會讀取來源 manifest
並呼叫 `_activateAddon()`。它不是具有 `expectedExistingAddon` 或
compare-and-swap 參數的安裝交易。

`_activateAddon()` 可取代可見的同 ID addon；[暫時安裝測試][temporary-tests]
也包含覆蓋永久安裝與重啟恢復。服務自己的 queue 只能排除自己的競爭，
不能宣稱鎖住 about:addons、DevTools 或其他 privileged 工具。

管理副本讓預檢與安裝面對固定的一版檔案，可減少來源變動競爭；
仍須安裝前後核對身分、來源與 generation。遇到外部衝突就停止，
不以事後卸載不明 addon 當作回滾。嚴格不覆蓋保證若無法證明，仍是實作 blocker。

### 4.2 重啟恢復不等同原生啟動安裝

[ext-runtime.js][runtime] 只在 `APP_STARTUP` 發出 `runtime.onStartup`；
`ADDON_INSTALL` 走 `onInstalled` 的 `install` 分支。
[原生測試][runtime-tests] 明確檢查 temporary installation 的
`onStartupFired=false`、`onInstalledReason=install`、`temporary=true`。

因此每次重啟重新暫時安裝，不能保證第三方 extension 的歡迎頁、初始化、
資料 migration 或啟動監聽與正式安裝相同。Fennevia 不應改寫其背景程式、
偽造事件或攔截歡迎頁來隱藏差異。

服務等待第一個普通視窗就緒，也代表它可能晚於 session restore 的首批
網路請求／document-start。對必須覆蓋最早請求的攔截、代理或安全型
擴充套件，不能承諾完整啟動覆蓋；應使用原作者的正式簽章版本。
這是由 Fennevia 現有啟動時序推導的限制，尚未做時序實測。

### 4.3 停用、重載、移除、正常結束必須分開

[XPIDatabase][database] 的 `disable()`／`enable()` 改變原生停用狀態；
temporary `reload()` 走重新安裝，而不是先呼叫公開 `uninstall()`。
[ExtensionAddonObserver][extension] 在 `onUninstalled` 清理權限、UUID、
storage 及其他持久狀態；[清理測試][storage-tests] 與
[權限移除測試][permission-tests] 覆蓋相關行為。

[XPIProvider][provider] 的正常退出 `cleanupTemporaryAddons()` 走 bootstrap
清理，其已讀取路徑與公開 uninstall 的 `onUninstalled` 通知不同。
不能用「結束會移除暫時 addon」推導所有資料必然相同地清除，也不能反向
保證全部保留。storage、已授權 optional permissions、DNR、動態 content
scripts、menus 與 UUID 要各自跨真正程序重啟測試。

Mozilla 的 temporary-installation 與 persistent-testing 說明對 storage
有不同概括，另有 [Bug 1911427](https://bugzilla.mozilla.org/show_bug.cgi?id=1911427)
說明顯式移除後重新載入的清理是預期行為。因此本研究以版本化原始碼區分
操作，保留 runtime 待驗證，不以舊文件一句話宣稱全部資料都能保留。
[暫時安裝](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)、
[持久／重啟測試](https://extensionworkshop.com/documentation/develop/testing-persistent-and-restart-features/)。

**改進：日常「停用」採 disable；「移除」才 uninstall；正常關閉不額外
逐項 uninstall。** 不全域開啟 `keepStorageOnUninstall` 或 `keepUuidOnUninstall`，
因為它們會改變其他擴充套件的清理語義。Fennevia 不備份／還原第三方 storage
來模擬持久化。原計畫「不刪 storage」修正為「不直接操作 storage；原生移除
仍可能清除資料」。

### 4.4 不能只比對 permissions 陣列

[ExtensionData][extension] 提供 `loadManifest()`、`getRequiredPermissions()`、
`getRequestedPermissions()`、`manifestOptionalPermissions`、
`getManifestOrigins()` 與 data-collection permission 分類。
其中 origin 覆蓋 `permissions`、`host_permissions` 與 `content_scripts.matches`；
MV3 的 origin controls 又會改變 required／optional 分類。

建議在 privileged adapter 裡使用其正規化資料做預檢，再建立有界且不含原始
來源的 UI 摘要。不可只讀三個 raw JSON 陣列，也不可把 `comparePermissions()`
的提示用 domain comparison 當成完整安全等價判斷。
第一版對正規化權限集合的任何變更重新確認，避免先自製 match-pattern 包含關係。

[Bug 1974419](https://bugzilla.mozilla.org/show_bug.cgi?id=1974419)
修正過「只解析 manifest 就寫入 UUID／權限」的副作用；159.0.1 的
[回歸測試][permission-tests] 包含 `test_ExtensionData_does_not_write_permissions`。
候選預檢仍須驗證取消時沒有 UUID／pref／storage 副作用、沒有 extension
執行或網路請求，並確認目前 API 的資源清理方式。

原生 [XPIDatabase.isUsableAddon][database] 會查企業的 `mayInstallAddon`；
管理器仍應在最外層尊重安裝被停用的政策，不將 temporarilyInstalled 理解成
繞過企業／blocklist／私人瀏覽限制的授權。

### 4.5 固定檔案位置不等於固定 extension ID

[XPIInstall.generateTemporaryInstallID][install] 用來源路徑加上本次 session
值產生沒有明確 ID 的暫時識別。僅把檔案放到穩定路徑仍不能建立跨程序身分。
第一版要求作者提供可解析的固定 Gecko ID；欠缺時明確拒絕持續啟用，
不要求一般使用者自行編輯程式碼，也不悄悄替他改 manifest。

替無 ID 的未簽章副本配置本機 ID 可以另做設計，但涉及套件改寫、身分、
跨擴充套件通訊與後續更新配對，這次不把它視為已解決的通用相容功能。

### 4.6 接受本機封裝檔可以更貼近下載情境

[XPIProvider.isXPI][provider] 辨識 `.xpi` 與 `.zip`；暫時安裝入口亦接受
本機 archive。可以匯入原封不動的 archive 副本，交給 Firefox 解讀，
不必新增 ZIP 解壓到任意目錄的功能。

仍需對 archive 中的 manifest 與資源清單做有界、非執行預檢；拒絕
缺 manifest、外包一層目錄、重複／歧義名稱、traversal、超限與不支援格式。
資料夾則只複製選定根內的普通檔案／目錄，拒絕 reparse／symlink 與外部連結，
不得掃描其他位置尋找程式碼。

不支援 `.crx` 自動轉換或改寫 service worker。
Google 的 [Load unpacked 文件](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
是操作參考；實際能否執行仍以 Firefox 的
[API／manifest 相容性](https://extensionworkshop.com/documentation/develop/browser-compatibility/)
為準。

## 5. 對提案的具體調整

1. 主流程改成「加入並啟用」，確認內容明示之後重啟自動恢復；
   不讓使用者另外研究「本次載入」與「auto-load」兩組不一致狀態。
2. 使用 profile 內、Chrome Registry mapping 以外的專用資料根，保存版本化
   payload 與 bounded registry JSON。pref 只作總停用開關，避免長路徑／權限
   清單擠入一個大型 preference。資料格式不是公開設定備份格式。
3. 匯入後不保存原始 Downloads 路徑為執行來源；移動／刪除來源不影響恢復。
   每次載入驗證受管副本摘要，更新使用新 generation，不原地覆寫已授權檔案。
4. 更新由使用者選新本機檔案，先預檢 ID 與權限，再切換。
   保留舊版直到交易結果確認；不承諾第三方 migration／網路副作用可回滾。
5. 分開停用與移除，保留原生管理／除錯入口，沿用既有 widget inventory
   接收 extension action，不複製完整 about:addons。
6. 加入啟動工作 checkpoint；上次未完成時顯示「先前載入未完成」並等待重試，
   不把不明 crash 歸咎於某個 extension，也不進入無限啟動重試。
7. 額外持久化與本機檔案匯入／刪除需納入原提案的專門安全決策；
   本研究不是批准，沒有更改現行規範或 installer 刪除範圍。

以上資料根與原生預檢介面是 Fennevia 獨立設計，沒有複製舊專案或外部 loader
實作。研究只引用官方來源，沒有新增 bundled 第三方材料。

## 6. 後續可行性 gate

實作前先證明最小的端到端路徑，再投入管理 UI：

- 匯入一個固定 ID、無網路的 MV2 與 MV3 fixture；刪除原始下載副本後，
  兩次真正的 Firefox 程序啟動都能恢復受管副本。
- 分別量測 normal shutdown、reload、disable／enable、update、remove、
  abnormal exit 的事件與資料；不能拿 AddonManager 模擬 restart 當成完整瀏覽器重啟。
- 驗證 `storage.local`、UUID、optional／host／private grants 的實際結果；
  基本狀態若在正常重啟遺失，視為持續使用需求的 blocker，先停止擴建 UI。
  DNR／動態 scripts／menus 若無法維持，記錄支援限制，不能默默宣稱 Chrome 等價。
- 來源變動、同 ID 外部競爭、更新失敗、registry 寫入／rollback 失敗、
  startup checkpoint、safe start、兩個普通視窗與只有私人視窗啟動。
- 確認原生正常簽章安裝不受管理器影響；管理器不接管陌生 addon。
- 原生 manifest 預檢零執行、取消零持久副作用、有界 archive／資料夾讀取，
  以及受管根外零寫入／零刪除。

本次狀態：原始碼與文件比對完成；上述 runtime gate 全部 **not run**。
沒有執行 `npm run verify`、發佈、套件簽章、下載第三方 extension 或改變 Firefox 設定。

[manager]: https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/toolkit/mozapps/extensions/AddonManager.sys.mjs
[install]: https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/toolkit/mozapps/extensions/internal/XPIInstall.sys.mjs
[database]: https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/toolkit/mozapps/extensions/internal/XPIDatabase.sys.mjs
[provider]: https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/toolkit/mozapps/extensions/internal/XPIProvider.sys.mjs
[extension]: https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/toolkit/components/extensions/Extension.sys.mjs
[runtime]: https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/toolkit/components/extensions/parent/ext-runtime.js
[temporary-tests]: https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/toolkit/mozapps/extensions/test/xpcshell/test_temporary.js
[runtime-tests]: https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/toolkit/components/extensions/test/xpcshell/test_ext_runtime_onInstalled_and_onStartup.js
[storage-tests]: https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/toolkit/components/extensions/test/mochitest/test_ext_storage_cleanup.html
[permission-tests]: https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/toolkit/components/extensions/test/xpcshell/test_ext_permissions_uninstall.js
