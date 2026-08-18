# Fennevia

[English](README.md)

Fennevia 是一個為**原版 Firefox**製作、實驗性且以網頁內容為中心的瀏覽器介面。它讓網頁保持在畫面主體，並把瀏覽器控制項放到四個平時隱藏、需要時才浮現的邊緣面板。

> [!WARNING]
> Fennevia 是公開的**預發行版本**，不是穩定的日常使用產品。它會執行高權限程式碼，並依賴 Firefox 不保證穩定的內部介面。請只安裝在指定的 Firefox 版本與 Build ID、使用專用 Firefox 設定檔，並保留下載的發行壓縮檔，以便之後停用或移除。

## Fennevia 會改變甚麼

在靜止狀態下，Firefox 主要只顯示目前網頁。把滑鼠移到視窗邊緣，或使用鍵盤，即可顯示：

- **上方：**上一頁、下一頁、重新載入／停止、Firefox 工具、會跟隨 Firefox 工具列直到你在 Fennevia 自訂的 widget 區，以及專案自有的視窗控制項。Fennevia 自訂模式可以把 widget 放到四個邊緣；Firefox 原生自訂模式仍可從 Firefox 應用選單進入。
- **左方：**垂直分頁、精簡的網址／狀態啟動器，以及放在此處的 widget。
- **右方：**書籤，以及放在此處的 widget。
- **下方：**下載進度及狀態，以及放在此處的 widget。
- **中央：**從左方啟動器或按 <kbd>Ctrl</kbd>+<kbd>L</kbd> 開啟的網址／搜尋彈出面板。

安全提示、權限、憑證、擴充套件安裝、下載安全、DevTools、完整原生網址列，以及自訂視窗按鈕背後的視窗指令仍由 Firefox 負責。原生標題列按鈕節點會保留，以便失敗時立刻復原。遇到不支援的功能或需要復原時，Fennevia 可以重新顯示完整的 Firefox 原生介面。

## 目前版本

首個公開預發行版本是 [`v0.10.0-beta.1`](https://github.com/yutinglia/fennevia/releases/tag/v0.10.0-beta.1)，支援範圍刻意限制得很窄：

| 要求             | 支援值                                |
| ---------------- | ------------------------------------- |
| 作業系統         | Windows x64                           |
| Firefox          | 原版 Firefox 153.0.4，Release channel |
| Firefox Build ID | `20260810162159`                      |
| 套件             | `fennevia-0.10.0-beta.1-windows.zip`  |

若 Firefox 版本或 Build ID 不相符，安裝、更新、修復及重新啟用都會被拒絕；Firefox 更新後仍可使用停用及移除功能進行復原。此版本不支援 Linux、macOS、Firefox ESR、Beta、Nightly，以及較新或較舊的 Firefox 組建。

安裝預先建置的發行版**不需要** Node.js、npm，也不需要自行編譯 Firefox。

## 安裝

### 1. 準備 Firefox

1. 在 Firefox 開啟 `about:profiles`。
2. 為 Fennevia 建立或選擇一個**專用設定檔**。
3. 記下該設定檔的 **Root Directory（根目錄）**。設定檔必須已向 Firefox 註冊；透過 `about:profiles` 建立的設定檔符合此要求。
4. 找出準備使用的 `firefox.exe`。常見位置是 `C:\Program Files\Mozilla Firefox\firefox.exe`。
5. 關閉所有正在使用該程式或設定檔的 Firefox 視窗、Browser Console 及 Browser Toolbox。

若 Firefox 安裝在受系統保護的位置，可能需要另外以系統管理員身分開啟 PowerShell。Fennevia 安裝程式不會自行要求或取得系統管理員權限。

### 2. 下載並驗證發行檔

從同一個 GitHub Release 下載：

- `fennevia-0.10.0-beta.1-windows.zip`
- `fennevia-0.10.0-beta.1-windows.zip.sha256`

解壓縮前，在下載目錄開啟 PowerShell 並執行：

```powershell
$expected = (Get-Content -Raw .\fennevia-0.10.0-beta.1-windows.zip.sha256).Split()[0]
$actual = (Get-FileHash -Algorithm SHA256 .\fennevia-0.10.0-beta.1-windows.zip).Hash.ToLowerInvariant()
if ($actual -cne $expected) { throw "Fennevia release checksum mismatch." }
```

若 SHA-256 校驗值不相符，請不要繼續。

### 3. 預覽安裝變更

解壓縮 ZIP，在解壓後的 Fennevia 目錄開啟 PowerShell。建議使用互動式主控台：

```powershell
pwsh -NoProfile -File .\scripts\fennevia.ps1
```

請自行選擇 `firefox.exe` 與一個已註冊的設定檔**名稱**。主控台會在同一畫面重繪，並支援鍵盤與滑鼠，不會在每次按鍵後再印出一組選單。Fennevia 不會預先選取 Firefox 預設設定檔。請先檢查遮罩後的變更計劃，再確認套用。

不要把真實設定檔路徑貼到 issue 或公開紀錄。對應的指令列寫法是：

```powershell
$firefox = '<FIREFOX_PROGRAM>\firefox.exe'
$profile = '<FIREFOX_PROFILE>'

pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Install `
  -FirefoxPath $firefox -ProfilePath $profile `
  -ProfileMode Registered -WhatIf
```

README 的指令使用 PowerShell 7（`pwsh`）。套件亦已使用 Windows PowerShell 5.1 驗證；發行檔內的 `INSTALL.md` 包含完整的更新、復原及移除說明。

### 4. 正式安裝

在主控台檢查預覽後，確認畫面上的變更計劃。對應的指令列寫法是再執行一次不含 `-WhatIf` 的命令：

```powershell
pwsh -NoProfile -File .\scripts\fennevia-package.ps1 Install `
  -FirefoxPath $firefox -ProfilePath $profile `
  -ProfileMode Registered
```

使用所選設定檔啟動 Firefox。請保留完整的解壓目錄或原始 ZIP；更新、修復、重新啟用及部分復原操作會驗證原始套件內容。

更新、停用、修復、重新啟用及移除指令請參閱：

- [發行版安裝與復原指南（英文）](release/INSTALL.md)
- [完整套件生命週期參考（英文）](docs/installation.md)

## 日常操作與復原

把滑鼠移到對應的視窗邊緣即可顯示面板。當介面健康運作時，<kbd>Ctrl</kbd>+<kbd>L</kbd> 會開啟 Fennevia 的中央網址／搜尋彈出面板。需要完整 Firefox 網址列、搜尋供應器、擴充套件操作或原生面板時，請選擇 **Open full Firefox address bar**。

若 Firefox 仍在執行，但自訂介面無法正常使用，請按 <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F12</kbd>，啟用內建的 Firefox 原生介面復原功能。若快捷鍵也失效，請關閉 Firefox，並使用同一個發行套件執行 `Disable`。不要手動刪除 Firefox 程式或設定檔內不確定用途的檔案。

## 重要限制

- Fennevia 使用 Mozilla 不保證穩定的 Firefox 內部介面。
- Firefox 正常更新後，版本可能超出目前支援範圍。此時應保持停用或移除 Fennevia，直到有相容版本。
- 目前沒有自動更新、程式碼簽署或可驗證建置／發行證明（attestation），亦未完成獨立安全審計。
- 目前發行版只支援 Windows，並不代表穩定或長期支援承諾。
- 書籤編輯、完整下載管理、進階原生網址列功能及擴充套件整合仍可透過 Firefox 完整原生介面使用。

## 刻意保留主觀取向的介面

Fennevia 是按照作者個人偏好及工作流程設計的。現階段不會為核心布局、互動方式及視覺設計提供使用者設定；這些選擇本身就是產品設計的一部分。設計仍可能隨專案發展而改變，日後亦可能重新考慮可設定性。

## 文件

根目錄 README 刻意只保留公開、面向一般使用者的資訊。更深入的內容按讀者類型整理：

- [文件導覽（英文）](docs/README.md)
- [技術概覽及目前工程進度（英文）](docs/technical-overview.md)
- [架構（英文）](docs/architecture.md)
- [測試與復原（英文）](docs/testing-and-recovery.md)
- [Firefox 更新流程（英文）](docs/firefox-update-workflow.md)
- [安全與私隱（英文）](docs/security-and-privacy.md)
- [參與開發（英文）](CONTRIBUTING.md)

歷史相容性研究及驗證紀錄放在 [`docs/research/`](docs/research/)。這些文件描述當時實際測試的里程碑，不會被改寫成好像較後期功能當時已經存在。

## 授權

Fennevia 的原創源碼、文件及專案產生的輸出採用 [MPL-2.0](LICENSE)。

第三方內容仍受各自授權條款約束，詳情請參閱 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 及[授權與來源政策](docs/licensing-and-provenance.md)。
