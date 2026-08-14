# Testing and Recovery

## 1. 永遠使用獨立 Dev Profile

不要直接以日用 profile 開發 browser shell。

Dev profile 應：

- 無其他 userChrome/userContent/custom loader。
- 最少 extension。
- 可由 script 或文件重建。
- 容許打開 Browser Console / Browser Toolbox。
- 有清楚名稱，例如 `my-firefox-shell-dev`。

每次測試先用 `about:support` 確認 profile path、Firefox version 與 build ID。

## 2. 最低測試矩陣

| Case | 預期 |
|---|---|
| clean cold start | bootstrap/runtime 各初始化一次 |
| browser restart | shell 重建，無殘留 cache 行為 |
| second normal window | 每 window 一個 shell；process runtime 不重複 |
| private window | 依 policy mount 或保持 native fallback |
| close/reopen window | listener/observer/root 清理 |
| missing manifest | Firefox 原生 UI 正常，清楚 log |
| missing entry/bundle | Firefox 原生 UI 正常，清楚 stack |
| Svelte mount throw | 不設定 active gate，native UI 可用 |
| missing CSS | shell 可診斷，native UI 不被永久隱藏 |
| emergency toggle | 可立即切回 native UI |
| fullscreen | 退出方式與 controls 可用 |
| customize mode | 不因 native toolbox 隱藏而鎖死 |
| Browser Toolbox | 可 inspect shell 與 native chrome |

## 3. Recovery 設計

### Mount gate

隱藏 native UI 的 stylesheet 必須依賴 `data-mfs-active`。只有以下步驟全部成功才設定：

1. runtime 初始化。
2. hosts 建立。
3. bridge capability check。
4. framework mount。
5. shell health check。
6. emergency handler 已註冊。

任一步失敗：

- 不設定或移除 active attribute。
- 嘗試 unmount/remove 自有 hosts。
- log 完整 error。
- 不修改/刪除 native UI。

### Emergency toggle

需提供不依賴 Svelte component 的 privileged keyboard handler，用來切換 active gate。Key binding 必須避開常用 Firefox shortcut，並在文件記錄。

### Safe start

至少選一種：

- preference，例如 `myFirefoxShell.safeStart=true`
- profile chrome directory sentinel file
- bootstrap keyboard modifier，前提是可可靠取得

Safe start 會註冊 logging/runtime，但不得 mount/activate custom shell，方便除錯與移除。

### Hard disable / uninstall

必須文件化：

1. 關閉 Firefox。
2. 移除/停用 program directory AutoConfig pref 與 cfg entry。
3. 移除 profile package，或先改名 manifest。
4. 如有 startup cache 問題，採用已驗證的清理步驟。
5. 重新啟動並確認 Browser Console 無 project error。

不要要求使用者刪除整個 profile 才能復原。

## 4. Debugging Tools

### Browser Console

用於 startup、module import、runtime exception。Fatal log 應有固定 prefix，例如 `[MFS bootstrap]`、`[MFS window]`。

### Browser Toolbox

用於：

- 確認 host namespace/placement。
- 檢查 active gate 與 computed style。
- 確認 native UI 仍存在。
- 檢查 duplicated hosts/listeners。
- 手動移除 active attribute 作緊急恢復。

### Diagnostic API

Runtime 後期可提供只讀 debug object，例如：

```text
window.MyFirefoxShellDebug
```

只能在開發模式啟用，不能暴露敏感 browser state，也不能成為正常 UI dependency。

## 5. Firefox Update 流程

每次 stable update：

1. 記錄 update 前已通過的 commit/version。
2. 先以 clean clone/profile 測 cold start。
3. 不自動 active native-hide gate，先跑 smoke mode。
4. 執行最低測試矩陣。
5. 有 failure 時依 `docs/research-playbook.md` 研究。
6. 更新 internal dependency/source reference。
7. 修正後再啟用 active mode。
8. 留下一份 issue/compatibility record。

## 6. 自動化邊界

可自動化：

- TypeScript/lint/unit tests。
- deterministic build 與 artifact diff。
- manifest/schema/static checks。
- pure bridge mapping/state tests（用 mock）。
- install layout validation。

難以只靠 CI 自動化：

- 真實 Firefox AutoConfig startup。
- Browser chrome visual/layout。
- private/second window lifecycle。
- native dialogs/fullscreen/customize mode。

這些至少要有可重複 manual smoke script；日後再評估 Marionette/remote debugging automation。