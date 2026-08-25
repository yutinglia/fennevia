<!-- SPDX-License-Identifier: MPL-2.0 -->

# Firefox 154 CustomizableUI localization console noise

## Environment

- Date: 2026-08-26
- Firefox version: 154.0 release, matching the current validated development
  baseline and the owner-reported `CustomizableUI.sys.mjs:2795` source line
- Build ID: `20260812182057` from the current validated Firefox 154 baseline;
  `about:support` was not re-captured for this follow-up
- Channel: release
- Operating system: Windows 11 x64
- Profile: owner runtime profile; no clean-profile reproduction was run in this
  follow-up
- Project commit before the fix: `c36db08`

## Symptom

The owner reported repeated Browser Console errors for Fluent-only built-in
widgets, including `reset-pbm-toolbar-button`, `save-page-button`,
`print-button`, `open-file-button`, `characterencoding-button`,
`email-link-button`, `logins-button`, `share-tab-button`, `sync-button`,
`send-tab-button`, `privatebrowsing-button`, `firefox-view-button`, and
`screenshot-button`:

```text
CustomizableUI: Could not localize property '<widget-id>.label'.
CustomizableUI.sys.mjs:2795
```

Visible labels and widget behavior remained correct.

## Minimal reproduction

1. Start the current Fennevia package on the existing Firefox runtime profile.
2. Open the Browser Console.
3. Let the toolbar-widgets controller build its CustomizableUI palette
   snapshot.
4. Observe one or more complete groups of the errors above.

This reproduction is owner-reported. It was not independently rerun in a clean
profile during this change.

## First causal evidence

- Before this fix, `resolveWidgetLabel` tried
  `CustomizableUI.getLocalizedProperty(widgetId, "label")` before the existing
  pinned widgetId-to-Fluent-id map.
- Every reported widget id already had a supported Fluent mapping and rendered
  a usable name after the legacy lookup returned empty.
- Firefox 154 `CustomizableUIInternal.getLocalizedProperty` catches a missing
  string-bundle lookup, logs the exact error at line 2795, and then returns its
  default. It does not throw to the Fennevia caller, so the caller's `try/catch`
  cannot suppress the message.
- The corresponding 153.0.4 function is identical. The compared 49-line
  function snippets have the same SHA-256
  `e475d7020e372af603d29ba0098893a06c273c44741df25010ada79b1d9b24b5`;
  only surrounding source line numbers differ (153 error line 2772, 154
  error line 2795).

## Sources checked

### Official Firefox

- Firefox 153.0.4 tag `FIREFOX_153_0_4_RELEASE`,
  `browser/components/customizableui/CustomizableUI.sys.mjs`, blob
  `5009406c82ed60cdb8bc7cb4e2ab01df76449e49`
- Firefox 154.0 tag `FIREFOX_154_0_RELEASE`, the same path, blob
  `491161e48044f75167a8e8a0348779cfa22fc40e`
- Firefox 154 source documents `l10nId` / Fluent as preferred and the legacy
  `label`, `tooltiptext`, and `localized` widget properties as deprecated.

### Compatibility canaries (default-branch HEAD on 2026-08-26)

| Canary | Head | Applicability |
| --- | --- | --- |
| `alice0775/userChrome.js` | `a39f5cb60d40d01a1ae6d65935db152e7ac23111` | Latest change is the Firefox 153.2 ESR Bug 1974213 script-loader adaptation; unrelated to widget presentation. |
| `MrOtherGuy/fx-autoconfig` | `dfdab5684faffc112b76ccb1d8cab7f75da0102c` | No relevant change. |
| `xiaoxiaoflood/firefox-scripts` | `a898ac59fb0ca3886c0c46b184fdbc037c83c037` | No relevant change. |
| `aminomancer/uc.css.js` | `88514013ddc375f4770f4a35d8d07a91d6dd7d8f` | No relevant change. |

GitHub code searches found no `getLocalizedProperty` use in the four canaries,
and issue/PR searches found no exact `Could not localize property` incident.
No canary code was copied or adapted.

## Upstream change

None. Firefox 153.0.4 and 154.0 have the same relevant legacy localization and
error-logging behavior. The console noise came from Fennevia's ADR-046 fallback
order, not a Firefox 154 regression.

## Loader-specific baggage identified

None. Generic loader bootstrap, sandbox, discovery, and compatibility behavior
does not participate in toolbar label presentation.

## Options considered

1. Keep the errors because labels eventually resolve: rejected because
   error-level noise hides real first-causal Browser Console failures.
2. Intercept Firefox logging or `console.error`: rejected because it would
   suppress unrelated Firefox diagnostics globally.
3. Pass a synthetic default into the legacy API: rejected because the mapped
   Fluent label is already the authoritative supported source.
4. Resolve mapped Fluent labels before the legacy properties-bundle fallback:
   selected as the smallest change. Unmapped widgets retain the old fallback.

## Decision and minimum adaptation

Move the existing mapped Fluent result ahead of
`CustomizableUI.getLocalizedProperty`. JavaScript short-circuit evaluation then
avoids the known-invalid legacy lookup when Fluent succeeds, while node labels,
wrapper labels, node `data-l10n-id`, and unmapped legacy widgets preserve their
existing behavior. No Firefox logger, native widget, or localization resource
is modified.

## Security and privacy effects

- No new dependency, resource mapping, preference, native object exposure,
  network access, persistence, or data flow.
- No label, widget id, extension identity, browsing value, or private-window
  state is added to project logs.
- Existing per-window bounded labels and fail-open behavior are unchanged.

## Validation performed

- Official Firefox 153/154 source comparison: passed.
- Four compatibility-canary HEAD and exact-error searches: passed; no relevant
  adaptation found.
- Focused toolbar-widgets unit test: passed, 28/28 tests.
- Generated bridge and package-manifest synchronization: passed;
  `BridgeBoundary.sys.mjs` is deterministic at 295,464 bytes with SHA-256
  `27e2a72154d5a2135198492750463bf7927e1746b33b9eaa8f68e1f1159be9d2`,
  and the 16-file package manifest was synchronized.
- Complete `npm run verify` ordinary gate: passed on Node.js 24.18.0 and npm
  11.16.0. All 429 tests passed; aggregate line coverage was 88.48% and
  function coverage was 95.63%. Formatting, lint, typecheck, the fixed-list
  PowerShell suites, dependency audit, deterministic builds, and all 14
  production-artifact checks passed.
- Windows PowerShell 5.1 fixed-list static suite: passed independently.
- Real Firefox 154 Browser Console restart/customize check: not run.

## Remaining compatibility risk

The pinned Fluent ids remain Firefox-internal and may change in a later major.
If a mapped Fluent id stops resolving, presentation still proceeds through the
remaining bounded fallbacks, but that later stable requires the normal update
workflow and source revalidation. This change does not widen support beyond
the recorded Firefox 153/154 boundary.

## Follow-up

After installing the rebuilt package, repeat a clean browser restart and one
customize-palette open on Firefox 154, then verify the reported
`CustomizableUI` errors are absent while mapped and legacy widget names remain
correct. Record that runtime row as `pass` only after direct observation.
