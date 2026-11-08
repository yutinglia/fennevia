<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 159 本機擴充套件實作驗證

2026-11-09；功能 [#127](https://github.com/yutinglia/fennevia/issues/127)。
基線 `6a0e32c4b8c1fa5dbe946fdf69bc1a60d2e94bb2`，
`codex/local-extension-loader-plan` 工作樹。Windows 25H2 x64 build
26200.9711，官方 Firefox 159.0.1 release BuildID `20261102144711`。
原生可行性、安裝競爭及批准前的阻擋紀錄保留於
[可行性驗證](firefox-159-local-extension-feasibility.md)。

擁有者閱讀具體競爭說明後回答「接受此限制，繼續實作」。ADR-098 與現行
security／plan 文件已記錄此窄化批准。沒有放寬其他 generic-loader、
簽章、私人權限、native UI 或網路執行規則。

## 真實程序驗證

測試程式只接受獨立 marker-owned program copy 及新建、未註冊的開發 profile。
所有套件由測試產生，無網路行為、無個人瀏覽資料；沒有操作日常 Firefox。
Native picker 的選取由測試 factory 代入；實際 preflight、檔案 I/O、
generated bridge、AddonManager、UI 及程序重啟均未模擬。

```text
node tests/firefox-local-extensions-runtime.mjs --firefox <STOCK_TEST_COPY>/firefox.exe --profile <FRESH_TEST_PROFILE>
node tests/firefox-local-extensions-ui.mjs --firefox <STOCK_TEST_COPY>/firefox.exe --profile <ANOTHER_FRESH_TEST_PROFILE>
```

runtime harness 以非 content-accessible 的測試 resource mapping 載入產物，
退出前解除；UI harness 註冊原有 Chrome manifest 後載入 Bootstrap。
這是聚焦的開發驗證，沒有把 AutoConfig 安裝與完整發行矩陣標為通過。

| 實際檢查 | 結果 |
| --- | --- |
| 權限預覽包含 storage／選用 bookmarks；確認前沒有安裝 | 通過 |
| 取消清理副本、不安裝；只向 UI 傳回名稱／版本／權限及 opaque token | 通過 |
| 匯入資料夾，刪除原始四個 fixture 檔案後兩次完整程序重啟 | 自動恢復通過 |
| UUID、storage 計數及 fixture 的既有選用 grant | 保留；無 keepStorage／keepUuid pref 修改 |
| 停用、啟用、同 ID 更新至 2.0、移除 | 通過；停用不卸載 |
| 有效 ZIP 安裝／移除；多包一層目錄的 ZIP | 前者通過、後者拒絕 |
| 真實 Windows junction 資料夾 | 拒絕 |
| 已由另一工具載入的同 ID MV3 fixture | 拒絕、原項目保持 active |
| 自訂入口、預覽 Cancel 初始焦點、Escape、焦點返回、再次確認安裝 | 通過 |
| 本機管理 UI 存在時 shell 的 active gate | 保持啟用 |

最後完整 runtime 測試的 boots 為 1／2／5，onInstalled 為 1／2／4：
第二次程序內還有停用後啟用與更新；啟用現有自有 wrapper 不重新安裝，更新會
再次觸發安裝事件。不能把 boots 計數誤解為每個程序重複初始化。

## 因果錯誤及修正

- 測試初期使用 `file:` ESM import 被 Firefox 拒絕；改為測試限定 resource
  mapping。產品維持既有固定 `chrome://fennevia/` import。
- Windows `nsIFile.parent` 對根回傳 `C:`；`normalize()` 將它當成磁碟相對
  路徑解析為工作目錄。驗證需特別辨識 drive root，不能錯誤拒絕普通 profile。
- 實測最初 junction 被接受。追查 pinned `nsLocalFileWin.cpp`：
  `isDirectory()`／`isFile()` 只讀 attributes，**不會**執行 ResolveAndStat。
  改用 `fileSize` getter 先觸發 ResolveAndStat，再比對 `target`／`path`，
  並對每一層 ancestor 驗證；原生無法解析則拒絕。修改後真實 junction 測試通過。
- UI 焦點返回時按鈕仍 busy/disabled；改為解除本次 working 後等待 DOM 更新，
  再恢復焦點。實際 DOM 鍵盤測試通過。
- 舊 bundle 檢查把翻譯中的 “import limits” 當成 ESM 語法。改用 Node `vm.Script`
  編譯驗證 classic-script 語法，不執行 bundle；保留 IIFE、固定產物與動態 import 檢查。

Firefox source pin：`6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213`，
主要路徑為 `xpcom/io/nsLocalFileWin.cpp`、`xpcom/io/nsIFile.idl`、
`dom/chrome-webidl/IOUtils.webidl`、`toolkit/components/extensions/Extension.sys.mjs`、
`toolkit/mozapps/extensions/internal/XPIInstall.sys.mjs`。
參照[固定來源](https://github.com/mozilla-firefox/firefox/tree/6181e6b5f28a8fbae1d5c3ef6f6626b5a2180213)。
僅參考 API 行為，沒有複製其實作或舊專案 `.uc.js`。

## 邊界與尚未執行

第一版限制到 Windows SystemDrive，沒有可靠的 scripted drive-type API 證據時
不接受其他磁碟，避免把映射網路磁碟誤稱本機。原生 I/O 是路徑操作，沒有
handle-based 不可變快照；不能抵禦同一 OS 帳號在每個檢查之間惡意替換檔案。
雜湊、祖先檢查與限定管理根可拒絕已觀察的變更，不是 OS sandbox。

更新前保存舊 generation 與 pending 新 generation，設 interrupted checkpoint。
成功才提交新版本；失敗停止自動恢復，保留舊版供明確重試。崩潰或檔案權限
阻止清理時可能留下副本；不為了自動清除而擴大刪除範圍。退出時原生安裝
promise 必須完成；AsyncShutdown blocker 等待已排工作，沒有假取消 timeout。

Not run：第三方真實套件相容性、DNR／動態 scripts／menus、早期網路請求、
private／host grants 全矩陣、OS 強制終止各階段、多視窗完整實機矩陣、
Browser Toolbox 人工檢查、原生 picker 人工操作、螢幕閱讀器、高 DPI／forced
colors、完整 release matrices、GitHub-hosted CI。程序核心狀態機另有單元測試。
本紀錄不擴張 README 的已發布版本支援聲明。

## 最終本機 gate

- `npm run verify`：通過。format、lint、Svelte/TypeScript、510 個 tests、
  coverage（line 89.45%、function 95.95%）、PowerShell 7 固定清單、dependency
  audit、deterministic build 與 production scan 均成功。功能專屬測試為 18 個。
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./tests/run-static-powershell-tests.ps1`：
  Windows PowerShell 5.1 的全部 16 個固定測試檔通過。
- 最終 source build 再跑 runtime 三次程序與 UI harness：通過。
- `git diff --check`：通過。CSS 納入既有 scoped barrel，沒有新的 native style 洩漏。
- 未修改 workflow／runner；現有主要 job 是 Windows，未以 Linux act 冒充驗證。
  原生 installer source 未變更，其完整 Rust/WebView/UAC gate 此次 not run。
- 功能 gate 完成時尚未執行 commit、push、tag、release 或日常 profile 安裝。
  擁有者之後追加要求提交、推送 main 並發布；該流程另行記錄，不能倒推為本表已完成。

最終產物 SHA-256：

| 產物 | SHA-256 |
| --- | --- |
| ShellApp.js | `73b8a18745adb08ee2381c862ee7d7e07337547e662725320584da71f7eed305` |
| ShellStyles.sys.mjs | `45427f5d7a26069a7608937928a75005a4282f977567a003af69123213c9796f` |
| BridgeBoundary.sys.mjs | `1b9da9c6ab74f2ba523d4670466a41671c31b6288788c5fdcdc35db7b195931f` |

隔離測試 profile 的批次刪除遭自動核准審查拒絕，回覆只有 `blocked by policy`。
未繞過拒絕；本次 program copy、測試 profile 和本機驗證產物暫時保留。
日常 Firefox/profile 未改動，沒有新增 dependency 或正式套件中的 debug probe。
