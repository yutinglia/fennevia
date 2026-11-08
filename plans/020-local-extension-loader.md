<!-- SPDX-License-Identifier: MPL-2.0 -->

# 本機 WebExtension 匯入與重啟自動恢復計畫

## 1. 狀態與目標

日期：2026-11-09。狀態：**已實作並推送 main，準備 0.20.0-beta.1**。
擁有者已批准本計畫與下述競爭限制，並後續要求 commit、push main、release。
實作 commit：`837a5f9`，Windows CI 與 CodeQL 已通過。
發布與剩餘驗證見 [`0.20 發布紀錄`](../docs/research/firefox-159-0.20.0-beta.1-release-validation.md)。

追蹤：[功能 #127](https://github.com/yutinglia/fennevia/issues/127)。

擁有者要求參考舊專案的 `local_extension_loader`，解決 Firefox 重啟後
需要再次手動載入本機擴充套件的問題，並明確要求本次先寫計畫。
原始回合僅規劃。擁有者隨後要求依計畫實作，並在閱讀具體風險說明後，
明確回答「接受此限制，繼續實作」。實作階段未操作日常 profile 或增加版本；
後續發行依擁有者明確指示另行準備，不沿用前一版本的人工驗證例外。

擁有者後續澄清：目標是讓使用者使用從別人下載的本機擴充套件，操作接近
Chrome 的本機載入；不是開發者除錯工具，也不要求使用者自行送簽。

預期結果：使用者選取 Firefox 相容的本機資料夾或 XPI／ZIP，確認「加入並啟用」；
Fennevia 匯入受管副本並保存啟用狀態，之後每次正常啟動透過原生
`AddonManager.installTemporaryAddon()` 恢復一次。原下載檔搬動或刪除不影響恢復。

這取代初稿的「保存外部來源目錄＋分開的 auto-load 選項」建議；
開發用直接連結目錄模式延後。比較與證據見
[`local-extension-loading-options-2026-11-09.md`](../docs/research/local-extension-loading-options-2026-11-09.md)。

這是「記住登錄並重新暫時安裝」，不是永久安裝未簽章擴充套件。
不改 `xpinstall.signatures.required`，不修改 Firefox 的簽章、blocklist、
企業政策、私人瀏覽權限或 WebExtension runtime。正式永久安裝仍走 Firefox
既有的簽章套件流程。已有原作者簽章 XPI 時，優先提供原生安裝入口；
unlisted signing 是作者可採用的發行方法，不是此功能要求使用者做的前置工作。

受管副本不會讓 temporary-addon 變成真正永久安裝；不能保證每個第三方
extension 的啟動事件、資料與最早網路請求覆蓋等同 Chrome。這是可行性 gate
要驗證並如實呈現的限制，不能透過修改 extension 程式碼來掩蓋。

## 2. 參考與已確認的事實

### 舊專案：僅作能力參考

- Repository：`yutinglia/my-firefox-custom`。
- 檢查時 HEAD：`7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5`；工作樹無修改。
- 參考檔案：`local_extension_loader.uc/README.md`、
  `local_extension_loader.uc/LocalExtensionLoader.uc.js` 的 API／生命週期位置，
  以及 `tests/local_extensions/README.md` 的案例索引。
- 相關歷史：`e0f379e6da86aeeb724f525c1445bc7cc485bfeb` 新增管理器；
  `6188c923d0d9b1ec9d0bdbcf2b61833d9b01dee7` 顯示自動載入狀態。
- 參考的能力索引：目錄選取、登錄、載入、重新載入、卸載、忘記登錄、
  每項目自動載入與原生除錯入口；最終操作語義以第 4 節為準。
- 不複製或改寫舊 `.uc.js`、測試 fixture、CSS、widget ID、事件與 timer 結構、
  全域旗標、數值、模組配置或強制放入原生 navbar 的做法。
  Fennevia 的服務生命週期、資料格式、UI 入口與驗證由本計畫獨立選擇。

### Mozilla 文件與原始碼

Mozilla 說明暫時安裝會在移除或重啟時結束，也明確提醒其安裝時權限提示與
正式安裝不同。資料保留必須區分正常退出、停用與顯式移除；後續原始碼研究
確認原生移除會觸發多種資料清理，不能直接沿用文件對 temporary storage 的概括。
來源：[Temporary installation in Firefox](https://www.extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)。

本次以專案已有證據的 Firefox 157 原始碼
`fdd757a2e09c9471cddf383e64e631e4ce178499` 核對以下定義、呼叫端與測試：

| 來源 | 計畫採用的證據 |
| --- | --- |
| [AddonManager.sys.mjs](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/toolkit/mozapps/extensions/AddonManager.sys.mjs) | `readyPromise`、`isReady`、`installTemporaryAddon(nsIFile)`；初始化前呼叫會失敗。 |
| [XPIInstall.sys.mjs](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/toolkit/mozapps/extensions/internal/XPIInstall.sys.mjs) | 暫時安裝使用原生 manifest／啟用流程，不檢查簽章，也不跨重啟保留安裝。 |
| [XPIDatabase.sys.mjs](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/toolkit/mozapps/extensions/internal/XPIDatabase.sys.mjs) | `AddonWrapper.temporarilyInstalled`、`sourceURI`、`reload()`；暫時擴充套件的 reload 重新走暫時安裝。 |
| [about:debugging 呼叫端](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/devtools/client/aboutdebugging/src/actions/debug-targets.js) | 安裝委派給 AddonManager；DevTools 的 reload 透過 addon target front，不能假設與 wrapper 完全同一介面。 |
| [test_temporary.js](https://github.com/mozilla-firefox/firefox/blob/fdd757a2e09c9471cddf383e64e631e4ce178499/toolkit/mozapps/extensions/test/xpcshell/test_temporary.js) | 測試包含暫時安裝覆蓋既有同 ID 安裝及重啟恢復，因此 Fennevia 必須自行拒絕不屬於自己的衝突，不能只依賴 API 註解。 |

另檢查 2026-11-07 Searchfox `firefox-main` 快照 `ac7b5e4b` 的
[AddonManager](https://searchfox.org/firefox-main/source/toolkit/mozapps/extensions/AddonManager.sys.mjs)
與 [XPIInstall](https://searchfox.org/firefox-main/source/toolkit/mozapps/extensions/internal/XPIInstall.sys.mjs)：
上述 readiness 與暫時安裝入口仍存在。這不是最新 stable 或本機執行驗證。
實作時須重新確認當日 stable、實際 BuildID、對應完整 source pin 與 API 行為。

後續研究已查得當日 stable 為 **159.0.1**，官方 release tag 指向
`6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213`；核對了暫時安裝、manifest
預檢、權限、停用／移除與 runtime 事件原始碼和測試。完整來源與推論邊界見
上述研究紀錄。尚無本機 159.0.1 BuildID 或 runtime 證據，不擴張支援聲明。

本次也以 `gh` 查詢四個 compatibility canary 的 HEAD 及相關 issue／PR：

| Canary | 查詢所得 HEAD |
| --- | --- |
| `alice0775/userChrome.js` | `2a0f15df251816dd9737b91180488139d07b12da` |
| `MrOtherGuy/fx-autoconfig` | `dfdab5684faffc112b76ccb1d8cab7f75da0102c` |
| `xiaoxiaoflood/firefox-scripts` | `a898ac59fb0ca3886c0c46b184fdbc037c83c037` |
| `aminomancer/uc.css.js` | `88514013ddc375f4770f4a35d8d07a91d6dd7d8f` |

搜尋結果主要涉及通用 loader／版本相容性；本計畫未採用其中任何修正。
完整目前版本目錄、相關變更 diff、問題本文與適用性分析留在階段 A，
不能把這次索引查詢當成完成相容性研究。

### Fennevia 整合基線

本次檢查基線為 `6a0e32c4b8c1fa5dbe946fdf69bc1a60d2e94bb2`。
`Bootstrap.sys.mjs` 組裝現有 process runtime 與 WindowManager；
`Runtime.sys.mjs` 已有程序唯一實例與 shutdown 清理。
`src/firefox/index.ts` 是生成 bridge 的固定入口；Customize 已分拆功能 section，
原生檔案選擇與有界設定交易已有 `src/firefox/settings/` 的邊界模式。
最近相關變更包含 `e3272d8`、`a8e44b3` 與 `6d82032`。
這些是整合位置的證據，不代表現有 bridge 已具備本功能。

## 3. 既有規範衝突與提案邊界

規劃時以下規則構成衝突；其窄化 supersession 已由下述批准與 ADR-098 記錄：

- `plans/004-single-line-toolbar-ui-ux.md` §3 明文將 local unpacked-extension
  loader 列為禁止項目。
- `docs/security-and-privacy.md` §4 禁止 generic runtime loader、arbitrary
  path resolver 與 plugin registry；§12、§15 保留原生 extension-install
  安全流程，並要求新 persistence／安裝流程進行專門審查。
- `AGENTS.md` 要求安全規則的例外取得擁有者明確批准，並在同一變更記入
  現行規範文件；ADR-002、ADR-012、ADR-014 不得被默認推翻。

擁有者已在 2026-11-09 批准依本計畫實作，下列窄化範圍由 ADR-098 與
`docs/security-and-privacy.md` 記錄；其餘 generic-loader 禁令維持。

1. 僅容許使用者明確選取並授權的本機 WebExtension，由 Firefox 原生 runtime
   以擴充套件的權限執行，不繼承管理器的 system principal；不提供 privileged
   使用者腳本、任意 JS import、目錄掃描或 loader 相容層。
2. 容許特定 profile 保存受管 payload、固定擴充套件 ID、啟用狀態、摘要與
   載入 checkpoint。寫入／清理僅限專用資料根的 ownership-proven 項目，
   不擴充成任意檔案 API，不保存原下載路徑，不納入設定匯出或 Sync。
3. 明確接受原生開發用暫時安裝不顯示一般安裝時權限提示的差異，
   定義首次信任與後續權限變更的重新確認；不宣稱等同 AMO 安裝安全流程。
4. 名稱／版本只作有界的本機 UI 顯示；路徑與原始 ID 留在 privileged 層，
   所有這些值仍禁止進入一般診斷與共享證據。

若不採用這個例外，保留 `about:debugging` 手動載入與正式簽章安裝；
不得以修改簽章 pref、替換 XPIProvider 或靜默削弱既有規範完成自動載入。

## 4. 第一版功能與操作語義

管理入口採用現有 **Customize → 本機擴充套件** 獨立 section。
沿用既有 Top host、customize session、鍵盤入口、focus restoration 與 popup holds，
不新增第六個 host、edge controller、原生 toolbar widget 或預設佈局變更。

| 操作 | 本次執行 | 後續啟動／資料 |
| --- | --- | --- |
| 加入並啟用 | 原生 picker → 暫存受管副本 → 原生 manifest 預檢 → 確認 → 暫時安裝 | 確認內容明示後續啟動會自動恢復；成功後保存啟用狀態。取消清理本次 staging，無持久登錄或安裝。 |
| 啟用／停用 | 僅對本服務擁有的 addon 呼叫原生 enable／disable；未載入時走驗證後安裝 | 同時保存後續啟動意圖；停用不呼叫 uninstall。 |
| 重新載入／重試 | 對目前受管版本驗證後 reload，或重試先前失敗項目 | 不讀取原下載位置、不偷偷採用外部修改。 |
| 從檔案更新 | 選取新本機來源，驗證同 ID 與權限，再切換新的受管 generation | 保留前版至結果確認；正常更新不先卸載舊 addon。 |
| 移除 | 明示原生卸載可能清除設定後，卸載仍由本服務擁有的安裝 | 移除登錄並清理 ownership-proven 副本；原始下載檔永不刪除。失敗保留恢復資訊。 |
| 停用全部本機載入 | 停止新工作，停用本服務擁有的項目 | 保存總開關為關閉；不卸載、不重設其他擴充套件。 |
| 原生管理／除錯 | 開啟固定 `about:addons`／`about:debugging` 入口 | 不讀取或修改其 DOM；供權限管理、診斷與手動恢復。 |

每列顯示文字名稱、版本、啟用開關、固定狀態與可用動作。
狀態包含停用、等待、載入中、已載入、副本損壞、衝突、需重新確認、
不相容、原生停用及失敗；操作中防止重複提交，結果以可存取的文字呈現。
支援繁體中文／英文、鍵盤、窄視窗、forced colors 與關閉後的確定性焦點恢復。
功能不可用時顯示原因與原生入口，不放置看似可用的假控制項。

第一版規劃接受根部直接有 `manifest.json` 的資料夾，以及有效的本機 XPI／ZIP
WebExtension；archive 原封不動複製並交 Firefox 載入，不解壓到任意位置。
要求原生 manifest 預檢能取得作者提供的固定 Gecko ID；無 ID 時明確說明
目前不支援持續啟用，不要求使用者編輯程式碼或悄悄改寫 manifest。
這比舊專案容許暫時 ID 的範圍更窄，目的是穩定比對來源、衝突與跨啟動狀態。
MV2／MV3 能力由實作時的 Firefox 決定，不轉譯 Chrome service worker 或 API。

本輪不做 CRX／Chrome-only 相容轉換、無 ID 套件改寫、檔案監看、熱重載、
批次 reload、開啟來源資料夾、網路下載／更新、遠端目錄、舊登錄自動匯入
或擴充套件商店。不自動搜尋來源，不建立 runtime signing／AMO 帳密功能。

## 5. 架構與資料流

### 程序服務與視窗介面

建立一個由既有 process runtime 擁有的 optional 本機擴充套件服務。
程序共用的是管理登錄與工作佇列，不是瀏覽資料；每個普通視窗透過自己的
bridge context 訂閱有界 snapshot、取得短期 opaque action token。
不把 native addon、nsIFile、原始 ID、路徑或 exception 暴露給 Svelte。
受管 payload 只能交給 Firefox WebExtension runtime，不能由 Fennevia import
或以 system principal 執行。

啟動次序：既有 safe-start 檢查 → 固定 bootstrap/runtime →
由既有 WindowManager 提供第一個普通視窗已就緒的訊號 →
等待 `AddonManager.readyPromise` 並重新確認服務仍有效 →
讀取已授權登錄 → 驗證受管副本 → 依序恢復已啟用項目。

不另設 browser-window observer，不以固定 sleep／polling 猜測 readiness，
也不讓擴充套件載入阻塞 shell health deadline。
同一程序只排一次啟動工作；第二個普通視窗訂閱現有服務。
沒有開啟管理 UI 也必須能恢復已授權項目。
單項失敗可隔離並繼續其他有效項目；共用 API／registry 失效則停止該服務。
若既有 shell health 失敗，仍立即恢復 native UI，不等待 addon I/O。
啟動前保存最小工作 checkpoint；上次未完成時等待明確重試，不無限重跑，
也不把未完成記錄直接當成某個 addon 導致 crash 的證據。

### 持久資料

提議使用 profile 資料根下的 `fennevia/local-extensions/`，位於既有
`chrome/fennevia/` package 與所有 resource mapping 之外。
它包含有界 `registry.json`、staging 與按隨機 entry key／generation 分隔的 payload。
使用明確 ownership marker、原子 registry 置換與可恢復交易，不原地覆寫已啟用版本。
這是使用者資料，不是 generated build artifact，也不加入安裝檔 manifest。

registry 保存 schema version、revision、有界項目列表、固定 Gecko ID、enabled、
內部相對 payload key、檔案摘要、已確認權限集合及未完成工作的閉合狀態。
原下載路徑、native handles、raw errors 不持久化。僅保留一個
`fennevia.localExtensions.enabled` preference 作總停用開關；初始關閉，
由首次「加入並啟用」的明確確認開啟，不要求重複同意相同動作。

實作時固定項目數、總大小、字串長度與 manifest 讀取上限，針對邊界測試，
另限制匯入檔案數、深度、總位元組與 archive 展開大小，不沿用舊專案數值。
所有寫入經單一服務序列化並核對 revision；
未知版本、重複 key／ID／payload、損壞或超限資料一律不自動載入，
保留原值供使用者明確重設，不靜默覆蓋或複製 raw JSON 到診斷備份。

匯入來源只來自原生 picker；拒絕 UNC／網路磁碟、device path、
相對路徑、URL、traversal 及無法確認安全邊界的 reparse point／junction。
資料夾只複製選定根內的普通檔案／目錄，拒絕內部 symlink／junction；
canonicalization 與父層檢查不可只做字串前綴比較。archive 預檢拒絕
traversal、重複／歧義 entry、缺 manifest、包在外層目錄與超限內容。
預檢與安裝只使用完成 staging 的同一份 payload，載入前重新驗證其摘要；
摘要是完整性檢查，不是簽章或防止同權限本機攻擊的保證。
來源／副本發生不明變更時拒絕載入，不掃描其他目錄補救。

registry／payload 不納入 Sync 或 ADR-093 設定備份，總開關不加入 Sync allowlist；
不被 native installer 的記住位置功能讀取或管理。它不是 secret vault；
能修改 profile 的本機程式仍在其信任邊界內。移除只清理 ownership-proven
副本；異常／不明檔案保留並報告，不擴大 installer 的刪除責任。

### 授權與擴充套件所有權

- 首次確認說明「匯入這一版並於後續啟動恢復」，以及自動載入與
  一般安裝權限提示的差異。Fennevia 不將這段說明冒充 Firefox 安全提示。
- 固定 ID 變更視為另一個 extension，不原地更新。候選預檢使用 Firefox
  `ExtensionData.loadManifest()` 與原生權限分類，涵蓋 required／requested／
  optional、host／content-script origins 與 data-collection 宣告。
  第一版對正規化集合變更重新確認；不只比對 raw `permissions`，
  不把提示用 domain comparison 當成完整權限等價檢查。
  預檢的無執行、無網路、取消零持久副作用及資源清理必須先 spike。
- 載入前以固定 ID 查詢現有 addon，拒絕永久、系統、企業管理及其他工具
  安裝的同 ID 項目，包括 `about:debugging` 安裝的暫時項目。
- 僅對本程序成功安裝且返回的 addon 建立所有權記錄；操作前重新比對
  `temporarilyInstalled`、固定 ID、受管 `sourceURI` 與當前 generation。
  ID 相同或路徑相同本身不構成所有權，reload 後重新取得並驗證結果。
- 使用單一 mutation queue 避免自己的多視窗／startup 操作競爭，
  透過 AddonManager 事件察覺外部替換、移除或停用。外部變更使舊 token
  失效，停止自動重試；使用者在原生管理介面停用／移除後，不自動復活，
  持久的 enabled 狀態須反映此意圖。關閉程序時的原生清理不可誤當成
  使用者要求下次停用；必須辨識自身動作、外部動作與 shutdown。
- 原生 API 的預檢與安裝不是已證明的原子操作；來源在驗證後被修改，
  或其他工具同時安裝同 ID，仍是必測競爭條件；受管副本僅減少來源競爭。
  真實 Firefox 159.0.1 spike 已重現此競爭。擁有者明確接受改為：拒絕已知衝突、
  偵測外部活動後停止接管與自動重試，但已開始的原生安裝仍可能取代外部
  同 ID 安裝。不得宣稱原子不覆蓋，也不以事後刪除或回滾陌生 addon 補救。
  證據與批准範圍見 `docs/research/firefox-159-local-extension-feasibility.md`。
- 新增時若安裝成功而登錄寫入失敗，應回滾本次擁有的暫時安裝；
  此處回滾採停用仍確認自有的結果、保留 interrupted checkpoint，避免以
  uninstall 清除套件資料；不宣稱交易完全撤銷。清理失敗顯示可恢復的部分成功，不能報告完全取消。重載後也不能保證
  擴充套件的副作用或 storage 可回滾，必須如實呈現原生結果。
- 更新在舊 addon 仍確定自有的條件下以新 payload 走原生同 ID 更新，
  成功後才提交新 generation；不先 uninstall。原生切換與 registry 提交
  之間的 crash／失敗須有恢復狀態，不能將兩者宣稱為單一原子交易。
  實作以舊 generation 加單一 pending generation 作 checkpoint，失敗後
  保留舊版供明確重試；在解決 pending 前不接受另一次更新。

## 6. 停止、失敗與隱私

- `fennevia.safeStart`、套件停用或 Firefox Troubleshoot Mode 時不排任何載入；
  後者在服務入口明確檢查，不假設 AutoConfig 必然替服務阻擋。
- 第一版不從私人視窗新增、列出或修改登錄；只有私人視窗的啟動不觸發自動載入，
  等第一個普通視窗出現再處理。擴充套件能否進入私人瀏覽仍由 Firefox 與
  使用者既有權限決定；Fennevia 不授予 private access。
- 關閉單一視窗只移除該視窗訂閱與 picker／confirmation；不卸載其他視窗
  使用的程序級 addon。既有緊急 fallback 仍先恢復該視窗原生 UI，
  不暗中改成全 profile 卸載；可由原生管理移除，或 safe start 後關閉總開關。
- 顯式 process runtime stop 停止接收工作、取消未開始項目、釋放 observer／
  listener，並在可操作階段以可等待的流程停用仍確認自有的 addon，釋放管理器
  handles；不以 uninstall 作一般 cleanup。Firefox 真正結束時交原生生命週期
  收尾，不另加逐項 uninstall 或在過晚 observer 中宣稱 async 清理完成。
- generation／abort guards 阻止 pending picker、readiness、I/O 或安裝結果
  回寫 disposed state。原生安裝若無取消 API，不能將 timeout 當作已取消；
  必須追蹤完成結果並清理仍屬於自己的 late success。詳細 shutdown hook
  與 pending-work drain 契約在 spike 後定案。
- 一般日誌只記 phase、固定 error code、能力名、Firefox version／BuildID、
  程序內 opaque token 與聚合計數。不得輸出名稱、ID、manifest、權限來源、
  路徑、原生錯誤訊息或原始 stack；沿用現有 redaction。
- AddonManager 自身可能在 Browser Console 顯示來源或擴充套件錯誤；
  不改寫 Firefox logger，也不把 raw Console 複製到共享報告。
- Fennevia 不讀取擴充套件 storage、背景頁、content script 資料或其瀏覽活動。
  管理器無網路請求、telemetry 或 update checker；被使用者授權的
  WebExtension 仍可依 Firefox 權限執行自身網路行為，不承諾替它隔離網路。
- Fennevia 不直接讀寫／清除第三方 storage，也不改全域 keepStorage／keepUuid
  prefs。明確移除委派的原生 uninstall 仍可能清除 storage、UUID、權限與
  動態規則；UI 必須說明，不能承諾保留。一般停用與正常退出不額外卸載。
  原始下載檔不刪除。
  停用／移除 Fennevia 後不再自動載入；登錄設定的移除採明確操作，
  不擴大 installer 的 ownership 刪除範圍。

## 7. 分階段交付與預計檔案

### A. 專門決策與最小 spike

1. 建立單一功能 issue，整理第 3 節的窄化安全例外與 threat model；
   取得擁有者對具體邊界的確認後，新增 ADR 並同步現行安全／計畫文件。
2. 記錄當日 Firefox stable version、BuildID、channel、OS、乾淨開發 profile
   分類與 Fennevia commit；更新 source pin、canary 相關變更／問題及 Bugzilla。
3. 在 marker-owned profile，以獨立撰寫、無外部網路的 fixture 證明
   匯入後刪除原來源仍可跨兩次程序重啟恢復；分別驗證 reload、disable／enable、
   update、remove、正常／異常退出的事件、storage、UUID、optional／private
   grants、動態 scripts／DNR／menus。不得以模擬 AddonManager restart 代替。
4. 檢查 Browser Console／Toolbox 第一因果事件。優先解決來源驗證、原生外部
   變更辨識、權限摘要與不可取消 promise 的限制；不可行時記錄 blocker。

正常重啟後 `storage.local`、固定身分與已授予權限能否維持，是一般使用情境的
可行性條件。若基本狀態會遺失，不以「可以再次載入」宣稱滿足持續使用需求，
應停止擴建管理 UI 並回報限制。第三方自行依 `onInstalled` 重設資料或開啟歡迎頁
則須列為套件相容性差異，不能由 Fennevia 偽造生命週期掩蓋。

### B. 服務與受限 bridge

- `src/firefox/local-extensions/`：原生 manifest／addon adapter、受限 payload
  匯入／清理、registry persistence／transaction、所有權、序列化 controller、
  生命週期與有界 snapshot contracts。
- `src/firefox/local-extensions.ts` 與 `src/firefox/index.ts`：固定 facade／export。
- `profile/chrome/fennevia/content/Bootstrap.sys.mjs`、
  `content/runtime/Runtime.sys.mjs`、`WindowManager.sys.mjs`：只增依賴接線、
  既有視窗就緒訊號與 deterministic cleanup，不把 feature 邏輯塞入 bootstrap。
- `src/app/local-extensions/`：ordinary state adapter，視窗內 action token、pending
  與結果狀態；不得讀寫路徑或直接接觸 Firefox API。

具體名稱可依 spike 調整，不預建 generic service container。
bridge 仍透過既有單一固定 ESM build 產生，AutoConfig 保持原有責任。

### C. 管理 UI

- `src/shell/features/local-extensions/`：獨立管理 section 與列元件。
- `CustomizePanel.svelte`、`CustomizeTabList.svelte` 與既有 i18n：只負責入口、
  組裝與翻譯；使用既有 session／focus／popup hold 與樣式 token。
- 原生 picker 和確認取消、跨視窗修改、副本損壞／錯誤狀態必須可實際操作；
  不新增套件、圖示 library 或遠端資源。

### D. 驗證、文件與可重現產物

- 新增有意義的 registry／ownership／lifecycle／UI contract tests，
  將測試 fixture 與 probe 保持在測試範圍，不能裝進正式 profile inventory。
- 更新 `docs/architecture-decisions.md`、`docs/architecture.md`、
  `docs/firefox-internals-map.md`、`docs/security-and-privacy.md`、
  `docs/security-controls.md`、`docs/testing-and-recovery.md` 與操作說明。
- 在 `plans/004-single-line-toolbar-ui-ux.md` 以新 ADR 標示禁止條款的精確
  supersession；保留其歷史，不刪除 generic loader 的禁止。
- 階段完成時同步 README、主計畫、roadmap 與 tracking issue #1；
  功能整合不自動代表發行，不先行增加版本／tag 或沿用舊版發行例外。
- 由 `npm run build` 重生 bridge／frontend／CSS 與 manifest hashes；
  只有安裝模型要求的產物可提交，不手改 generated files。

## 8. 驗收矩陣

| 類別 | 必須證明的行為 |
| --- | --- |
| 核心需求 | 選取第三方本機檔案／資料夾並確認 → 匯入 → 刪除原下載來源 → 完全結束 Firefox → 兩次再啟動；啟用項目各恢復一次，不需開管理 UI。停用項目不載入。 |
| 原生語義 | MV2／MV3 fixture、固定 ID、背景事件、早期 content script、storage／UUID／grants／DNR／動態 scripts／menus 跨重啟；區分 disable、reload、update、remove。不得宣稱等同永久安裝的 `runtime.onStartup`／`onInstalled`。 |
| 衝突與所有權 | 重複路徑／ID、永久與其他工具暫時安裝、外部 reload／disable／remove、manifest ID 改動、安裝途中來源／addon 被替換；陌生 addon 不被修改或卸載。 |
| 持久化與失敗 | staging 中斷、損壞 manifest／payload、超限／未知 registry、權限變更、切換／提交／回滾失敗與過期 checkpoint；既有記錄不靜默遺失，不進入啟動重試迴圈。 |
| 併發與清理 | 兩個普通視窗同時操作、重複點擊、pending picker／install 時關窗、runtime stop、晚到結果及 application shutdown；無重複服務、listener 或未處理 rejection。 |
| 恢復與私人瀏覽 | safe start、Troubleshoot Mode、總開關停用、shell failure／emergency fallback、只有私人視窗啟動；原生 UI 可用，private 權限未被提升。 |
| 路徑與隱私 | 資料夾與 archive 的 traversal、歧義名稱、超限、UNC／network drive、reparse／symlink；受管根外零寫入／刪除，原下載路徑不保存，敏感資料不進入 log、export、dataset。 |
| UI | 鍵盤全流程、取消零副作用、focus／hold 釋放、窄視窗、兩種語言、forced colors、原生管理入口及 extension toolbar inventory 更新。 |
| 套件 | source-to-artifact 可重現、固定 inventory、沒有 test fixture／probe、網路 API／任意 import／runtime 更新器；installer 不取得新外部路徑刪除權。 |

開發先跑受影響的 tests、lint、typecheck，整合後執行 `npm run verify`
及 Windows PowerShell 5.1 固定清單。GitHub Windows CI 是一般整合的最終 gate。
目前 workflow 另含 native installer 檢查，不能只因 root verify 成功就宣稱
完整 GitHub CI 已通過；未修改 installer 時不額外擴大其本機人工矩陣。

本功能的兩次真正程序啟動、ID 衝突與恢復 smoke 是核心需求證據；
完整跨硬體／無障礙／真實 Firefox 發行矩陣仍按 release 節奏執行。
若日後修改 workflow／runner，先評估 `.actrc` 與 `act -l`；現有主要
Windows job 無等價的普通 Linux Docker runner，不以 act 冒稱 Windows 驗證。

## 9. 實作與驗證狀態

- 已核對：上述本機原始碼、既有規範、舊專案精確 commit、Mozilla 定義／
  呼叫端／測試、目前 tracking issue #1 與 canary 索引。
- 初稿文件檢查已通過；本次研究修訂另檢查 diff、新文件空白、Markdown
  本機連結、計畫索引與僅文件的變更範圍，實際結果在交付摘要記錄。
- 已完成：ADR-098 窄化批准、受限持久化／服務／bridge、Customize 管理入口、
  en／zh-Hant 翻譯與 source-to-artifact build。普通路徑進一步限定 Windows
  SystemDrive；每項上限及恢復程序見 `docs/local-extensions.md`。
- 已通過：18 個功能單元測試，以及 Firefox 159.0.1 的真實重啟、來源刪除、
  儲存／UUID／optional grant、停用／啟用／更新／移除、同 ID 拒絕、ZIP、
  junction 與確認／取消／Escape／焦點返回測試。
- 本機完整 gate 與精確未執行範圍以
  `docs/research/firefox-159-local-extension-implementation.md` 完成紀錄為準。
  GitHub CI、完整真實 Firefox／硬體／第三方套件及 release matrices 不作已通過宣稱。
- 未新增 dependency、未複製外部實作，不需要新增 bundled third-party notice。
  後續若改為複製／改寫任何外部材料，須重新依 provenance 規範審查。
