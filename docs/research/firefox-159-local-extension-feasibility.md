<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 159 本機擴充套件可行性驗證

日期：2026-11-09。基線：`6a0e32c4b8c1fa5dbe946fdf69bc1a60d2e94bb2`，
分支 `codex/local-extension-loader-plan`，未提交的測試／文件變更。

擁有者在方案研究後明確要求「ok, follow this plan to impl」。這授權依
`plans/020-local-extension-loader.md` 的窄化邊界實作，沒有授權放寬其
「不覆蓋非自有安裝」規則。階段 A 的真實程序測試已執行；目前因該規則
存在可重現的阻擋條件，尚未建立產品管理器或 UI。

## 環境與方法

- Windows 25H2，build 26200.9711，x64。
- Firefox **159.0.1**，BuildID **20261102144711**，release channel。
- 從 Mozilla 官方 archive 取得 Windows x64 en-US 安裝檔，確認
  Authenticode 為 Valid、簽署者 Mozilla Corporation；僅解包至新建、
  marker-owned program-spike，沒有執行安裝器或更新日常 Firefox。
- `application.ini` SourceRepository：`https://hg.mozilla.org/releases/mozilla-release`；
  SourceStamp：`7b34a03a910d0385299f4a9f27aa585a786862d8`。
  Git release-tag source pin：`6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213`。
  兩者是不同版本控制系統的識別，不把 Git SHA 當作本機 BuildID。
- 新建 marker-owned、未註冊 profile；測試開始時僅有 marker 與 user.js，
  Firefox program 沒有 Fennevia AutoConfig；沒有其他使用者擴充套件。
- 用 headless Firefox、loopback Marionette 執行三次真正程序啟動及正常退出，
  每次呼叫原生 `AddonManager.installTemporaryAddon()`。
- 測試自己產生固定 ID 的 MV2／MV3 fixture，使用 `storage.local` 計數器、
  `runtime.onInstalled`／`runtime.onStartup` 與選用 `bookmarks` 權限。
  fixture 沒有網路請求，不存取實際書籤或瀏覽資料。
- 保持 `xpinstall.signatures.required=true`、keepStorage／keepUuid prefs 為 false。
  測試 grant 僅授予這兩個 fixture；不操作日常 profile。

命令形狀（實際本機路徑不納入共享證據）：

```text
node tests/firefox-local-extensions-spike.mjs --firefox <MARKER_OWNED_STOCK_COPY>/firefox.exe --profile <FRESH_MARKER_OWNED_PROFILE>
```

測試只接受 managed root 內的普通路徑、program／profile markers 與全新 profile。
重跑必須另建乾淨 profile，不能沿用已測試的 storage 影響計數。

## 已觀察結果

| 行為 | MV2 | MV3 |
| --- | --- | --- |
| 每次啟動前沒有保留已安裝 addon | 是 | 是 |
| 第一次載入 boots／installs／startups | 1／1／0 | 1／1／0 |
| 第一次完整重啟後 | 2／2／0 | 2／2／0 |
| 第二次完整重啟後 | 3／3／0 | 3／3／0 |
| UUID 跨兩次程序重啟相同 | 是 | 是 |
| 第一次載入後授予的選用權限保留 | 是 | 是 |

基本狀態保留在這兩個 fixture 上成立。每次重新暫時安裝仍觸發
`onInstalled`，不觸發 `onStartup`；不能對所有第三方套件宣稱正式安裝等價。
這是原生機制驗證，沒有證明 Fennevia 匯入、UI 或自動恢復已實作。

## 阻擋條件：原生安裝沒有條件式提交

最後一次程序啟動，用兩份由測試擁有、共用另一個固定 ID 的 fixture
模擬外部工具與本機管理器競爭；沒有使用真實第三方套件：

1. `getAddonByID()` 預檢回傳不存在。
2. 啟動來源 A 的 `installTemporaryAddon()`，不等待完成；立即啟動來源 B。
3. 訂閱安裝 listener，對 `onInstalling` 回傳 false。
4. 兩個 promise 都 fulfilled；`onInstalled` 順序為 A、B；最後來源是 B。
5. listener 回傳 false 沒有取消安裝。

原始碼解釋此結果：

- [installTemporaryAddon / _activateAddon][install] 在多個 await 後取得
  `oldAddon`，允許覆蓋同 ID；公開入口只接受檔案，沒有 expected-existing
  或 compare-and-swap 參數。
- `onInstalling` 是通知而非可以 veto 的安裝交易；單一 Fennevia queue
  不能鎖住其他 Firefox／DevTools 呼叫。
- 來源快照、前後檢查與事件偵測可以縮小／察覺競爭，不能撤銷已發生的
  外部套件停用、替換或其資料副作用。

因此計畫 §5 的「階段 A 若不能維持不覆蓋非自有安裝的邊界，記為 blocker」
已成立。**不能把安裝前後檢查實作成一項虛假的絕對保證。**
本次沒有替換、包裝或 patch Firefox 的 XPIProvider／XPIInstall，沒有更改
ID／manifest、簽章或企業政策來避開這個結果。

## 可供決策的具體調整（尚未批准）

選項 A：保持既定的絕不覆蓋條件。停在可行性驗證，保留 Firefox 原生簽章
安裝與手動暫時安裝入口；此條件下不交付目前設計的自動恢復功能。

選項 B：將承諾精確改為「拒絕已知衝突，偵測到競爭後停止接管」。其行為為：

- 呼叫前檢查同 ID 現有安裝，拒絕非自有項目；自己的工作逐項執行。
- 在預檢前開始監看原生安裝事件，呼叫前再核對當前狀態。
- 發現外部同 ID 活動後取消尚未開始的工作，已開始的原生 promise 等待結束；
  顯示衝突、保存停用意圖、不再自動重試。
- 只有能證明仍為本次返回且來源／generation 一致的自有 addon 才可停用；
  不卸載、重裝或回滾陌生 addon。
- 明確接受 API 中無法取消的競爭窗口：**已進行中的操作仍可能暫時取代
  外部同 ID 安裝，無法保證其執行狀態與資料副作用可復原。**
- 這是對原計畫 ownership 安全條件的收窄，不是等價實作；需擁有者明確
  接受後寫入 ADR、security 與計畫文件才可繼續。

不推薦為避免這個窗口去 patch Firefox、阻擋其他安裝器、靜默改寫 ID，
或建立會改變一般 extension 安裝行為的全域 hook。

## 驗證工具的版本適配

首次嘗試沿用舊 harness 的 `--remote-allow-system-access` 參數時，
`Marionette:SetContext` 被拒絕為 unsupported operation；未開始安裝 fixture。
查閱 Firefox 159 的 [RemoteAgent][remote] 後改用僅傳給該子程序的
`MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1`。重新建立全新 profile 後完成上述測試。
不把此設定加入產品 runtime、profile pref 或使用者環境。

## 未完成範圍

- 本機匯入副本、ZIP／XPI 邊界、manifest 預檢、權限預覽、registry／交易、
  UI、既有 WindowManager 接線：未實作，等待 ownership 決策。
- disable／enable、reload、更新／移除、異常退出、host／private grants、
  動態 scripts、DNR、menus、早期網路請求、shell health／fallback、多視窗：not run。
- Browser Console／Browser Toolbox 人工檢查與 GUI／鍵盤測試：not run；
  本次使用原生 API 和 fixture 頁面的有界計數證據，不以此替代 GUI 驗證。
- 完整 release matrix：not run；不擴張 Fennevia 支援版本聲明。

研究／測試沒有複製舊專案或外部 loader 程式碼；Marionette transport 從
本專案既有 harness 抽出共用，無新增依賴。原先方案研究保留為歷史紀錄。

[install]: https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/toolkit/mozapps/extensions/internal/XPIInstall.sys.mjs
[remote]: https://github.com/mozilla-firefox/firefox/blob/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213/remote/components/RemoteAgent.sys.mjs

## 後續決策與實作（同日追加）

上述「尚未批准／未實作」描述保留為批准前的研究時點。擁有者隨後明確回答
「接受此限制，繼續實作」，選擇選項 B；已寫入 ADR-098、security 文件及計畫。
後續產品匯入、管理 UI 與真實重啟結果見
[實作驗證](firefox-159-local-extension-implementation.md)。
