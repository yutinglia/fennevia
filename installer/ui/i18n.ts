// SPDX-License-Identifier: MPL-2.0
export const en = {
  progressPhases: {
    preparing: "Preparing files",
    applying: "Applying reviewed operations",
    rollingBack: "Restoring previous files",
    finishing: "Verifying and cleaning up",
  },
  title: "Set up Fennevia",
  subtitle: "Choose where your browser experience lives.",
  locations: "Browser locations",
  saved: "Saved locations",
  scan: "Scan again",
  scanning: "Working…",
  firefox: "Firefox installation",
  profile: "Firefox profile",
  choose: "Choose a location",
  browse: "Browse…",
  remember: "Save these locations",
  rememberHint:
    "Saved on this computer only. Saving does not install or change Firefox.",
  paths: "Show local paths",
  use: "Use these locations",
  forget: "Forget",
  clear: "Clear saved locations",
  clearConfirm:
    "Clear all saved locations? Firefox and your profiles will not be removed.",
  default: "Firefox default",
  unavailable: "Unavailable — locate it again",
  empty: "No locations found. Use Browse to select one.",
  noSaved: "Your saved browser and profile pairs will appear here.",
  error: "The operation could not be completed",
  warning: "Some locations could not be inspected.",
  savedError:
    "Saved locations could not be read. Clear the saved list to start again.",
  phase: "Windows installer",
  loadingPackage: "Verifying the bundled package…",
  phaseBody:
    "Scan and remember Firefox and profile locations, review changes, then install. PowerShell remains available as a backup in the package's scripts folder.",
  success: "Locations saved.",
  forgotten: "Saved location removed.",
  cleared: "Saved locations cleared.",
  footer:
    "Windows x64 · Local only · PowerShell remains available as a manual backup",
  language: "Language",
  reviewTitle: "Review this installation",
  inspect: "Check status",
  previewHint:
    "Inspect the selected locations or choose a Fennevia source folder to preview file changes.",
  choosePackage: "Choose package folder…",
  files: "files",
  operation: "Operation",
  confirmDefault: "I intend to use this default Firefox profile.",
  preview: "Preview changes",
  previewResult: "Proposed changes",
  changes: "file and folder operations",
  noChanges: "No changes needed.",
  readOnlyPreview:
    "This source-tree selection is preview-only. Choose a verified extracted release package for a registered Firefox profile.",
  apply: "Apply these changes",
  previewAgain: "Preview again before starting another attempt.",
  elevate: "Continue with Windows administrator approval",
  applying:
    "Applying changes… Keep this window open. If a step fails, the installer will restore the previous files.",
  confirmChanges: "I confirm the selected locations and reviewed changes.",
  writeWarning:
    "Close all Firefox windows first. Windows x64 Firefox stable 153+ is accepted; tested majors are 153, 154, 157 and 159. Other versions may break.",
  elevationHint:
    "The previous attempt was rolled back. The Firefox program folder requires administrator access. Confirm again to open Windows UAC.",
  outcomes: {
    committed: "Changes applied.",
    rolledBack: "The operation failed; the original files were restored.",
    unchanged: "No changes were needed.",
  },
  incomplete:
    "One installation record is missing. Check the selected pair before considering Repair.",
  missingFiles: "Missing files",
  changedFiles: "Modified files",
  installStates: {
    absent: "Not installed",
    enabled: "Enabled",
    disabled: "Disabled",
  },
  actions: {
    install: "Install",
    update: "Update",
    repair: "Repair missing installation side",
    disable: "Disable",
    enable: "Enable",
    uninstall: "Uninstall",
  },
  kinds: {
    CreateDirectory: "Create folder",
    CreateFile: "Create file",
    ReplaceFile: "Replace file",
    RemoveFile: "Remove file",
    MoveFile: "Move file",
    RemoveDirectoryIfEmpty: "Remove folder if empty",
  },
  errorDetails: {
    UNKNOWN_OUTCOME:
      "The worker result is unknown. Do not repeat the operation. Reopen the installer and inspect the installation state.",
    ROLLBACK_INCOMPLETE:
      "Recovery could not finish. Keep the transaction folders and use the documented manual recovery procedure.",
    COMMITTED_CLEANUP:
      "Changes were applied, but transaction cleanup failed. Keep the transaction folders and inspect the installation before continuing.",
    CLEANUP:
      "Transaction cleanup failed. Keep the remaining transaction folders for recovery.",
    TIMEOUT:
      "The worker result is unknown. Do not repeat the operation. Reopen the installer and inspect the installation state.",
    IO: "The worker result could not be confirmed. Do not repeat the operation. Reopen the installer and inspect the installation state.",
    CANCELLED: "Windows approval was cancelled. Preview again before retrying.",
    DEVELOPMENT_ONLY:
      "Source-tree installation requires marked development targets. Use a verified release package for registered profiles.",
    UNREGISTERED_PROFILE:
      "Choose a registered Firefox profile or a pair with matching Fennevia installation records.",
    CONFLICT:
      "The files or installation records conflict. Nothing was changed. Check the selected pair and package.",
    STALE: "The selection or saved list changed. Scan again and retry.",
    REPARSE_POINT:
      "This location uses a link or junction. Choose a direct local location.",
    INVALID_DATA: "A file has an unsupported format or failed validation.",
    ACCESS_DENIED:
      "This location cannot be read with your current permissions.",
    MISSING: "A required location, package, or installation record is missing.",
    LIMIT_EXCEEDED:
      "A file or list exceeds the supported size. Saved locations are limited to 10 pairs.",
    PERMISSION:
      "The saved-location file does not have the required private access permissions.",
    BUSY: "Another operation or an interrupted transaction needs attention.",
  } as Record<string, string>,
};
export const zh: typeof en = {
  progressPhases: {
    preparing: "準備檔案",
    applying: "套用已檢視的操作",
    rollingBack: "還原先前檔案",
    finishing: "驗證並清理暫存",
  },
  title: "設定 Fennevia",
  subtitle: "選擇要使用的瀏覽器與個人設定檔。",
  locations: "瀏覽器位置",
  saved: "已保存的位置",
  scan: "重新掃描",
  scanning: "處理中…",
  firefox: "Firefox 程式",
  profile: "Firefox 個人設定檔",
  choose: "選擇位置",
  browse: "瀏覽…",
  remember: "保存這組位置",
  rememberHint: "僅保存在這台電腦。保存不會安裝或修改 Firefox。",
  paths: "顯示本機路徑",
  use: "使用這組位置",
  forget: "忘記",
  clear: "清除已保存位置",
  clearConfirm: "清除所有已保存的位置？不會移除 Firefox 或個人設定檔。",
  default: "Firefox 預設",
  unavailable: "無法使用，請重新定位",
  empty: "找不到位置，請使用「瀏覽」選擇。",
  noSaved: "保存的 Firefox 與個人設定檔組合會顯示在這裡。",
  error: "無法完成這項操作",
  warning: "部分位置無法檢查。",
  savedError: "無法讀取已保存位置，可清除清單後重新設定。",
  phase: "Windows 安裝器",
  loadingPackage: "正在驗證隨附套件…",
  phaseBody:
    "掃描並記住 Firefox 與 Profile 位置，預覽變更後安裝。套件 scripts 資料夾仍提供 PowerShell 備援入口。",
  success: "已保存位置。",
  forgotten: "已忘記這組位置。",
  cleared: "已清除保存位置。",
  footer: "Windows x64 · 僅限本機 · PowerShell 保留為手動備援",
  language: "語言",
  reviewTitle: "檢查這組安裝",
  inspect: "檢查狀態",
  previewHint: "檢查所選位置，或選擇 Fennevia 套件來源資料夾來預覽檔案變更。",
  choosePackage: "選擇套件資料夾…",
  files: "個檔案",
  operation: "操作",
  confirmDefault: "我確定要使用這個 Firefox 預設個人設定檔。",
  preview: "預覽變更",
  previewResult: "預計變更",
  changes: "項檔案與資料夾操作",
  noChanges: "不需要變更。",
  readOnlyPreview:
    "這組原始碼目錄選擇僅可預覽；一般 Profile 請選擇通過驗證的解壓發行包。",
  apply: "執行這些變更",
  previewAgain: "再次嘗試前，請重新預覽變更。",
  elevate: "繼續並請求 Windows 管理員核准",
  applying:
    "正在執行變更，請保持視窗開啟。如果步驟失敗，安裝器會還原原有檔案。",
  confirmChanges: "我已確認所選位置，並檢閱上述變更。",
  writeWarning:
    "請先關閉所有 Firefox 視窗。接受 Windows x64 Firefox 正式版 153 以上；目前只有 153、154、157 與 159 的驗證證據，其他版本可能無法運作。",
  elevationHint:
    "前一次操作已還原。Firefox 程式資料夾需要管理員權限；再次確認後才會開啟 Windows UAC。",
  outcomes: {
    committed: "變更已完成。",
    rolledBack: "操作失敗，已還原原有檔案。",
    unchanged: "不需要變更。",
  },
  incomplete: "其中一側的安裝紀錄缺失；考慮修復前，請先核對選擇的組合。",
  missingFiles: "缺少檔案",
  changedFiles: "已修改檔案",
  installStates: { absent: "尚未安裝", enabled: "已啟用", disabled: "已停用" },
  actions: {
    install: "安裝",
    update: "更新",
    repair: "修復缺失的安裝側",
    disable: "停用",
    enable: "啟用",
    uninstall: "移除",
  },
  kinds: {
    CreateDirectory: "建立資料夾",
    CreateFile: "建立檔案",
    ReplaceFile: "替換檔案",
    RemoveFile: "移除檔案",
    MoveFile: "移動檔案",
    RemoveDirectoryIfEmpty: "資料夾為空才移除",
  },
  errorDetails: {
    UNKNOWN_OUTCOME:
      "無法確認 worker 結果，請勿重複執行；重新開啟安裝器並檢查安裝狀態。",
    ROLLBACK_INCOMPLETE: "復原未能完成。請保留交易資料夾，依文件進行手動復原。",
    COMMITTED_CLEANUP:
      "變更已套用，但交易清理失敗。請保留交易資料夾，檢查安裝狀態後再繼續。",
    CLEANUP: "交易清理失敗，請保留剩餘交易資料夾供復原使用。",
    TIMEOUT:
      "無法確認 worker 結果，請勿重複執行；重新開啟安裝器並檢查安裝狀態。",
    IO: "無法確認 worker 結果，請勿重複執行；重新開啟安裝器並檢查安裝狀態。",
    CANCELLED: "已取消 Windows 核准，請重新預覽後再試。",
    DEVELOPMENT_ONLY:
      "原始碼安裝需要有開發標記的目標；一般 Profile 請使用通過驗證的發行包。",
    UNREGISTERED_PROFILE:
      "請選擇 Firefox 已登錄的個人設定檔，或具有相符 Fennevia 安裝紀錄的組合。",
    CONFLICT: "檔案或安裝紀錄有衝突，未進行任何變更。請核對選擇的組合與套件。",
    STALE: "選擇或保存清單已改變，請重新掃描後再試。",
    REPARSE_POINT: "此位置含有連結或接合點，請選擇直接的本機位置。",
    INVALID_DATA: "檔案格式不支援或未通過驗證。",
    ACCESS_DENIED: "目前權限無法讀取此位置。",
    MISSING: "缺少必要的位置、套件或安裝紀錄。",
    LIMIT_EXCEEDED: "檔案或清單超過支援大小；最多可保存 10 組位置。",
    PERMISSION: "保存位置檔案的存取權限不符合僅限目前使用者的要求。",
    BUSY: "另一項操作或中斷的交易需要先處理。",
  },
};
