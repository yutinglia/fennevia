<!-- SPDX-License-Identifier: MPL-2.0 -->

# GUI 安裝器完成計畫：Tauri、Firefox 掃描與路徑保存

## 1. 狀態與確認範圍

日期：2026-11-08；更新：2026-11-09。狀態：**原生安裝與封裝已實作，人工發行驗收未完成；未發布新版本**。

本次專案擁有者要求先寫計畫，並確認：

- 完成可供使用者操作的 GUI 安裝器。
- 掃描並記住 Firefox 執行檔與個人設定檔（Profile）資料夾。
- 新 GUI 的完整執行路徑不使用 PowerShell；現有 PowerShell 工具保留為手動備援。
- GUI 選型需考慮未來 Linux，因此本計畫選擇 Tauri 2、Svelte 5 與 Rust。
- 初次要求只交付計畫；擁有者之後明確批准依本計畫實作，並保留 PowerShell 備援。

Windows x64 是第一階段交付目標。Linux 是平台分層的設計需求，尚未取得
Firefox runtime、安裝位置、提權、發行格式或復原驗證，不宣稱 Linux 支援。
「config locations」專指 Profile，沒有擴張成設定備份檔管理或讀取瀏覽資料。

這是直接擁有者需求，沒有新 issue 編號。既有 #4、#39、#57 是歷史基礎，
不是本次已完成的追蹤項目。ADR-095 記錄已接受的技術方向；現行 ADR-018、
ADR-033、ADR-036、ADR-048、ADR-049 的安全契約在交付前仍然有效。

## 2. 已確認的現況與缺口

檢查基準：`5ad1eccf84ede8e5776ff1bcb27140079f5ce032`。

| 現況證據 | 對計畫的影響 |
| --- | --- |
| `scripts/gui/FenneviaSetup.cs` 目前只啟動 Windows PowerShell 5.1，實際畫面在 `scripts/lib/FenneviaGui.psm1` | 只換 EXE 外殼無法符合需求，必須移除新 GUI 對腳本宿主的依賴 |
| `Discovery.ps1` 已讀取 Mozilla registry 的 CurrentVersion、Program Files、`profiles.ini` 與 `installs.ini` | 掃描不是從零開始；以現有行為作為移植與補足多版本、重複、失效路徑處理的基準 |
| GUI 的 session 與限時 UAC continuation 已存在，沒有一般使用者跨次啟動的路徑保存功能 | 新增獨立的使用者本機偏好；不能把 UAC state 或 ownership 當成最近路徑資料庫 |
| `scripts/lib/installer/` 分離 Common、Discovery、Ownership、Planning、Transaction、Public | Rust 依相同責任移植，保留單一安裝格式與相同安全行為 |
| `901d4d3` 修正 PowerShell GUI 事件作用域與 DPI；`a8e44b3` 加強安裝器邊界 | 有具體歷史維護成本，但沒有本次重現證據，不把使用者提到的所有問題歸因於單一原因 |
| `tests/fennevia-gui.Tests.ps1`、安裝／發行 suites 已覆蓋多項安全邊界 | 將重要案例提升為新舊引擎共用的契約 fixtures；不以新 UI 測試取代既有回歸 |
| 發行器目前假設小型 C# launcher，並驗證完整 release tree | Tauri、Rust worker、WebView2 都必須進入獨立的發行清單與來源審查 |

既有證據包含 `docs/research/fennevia-installer-validation.md`、
`docs/testing-and-recovery.md` 安裝器與 GUI 段落，以及 #4、#39、#57 的需求。
初次規劃只檢查文件、程式與歷史，不把歷史 Firefox／GUI 驗證視為新方案通過。

## 3. GUI 技術決策

**選定：Tauri 2 + Svelte 5/TypeScript + Rust 安裝核心。**
使用靜態 Vite frontend，不需要 SvelteKit server、Node runtime、遠端頁面或 CDN。

| 方案 | 適合之處 | 本專案取捨 |
| --- | --- | --- |
| Tauri 2 + Svelte + Rust | Windows／Linux 平台方向；沿用 Svelte 經驗；Rust 可承接檔案、交易與平台邊界 | 選用。新增 Rust 工具鏈與 WebView 部署成本，必須先證明離線啟動與安全提權 |
| C# / WPF / .NET 10 LTS | Windows UI、資料繫結與 .NET API；可自行攜帶 runtime | 若只有 Windows 是合理選項，但 WPF 本身只在 Windows 執行，不符合目前的未來 Linux 方向 |
| Avalonia / C# | 跨平台桌面 UI，可用 .NET 實作核心 | 可行備選；本案優先沿用既有 Svelte 技能，避免再建立 XAML UI 技術棧 |
| WinUI 3 或原生 C# WinForms | Windows 原生桌面開發 | 不提供本案需要的 Linux UI 共用方向；換成 C# WinForms 也不能直接沿用腳本事件實作 |

這是依專案需求的選型判斷，不是「Tauri 天生更穩定」的宣稱。跨平台 UI 也
不會自動使 Firefox 系統目錄、權限或套件管理行為跨平台。

官方依據（查閱日期 2026-11-08）：

- [Tauri 平台先決條件](https://v2.tauri.app/start/prerequisites/)：Windows 使用
  WebView2，Linux 有 WebKitGTK 等系統相依性；要分別驗證部署。
- [Tauri Windows 發行與 WebView2 選項](https://v2.tauri.app/distribute/windows-installer/)：
  支援下載 bootstrapper、離線安裝及 fixed runtime，不能直接假設每台機器都有 runtime。
- [Tauri 安全模型](https://v2.tauri.app/security/)與
  [capabilities](https://v2.tauri.app/security/capabilities/)：限制 renderer 的命令權限，
  backend 仍須自行驗證所有輸入。
- [WPF 概觀](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/overview/)與
  [Avalonia Windows 說明](https://avaloniaui.net/avalonia/windows/)：比較平台與 UI 技術方向。

第一階段沿用可解壓執行的 release ZIP。預定附帶經審查、固定版本的 WebView2
runtime，讓全新、離線 Windows 也可啟動；這會明顯增加下載大小，且 runtime
安全更新必須隨後續套件維護。大小、啟動時間與可重現性在 P1 實測後記錄。
Tauri 的 MSI/NSIS bundler 選項不能直接套用成「已完成 Firefox 安裝」；它們
處理桌面 app 的分發，不取代本案的 Firefox 雙根目錄交易。

## 4. 使用者流程

1. **開始與掃描**：顯示套件版本；自動執行一次有限、唯讀掃描。畫面可取消、
   重掃及手動瀏覽，不以啟動 GUI 作為安裝同意。
2. **選擇 Firefox 與 Profile**：分開列出候選與已保存組合。顯示版本／BuildID、
   Profile 名稱、預設標記、有效／失效狀態；必要時展開本機路徑來分辨同名項目。
   第一次不預選預設 Profile；保存的組合也必須明確點選「使用此組合」。
3. **保存位置**：提供「記住這組位置」與獨立的保存動作。保存只保存通過驗證的
   選擇，不會順便安裝。可刪除單組或清除全部記錄；失效項目可重新定位。
4. **狀態與操作**：提供 Status、Install、Update、Repair、Disable、Enable、
   Uninstall。依現有 ownership 與檔案狀態決定可用動作並解釋阻擋原因。
   同一 Firefox program root 不得以另一個 Profile 覆寫既有配對。
5. **預檢與確認**：再次辨識兩個目標；預設 Profile 需額外確認。依 release
   metadata 顯示測試過的 Firefox 範圍；呈現相對路徑計畫、版本變動與需提權的理由。
6. **執行**：確認這次計畫後才開始。有需要時顯示「以系統管理員繼續」；
   取消 UAC 留在原畫面。顯示真實階段／已處理操作數，不顯示虛構百分比。
7. **結果**：分清成功、無需變更、已回復、需人工復原與保存位置失敗。
   提供去識別化診斷與現有備援操作文件。完成安裝不自動啟動 Firefox。

重新選擇目標、重新掃描發現目標改變、套件改變或 ownership 改變，立即使
預覽與同意失效。舊 scan／status 的遲到結果不能覆寫新選擇。

掃描與預檢可取消。進入 managed-file mutation 後不能以關閉視窗或強制終止
worker 當成取消；只在交易安全邊界停止並完成 rollback。若 UI 意外結束，
worker 須完成或安全回復；無法確認的結果保留 journal，下一次明確阻擋。

UI 使用標準視窗框架、單一主要動作、固定前後步驟與結果區。支援 English／繁體
中文、鍵盤完整操作、焦點恢復、螢幕閱讀器狀態公告、系統色彩、100–200% DPI
與文字放大。長路徑不擠掉按鈕，錯誤貼近欄位，重掃不跳動既有選擇。

## 5. 掃描契約

### Firefox 程式

- 讀取目前使用者與系統的 Mozilla registry，明確處理 32／64-bit views，
  在有界範圍內列舉版本項目，並檢查既有 Program Files 常見候選。
- 合併曾保存位置與使用者透過原生 file picker 指定的 `firefox.exe`。
- 不遞迴掃描整顆磁碟、網路分享、其他使用者家目錄或所有執行程序的命令列。
- canonicalize、去重，驗證檔案與 `application.ini` 的 Firefox 身分、版本與 BuildID；
  channel／架構若需新增判定來源，先固定來源並加入 internals map。
- 偵測到 Beta、Nightly、ESR、Store／受管理包裝或不明架構，不因此宣稱支援；
  列為不支援或待人工確認的候選，禁止猜測可寫路徑或繞過包裝限制。
- 個別候選失效不使整體掃描失敗；以固定分類顯示不可用，完整路徑不進入日誌。

### Profile

- 只從目前使用者 Firefox data root 的 `profiles.ini`、`installs.ini`，以及
  使用者已保存／手動選定的位置建立候選。
- 正確處理 `IsRelative`、絕對路徑、同名不同路徑、重複項目、檔案不存在、
  搬移、空白／Unicode 路徑及讀取權限不足；解析大小與筆數必須有上限。
- 不推測 Profile 和某個 executable 的關聯；沒有可靠關聯時請使用者明確配對。
- 手動選資料夾不等於准許安裝：release 仍要求 Registered 或合法既有 ownership
  證據。Development 模式保持 marker-owned 邊界，不因 GUI 而開放任意 Profile。
- 不讀取 `prefs.js`、cookies、history、bookmark、登入資料或頁面內容做識別。
- 掃描只讀；儲存位置才寫入 GUI 偏好。可寫性測試安排於明確預檢，沿用
  精確 create/delete probe 與零殘留要求，不能混稱成純唯讀掃描。

## 6. 保存位置與隱私

建議 Windows 路徑：`%LOCALAPPDATA%\Fennevia\Setup\targets.json`。
這是新 GUI 的本機偏好，不是 Firefox 設定、套件來源或安裝 ownership。

- Version 1 envelope：`schemaVersion`、`targets`；每組只含隨機 ID、
  `firefoxPath`、`profilePath`。最多 10 組、64 KiB，絕對本機 canonical 路徑。
- 不保存 Profile 名稱、default 狀態、版本／BuildID、歷史操作、套件路徑、
  plan hash、同意、管理員憑證或任何瀏覽資料；這些狀態要即時取得。
- 明確保存；沒有勾選或按保存就不建立檔案。超過上限要求先移除一組，
  不悄悄淘汰。忘記位置不移除 Firefox 或 Fennevia。
- 原使用者權限下建立 owner-only、非 reparse 的檔案／目錄；驗證 ancestor，
  以同目錄暫存及原子替換寫入，限定大小、欄位與路徑型別。
- 缺檔視為空清單；損壞、未知 schema 或權限不符時顯示可恢復錯誤，
  不執行任何保存內容、不自動覆蓋。提供明確清除操作。
- 載入後仍逐組重新驗證，失效記錄標記為不可用，不自動換到 Firefox default。
- 並行 GUI 保存採版本檢查／互斥，衝突要求重新載入，不靜默丟失其他修改。
- 安裝成功但偏好寫入失敗，分別呈現結果，不宣稱安裝失敗或再次執行交易。
- 提權 worker 不讀寫 GUI 偏好，也不使用提權帳號的 AppData 代替原使用者。
- 完整路徑僅供使用者主動展開的本機目標檢視；一般診斷、複製報告與 shared
  evidence 仍使用 `<FIREFOX_PROGRAM>`／`<FENNEVIA_PROFILE>`。

路徑保存與本機明確顯示是本次需求的資料流；實作時必須同時更新
`docs/security-and-privacy.md`，限定用途與保留／清除規則，不擴張正常日誌例外。

## 7. 模組與權限分層

建議獨立放在 `installer/`，不放入 Firefox 的 `src/shell` 或 privileged bundle：

```text
installer/
  ui/                         # Svelte steps、state、localization
  src-tauri/                  # Tauri host、封閉 commands、capabilities
  crates/
    installer-core/           # manifest、ownership、plan、transaction、redaction
    platform-windows/         # registry、ACL、path identity、running checks、UAC
    installer-worker/         # 無 WebView 的原生 Rust 執行程序
  tests/fixtures/             # 去識別化的共同契約與失敗案例
```

精確目錄以 P1 spike 結果調整，不能先擴張成通用 installer SDK。

- UI 只接收有界資料與選擇 token。直接 file picker 結果由 Rust 驗證後產生
  token；執行命令不接受 renderer 自製 operation list、任意命令或任意寫入路徑。
- `scan`、`choose target`、`save/forget target`、`status`、`preview`、`apply`
  是明確且有限的 commands。Rust 擁有完整 targets 與 plan，apply 綁定該 session
  的目標、操作、套件 digest 與顯示過的 plan digest。
- capabilities 限單一 installer window；明確測試自訂 command 的授權，不假設
  加上 capabilities 檔就自動保護所有 Rust commands。
- 不給 renderer 通用 filesystem、shell execute、HTTP、remote navigation 或
  updater 權限。封閉 CSP，所有 UI／字型／資源本機打包；正式版沒有 dev server。
- Rust core 不依賴 Tauri／DOM，也不啟動 `powershell.exe`、`pwsh`、腳本宿主或
  內嵌 PowerShell。新 GUI 不會在失敗時偷偷 fallback 到舊腳本。
- 同一 Rust worker 在一般權限或按需提權下執行完整交易；UI 始終不提權，
  不建立 elevated WebView。不得把雙根交易拆成兩套缺乏共同 rollback 的 writer。

UAC 延續現行按需政策：預覽與確認完成、program root 可寫性不足、使用者按下
繼續，才透過 Windows API 啟動固定 worker。Status／scan／保存不提權。
延續 owner-only、exclusive、non-reparse、大小受限、15 分鐘過期的 temp handoff
規則，額外綁定 request nonce、原使用者 SID、固定 worker／release identity、
targets 與 plan digest。worker 不信任 GUI 提供的判定，重新驗證及重算計畫。

結果回傳使用限定同一使用者／本機、單次 nonce 與有界訊息的 IPC；不得在
命令列傳遞原始目標或任意指令。第一階段拒絕換帳號的 UAC continuation，
避免採用另一個帳號的 Profile。取消、逾時、重播、父程序退出、結果遺失與
handoff 清除失敗都必須有安全狀態與去識別化訊息；不把未知結果視為成功。
具體 IPC 與 Windows ACL 實作須在 P1 固定並經安全審查後才進入 mutation。

## 8. Rust 核心移植與 PowerShell 備援

Rust 是新 GUI 的真正執行核心；PowerShell 維持獨立、可手動呼叫的復原入口。
共同契約是資料格式、允許操作與安全結果，不能藉此建立互不相容的第二套安裝格式。

移植範圍包括既有模組的所有安全檢查，不只檔案 copy/delete：

- release tree／package manifest 的嚴格 schema、完整 inventory、SHA-256、
  source/artifact policy 與不受信任內容拒絕；不能為了避免 PowerShell 而略過
  `SecurityChecks.psm1` 或 `FenneviaRelease.psm1` 的保護。
- canonical target、非重疊雙根、reparse ancestor、root/home/AppData/collection、
  traversal／device／UNC／alternate stream 等路徑界線；不可只靠字串 prefix。
- 模式證據、AutoConfig 衝突、相同名稱未知檔案、成對 ownership、hash 驗證、
  plan binding、同 volume staging、backup、journal、rollback、精確清理。
- 檔案變動、Firefox running、不可寫、磁碟／權限失敗、transaction residue 與
  mutation 前再次驗證；不能依掃描時的一次成功結果執行刪除。
- 一側完全缺失時的精確 Repair／Uninstall 與既有 no-op 行為。
- Disable／Uninstall 在相容性不符或 release manifest 損壞時仍依 ownership
  提供復原；GUI 的全域 package 驗證錯誤不能遮住這條路徑。

沿用現有 ownership schema，兩個 root 的 ownership bytes 必須相同；新引擎寫出
的記錄必須讓備援腳本可讀，反向也相同。Journal 保留可識別與人工復原語意，
中斷後兩邊都必須阻擋，不新增「猜測並刪除殘留」捷徑。

既有 plan hash 使用 PowerShell JSON serialization。跨引擎測試比較正規化後
的操作語意、前提與最終檔案，不假設不同 serializer 的 hash 必然相同。一次
確認只能給產生該預覽的 host 使用；Rust 需自行保證 preview／apply digest
一致並綁定同一 targets。轉用 PowerShell 必須重做預覽與確認。

新 GUI 與備援 CLI 必須遵守共同互斥規則，取得鎖後重算並檢查已存在交易，
防止兩者同時寫入同一 program／profile。擁有者後續明確追加 PowerShell 掃描與
位置保存，因此新版 release console 共用偏好格式，但缺少偏好仍可手動選取，
不依賴 Tauri 或 Rust worker。歷史版本
同時執行不受保證，不能宣稱新鎖能約束不認識該協定的舊工具。

新版本交付後移除舊 PowerShell GUI 的推薦入口與自動啟動關聯；CLI/TUI 和
必要模組繼續隨包提供。舊 GUI 是否從 release inventory 移除，在 P6 明確處理，
不影響既有 CLI 的手動備援能力。

## 9. 實作階段與退出條件

以下為完整退出條件；程式整合與自動驗證不等於所有人工發行矩陣通過。
目前逐列證據見 `docs/research/tauri-installer-release-validation.md`。

| 階段 | 工作 | 退出條件 |
| --- | --- | --- |
| P0 契約固定 | 對照既有 PS 六模組、release verifier、security checks；整理共同 fixtures、互斥、ownership/journal 與錯誤分類 | 安全檢查對照表完整，沒有默默遺漏；固定 Windows 範圍與相容性需求 |
| P1 技術 spike | 最小 Tauri 靜態畫面、Rust worker、離線 fixed WebView2、原生 picker、UAC 取消／同 SID handoff、無寫入 IPC | 在無 Node/Rust/PowerShell 依賴的測試執行環境可離線啟動；封閉權限及 worker 身分可驗證；記錄實際大小與限制 |
| P2 掃描與保存 | 有界 discovery、去重、stale／manual target、已保存組合、清除與重驗 | 重新啟動可找回明確保存的組合；沒有預設 Profile 靜默選取、掃描副作用或路徑日誌 |
| P3 唯讀核心 | Rust target／package／ownership 驗證、Status、Preview、redaction | 共用 fixtures 與 PS 判定相符；tampering、未知 schema、衝突都拒絕；尚不開放 mutation |
| P4 交易核心 | 所有 lifecycle 動作、rollback、journal、共同鎖與 worker/UAC 整合 | 故障注入恢復原始 tree；雙向跨工具操作通過；未知結果阻擋、原生 Firefox 復原路徑保留 |
| P5 完整 GUI | 精靈、可取消 scan、preview invalidation、真實 progress、錯誤／結果、鍵盤與雙語 | 實際流程不凍結、不重複執行、不接受過期確認；UI 不呼叫 PowerShell |
| P6 發行整合 | 固定工具鏈與 lockfiles、離線 runtime inventory、license、CI、雙次建置、文件與舊入口遷移 | 同工具鏈建置可重現；新 ZIP／備援均可使用；實際 Firefox／UAC 發行矩陣有證據 |

P1 若顯示 fixed WebView2、IPC 或可重現封裝不符合要求，記錄具體阻擋並調整
部署設計；不得默默改成下載 runtime、GUI 呼叫 PowerShell 或改用另一套框架。

## 10. 建置、依賴與文件

- 安裝器 frontend 有獨立 entry、build config 與 output，不與 Firefox IIFE 或
  privileged bridge 混打包。可共用經審查的 Svelte/Vite 版本與純 UI 經驗，
  不匯入 Firefox globals、chrome 資源、shell runtime 或資料 stores。
- 固定 Rust toolchain、Tauri 2 精確版本、Cargo.lock 與 npm lockfile；以
  `--locked` 建置。依賴、原生 crates、build scripts、WebView2 再分發權利與
  notice 進入正式 dependency review／`THIRD_PARTY_NOTICES.md`。
- 繼續由 nvm-windows 管理 Node；Rust／MSVC 缺少時依主機規範另行準備。
  使用者執行已發行 GUI 不需要安裝 Node、Rust、.NET 或 PowerShell。
- 現有開發、CI 或 release orchestration 可以使用 PowerShell；「GUI 不用
  PowerShell」的驗收包含 runtime 的 process tree、依賴與故障路徑。
- 對 app、worker、WebView2 和備援腳本建立完整且有限的 release inventory；
  engine 在執行前再驗證對應檔案。不以「允許全部 EXE/DLL」放寬掃描。
  安裝器依賴只存在於解壓工具目錄，不複製到 Firefox runtime。
- 在不同乾淨建置路徑做兩次產物／ZIP 比對，處理來源路徑、時間戳、Rust debug
  path 等差異；禁止手動修補已編譯二進位以掩蓋不可重現結果。
- 不加入 updater、自動下載、安裝常駐服務、MSI/NSIS 外層安裝或自動啟動。
  簽章與 SmartScreen 仍是另案，Tauri 不構成免除提示的承諾。
- 實作時同步 `docs/installation.md`、`docs/security-and-privacy.md`、
  `docs/testing-and-recovery.md`、`docs/firefox-internals-map.md`、ADRs、README、
  release source inventory 與實際完成範圍的計畫／追蹤項目。
- 本次已發現 installation/security 文字仍有 153/154、`0.18.0-beta.1` 的舊描述；
  實作時以 release metadata 與已驗證紀錄同步，不能複製成新的硬編碼警告。
  本計畫不改發布版本，也不宣稱目前最新版 Firefox 已驗證。

## 11. 驗收矩陣

| 項目 | 必要證據 |
| --- | --- |
| 離線／無 PowerShell GUI | 阻止 PowerShell 啟動時，scan、save、preview、全部 lifecycle 與提權路徑仍可完成；process tree 不含腳本宿主；無遠端 UI／runtime 下載 |
| 掃描 | registry views、多安裝、多 Profile、相對／絕對路徑、同名、Unicode、空白、缺檔、讀取失敗、部分失效；重掃不吞錯也不覆寫明確選擇 |
| 保存 | restart、跨解壓版本可用、明確保存／忘記、損壞與未知 schema、上限、唯讀、reparse、並行更新、stale 路徑、失敗不影響安裝結果 |
| 選擇 | 不靜默採 default；default 額外確認；錯誤配對／現有 program ownership 衝突拒絕；手動 Profile 仍要符合模式證據 |
| Tauri 邊界 | 偽造／重播 token、任意 path/action、非預期 window、navigation、shell/fs/network capability 都無法取得寫入權；只有後端可產生可執行 plan |
| 交易 | dry run 無 managed-file 變動；每個 mutation 階段故障注入；hash drift、disk/permission failure、同時執行、rollback 與 interrupted journal 阻擋 |
| 新舊互通 | PS 安裝→Rust 更新／停用／修復／移除，Rust 安裝→PS 對應操作；新舊都能辨識 ownership 與 journal；GUI 偏好不存在也不影響備援 |
| 復原 | entry／manifest 損壞、Firefox 版本不符、一側 ownership 缺失、changed owned files、unrelated chrome 檔案保留；Disable／Uninstall 保持可達且限縮 |
| UAC／worker | 無需提權、需要提權、取消、換帳號拒絕、payload 過大／過期／ACL 不符、worker／package 被改、digest 改變、replay、IPC 中斷、清理失敗 |
| UX | 滑鼠／完整鍵盤、焦點、重複點擊、遲到回應、100/150/200% DPI、文字放大、high contrast、screen reader、兩種語言、長路徑與小視窗 |
| 發行 | 新工具鏈鎖定、license 清單、無個人路徑、double build、checksum、ZIP 解壓 Unicode 路徑、乾淨離線機器、實際 Firefox install→native recovery→uninstall |

普通實作 gate：受影響 frontend 的 lint/typecheck/test、Rust fmt/clippy/test、
共用契約 suites、現有 `npm run verify`、PowerShell 7／5.1 固定清單與 Windows CI。
新增 CI 步驟需固定版本，Rust 與 installer UI 不能落在既有檢查範圍之外。
修改 workflow 時先檢查 `act -l` 與 Docker／runner 可用性；Windows GUI、UAC
及 WebView2 不能以不相容的 Linux container 結果冒充 Windows 證據。

發布仍要求 `docs/testing-and-recovery.md` 完整矩陣與 extracted release 的
真實 Firefox／GUI/UAC 驗證；不沿用 `0.19.0-beta.1` 的一次性人工測試例外。
沒有執行的列一律標示 `not run`。

## 12. 未來 Linux 工作邊界

可共用的是 Svelte 流程、封閉 IPC 資料、嚴格 manifest/ownership 模型、plan 與
交易演算法。Windows registry、SID/ACL、檔案 identity、process checks、UAC
與 runtime discovery 留在平台 adapter，不把 Windows 大小寫／磁碟規則寫進 core。

Linux 另案必須決定並驗證 Firefox 發行型態（系統套件、官方解壓、Flatpak、Snap）、
Profile discovery、XDG 保存位置、symlink 與權限／ownership、polkit 等提權方式、
原子操作、WebKitGTK、Wayland/X11 與實際 Firefox runtime。不可在這次增加未驗證
的 Linux 安裝按鈕，或因 Tauri 可在 Linux 執行就聲稱 Fennevia 支援 Linux。

## 13. 初次規劃驗證紀錄（2026-11-08）

- 已檢查：專案規範、主計畫／roadmap、安裝器與發行文件、相關 ADR、現有 discovery／
  launcher／ownership／transaction 結構、GUI 修正歷史與 #4／#39／#57。
- 已查閱：上述官方技術文件；UI/UX 技能的鍵盤、驗證、非同步狀態與分層指引。
- 本次交付只新增計畫與提案索引，不修改安裝器、runtime、dependencies 或 artifacts。
- GUI spike、掃描、保存、Rust、UAC、Firefox、完整測試與 CI：**not run**；尚未實作。
- 文件檢查：`git diff --check`，並核對新增檔案、計畫連結與 ADR 編號；沒有執行
  `npm run verify`，因本次只新增規劃文件。

## 14. 實作進度（2026-11-09）

- 已完成原生 host／core／Windows adapter／worker 與六種 lifecycle 的程式整合。
  完整 release-container 驗證、x64／Release channel 判定、default Profile 明確確認、
  逐步 rollback、雙根 ownership／journal、共同鎖、單次 token 與 UAC continuation 已實作。
- fixed WebView2、262 筆原生 inventory、worker hash pin、license／notices、原生發行封裝
  與雙次建置流程已加入。新 source build 的 FenneviaSetup.exe 不再啟動 PowerShell。
- GUI 有雙語掃描／手動選取、保存／忘記／清除、狀態、預覽、真實 worker phase/count
  與未知結果阻擋。PowerShell release console 依擁有者追加需求支援相同保存格式。
- P0 安全對照、P2 保存、P3 驗證、P4 自動故障／跨引擎證據見新 validation record。
  P1／P5／P6 的人工 UAC、乾淨機器、完整鍵盤／DPI／screen reader 與實際 Firefox
  發行矩陣仍 not run，不能標示所有退出條件均通過。
- core preview.executable 仍為 false；只有 host 可發出 single-use approval。保存位置
  不保存同意；不同引擎與重新預覽均重新確認。
- 本次不 bump version、不 tag／publish，不修改已發布 ZIP，不宣稱 Linux 或新 Firefox
  相容性。初次與交易增量紀錄保留；目前證據以
  `docs/research/tauri-installer-release-validation.md` 為準。
