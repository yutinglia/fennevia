# Firefox 153 bottom-edge downloads research and validation

## 1. Record metadata

- Issue: #32, bottom-edge download progress/status MVP.
- Research and implementation date: 2026-08-16.
- Firefox: stock Firefox 153.0.4 release, stable channel.
- Build ID: `20260810162159`.
- Installed source stamp: `54be19de0e08edff0b797e55fd935dd3978b0a6d`.
- Official mirror tag: `FIREFOX_153_0_4_RELEASE`.
- Official mirror commit: `c178247e1dfea52241a6b18b18cf3a00f8da935c`.
- Platform: Windows 11 25H2.
- Runtime target: isolated copied Firefox program and marker-owned
  `fennevia-dev` profile.
- Project branch: `codex/issue-32-downloads`, based on merge
  `711e1921e`; the pull request records the final implementation commit.
- Profile state: native Firefox UI retained and Fennevia production state stops
  at `healthy`.

This record covers current-source research, compatibility canaries,
implementation selection, privacy and security review, product-reference
provenance, failure behavior, and real Firefox evidence. It does not claim
Linux, macOS, an older Firefox release, real network throughput performance, a
complete Downloads manager, daily-driver readiness, or content-only
activation.

## 2. Question and selected outcome

The issue needed accurate aggregate download status in ADR-026's existing
bottom edge without moving Firefox's Downloads panel, exposing filenames or
paths, polling, implementing file actions, or changing native safety behavior.

The selected design is:

1. one privileged Downloads controller and list view per managed window;
2. `Downloads.PUBLIC` for normal windows and `Downloads.PRIVATE` for private
   windows;
3. current list-view callbacks and batching, with no periodic polling;
4. current Firefox state precedence for active, succeeded, failed, paused,
   canceled, and queued records;
5. weighted known-size aggregate progress and explicit indeterminate state if
   any active transfer lacks progress;
6. anonymous immutable snapshots containing only opaque IDs, state, optional
   percentage, capped counts, and bounded items;
7. old terminal history ignored during initial replay and at most three new
   terminal records retained in transient hidden state;
8. one compact read-only panel in the existing bottom host; and
9. exact per-window view/subscription/handle/UI cleanup and health fail-open.

ADR-030 is the normative decision. Firefox remains the owner of download
creation, destinations, notifications, file pickers, history, safety and
reputation decisions, and every file or lifecycle action.

## 3. Current Firefox source evidence

All links below resolve at the exact release commit rather than a moving
branch.

| Source | Exact blob | Finding used by Fennevia |
| --- | --- | --- |
| [`toolkit/components/downloads/Downloads.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/toolkit/components/downloads/Downloads.sys.mjs) | `2eb8ead6b2ef188210bdf7a57df1adca84bcf63f` | Exposes the fixed `Downloads` object, `PUBLIC` and `PRIVATE` list constants, `getList()`, `createDownload()`, and the current `Error` constructor. |
| [`toolkit/components/downloads/DownloadList.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/toolkit/components/downloads/DownloadList.sys.mjs) | `8e6d1987c359c9388ae73aeeb57ec6c94be033e5` | Owns list membership and `addView()`/`removeView()`. Adding a view synchronously replays current records between batch callbacks; later add/change/remove callbacks are event driven. |
| [`toolkit/components/downloads/DownloadCore.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/toolkit/components/downloads/DownloadCore.sys.mjs) | `0223747bb0b3bbcd84d08477a27d8582052ef0e1` | Defines current download lifecycle fields, progress/byte fields, partial-data and cancellation semantics, source/target objects, change notification, and error state. |
| [`browser/components/downloads/DownloadsCommon.sys.mjs`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/downloads/DownloadsCommon.sys.mjs) | `b14c60d52e8b83b947985b9fcdd0b7f3be0d9be0` | `stateOfDownload()` supplies the current browser state precedence mirrored by the bridge, while native data links continue to own browser Downloads UI behavior. |
| [`toolkit/components/downloads/test/unit/test_DownloadList.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/toolkit/components/downloads/test/unit/test_DownloadList.js) | `4e88f05866aed631c4d8ecd09006d8a2f091bb9f` | Verifies initial view replay, change/remove delivery, multiple views, and paired view removal in current toolkit tests. |
| [`browser/components/downloads/content/indicator.js`](https://github.com/mozilla-firefox/firefox/blob/c178247e1dfea52241a6b18b18cf3a00f8da935c/browser/components/downloads/content/indicator.js) | `4826fc260020b6a8b16a1e8d64f6341cb30a569e` | Current browser chrome continues to own the native indicator/button and its interaction with the Downloads panel. Fennevia does not suppress or replace it. |

### 3.1 List ownership, initial replay, and private behavior

`Downloads.getList(Downloads.PUBLIC)` returns Firefox's public list and
`Downloads.getList(Downloads.PRIVATE)` its private list. Fennevia selects the
list from the already-validated window kind. Windows of the same kind observe
the same native backend policy; they do not receive a project-owned shared
store. Each window nevertheless owns and removes its own native view,
subscriber set, opaque registry, state adapter, component root, and lifecycle
cleanup.

`DownloadList.addView()` immediately replays the current list. The bridge marks
that interval as initialization. Existing active, paused, or queued records are
relevant current work and enter state; existing succeeded, failed, and canceled
records are ignored so an old native history does not masquerade as a new
completion. A tracked current item that later becomes terminal remains as a
recent result.

The view consumes:

- `onDownloadAdded(download)`;
- `onDownloadChanged(download)`;
- `onDownloadRemoved(download)`;
- `onDownloadBatchStarting()`; and
- `onDownloadBatchEnded()`.

Nested batch depth defers publication until the outer batch ends. Outside a
batch, every native callback reconciles immediately. Snapshot signatures avoid
duplicate revisions. There is no interval, timeout, animation clock, observer
fallback, or hidden-state poll. Disposal calls `removeView()` on the exact list
and view once, clears subscribers and transient records, releases opaque
handles, and rejects later public access.

Rejected alternatives:

- one process-global Fennevia mirror: unnecessary cross-window ownership and a
  private-state leak risk;
- `Downloads.ALL`: wrong privacy boundary for a window surface;
- browser-panel DOM scraping: unstable ownership and would couple state to a
  visible native widget;
- idle polling: current list views already provide exact lifecycle callbacks;
- filename/path display: not needed for the compact status goal and materially
  expands sensitive data exposure; and
- native download actions: duplicate safety, principal, filesystem, and
  confirmation policy outside this issue.

### 3.2 State mapping and aggregate progress

The bridge validates ordinary fields before use and mirrors the current
`DownloadsCommon.stateOfDownload()` precedence:

1. `!stopped` is active;
2. `succeeded` is succeeded;
3. a present `error` is failed;
4. canceled with partial data is paused;
5. remaining canceled state is canceled; and
6. otherwise the record is queued.

For all active records:

- if any `hasProgress` is false, progress is `indeterminate` and percentage is
  absent;
- otherwise positive totals are weighted by `currentBytes / totalBytes`;
- current bytes are clamped to the corresponding total before aggregation;
- zero-total records have no weight when a positive total exists;
- when every total is zero but Firefox reports percentages, those percentages
  are averaged; and
- the final value is clamped and floored to an integer from zero through 100.

No-active state has progress mode `none` and no percentage. A succeeded item is
represented as 100 percent. No byte value crosses the privileged boundary, so
the UI cannot associate a size with a user item and diagnostics cannot serialize
one.

### 3.3 Bounded anonymous state

The application contract contains only:

- phase and monotonically increasing revision;
- six fixed state counts, each capped at 999;
- explicit count-overflow and item-truncation flags;
- active aggregate mode and optional integer percentage; and
- at most six item records containing a context-bound opaque ID, fixed state,
  and optional integer percentage.

The bridge keeps at most three newly observed terminal records, removing an
older one when a newer terminal item arrives. Native removal also removes its
record immediately. Active, paused, and queued records remain while the native
list owns them because all are needed for correct aggregate counts and progress;
only six ever cross into application state.

The bridge never reads `source.url`, referrer data, target path, filename,
headers, cookies, principals, or `source.isPrivate` for output. The test fixture
deliberately supplies sentinel values in those native fields and proves they do
not appear in snapshots or the bottom DOM.

## 4. Compatibility canaries

The required current canaries were inspected at these heads on 2026-08-16:

| Repository | Head inspected | Result |
| --- | --- | --- |
| [`alice0775/userChrome.js`](https://github.com/alice0775/userChrome.js/tree/5e146e348a56a914e6c016d29733e8ee8d468155) | `5e146e348a56a914e6c016d29733e8ee8d468155` | Current version 149 download-status code still uses `Downloads.sys.mjs`, list/summary views, and paired view removal. It was a compatibility signal only; no loader, polling, DOM, or style code was adopted. |
| [`MrOtherGuy/fx-autoconfig`](https://github.com/MrOtherGuy/fx-autoconfig/tree/dfdab5684faffc112b76ccb1d8cab7f75da0102c) | `dfdab5684faffc112b76ccb1d8cab7f75da0102c` | Current bootstrap compatibility signal; no download surface or generic loader behavior was relevant to the selected bridge. |
| [`xiaoxiaoflood/firefox-scripts`](https://github.com/xiaoxiaoflood/firefox-scripts/tree/a898ac59fb0ca3886c0c46b184fdbc037c83c037) | `a898ac59fb0ca3886c0c46b184fdbc037c83c037` | Only an older S3Download extension pattern was found; it was not treated as current API evidence and no source was reused. |
| [`aminomancer/uc.css.js`](https://github.com/aminomancer/uc.css.js/tree/88514013ddc375f4770f4a35d8d07a91d6dd7d8f) | `88514013ddc375f4770f4a35d8d07a91d6dd7d8f` | Download-related cosmetic assets and clear-button behavior did not provide the required bridge architecture; no code or styling was adopted. |

Current Firefox source and tests remained authoritative. No canary became a
runtime dependency, and generic-loader baggage was excluded.

## 5. Product-reference provenance and no-copy boundary

The explicit product reference was
[`yutinglia/my-firefox-custom`](https://github.com/yutinglia/my-firefox-custom/tree/7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5)
at commit `7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5`. The
`download_progress.uc/README.md`, controller, and stylesheet were inspected
only to confirm the broad capability: compact bottom progress, multi-download
aggregation, and active/completion states.

GitHub's repository-license result is `NOASSERTION`. Regardless of possible
reuse permission, no JavaScript controller, polling loop, observer combination,
native mutation, DOM structure, selector, ID, class, global, timer, numeric
value, text, gradient, shimmer animation, CSS, or visual composition was copied
or adapted. Fennevia independently uses its typed bridge, ordinary state,
project-owned XHTML, ADR-026 controller, static progress treatment, and fixed
bounds.

## 6. Implementation record

Source owners:

- `src/firefox/downloads.ts`: fixed module/capability checks, list selection,
  exact view ownership, state mapping, aggregate calculation, opaque handles,
  event batching, failure behavior, and cleanup;
- `src/app/download-state.ts`: immutable copy/validation boundary, revisioned
  per-window adapter, subscriptions, readiness, and disposal;
- `src/shell/DownloadsPanel.svelte`: anonymous summary, accessible determinate
  or indeterminate progress, bounded state pills, and no file actions;
- `src/shell/index.ts`: adapter creation, mount/unmount, readiness, capability,
  and bottom-panel health checks;
- `src/shell/styles/edge-shell.css`: compact bottom layout using existing glass,
  responsive, reduced-motion, solid-surface, and forced-colors contracts; and
- `profile/chrome/fennevia/content/runtime/WindowShell.sys.mjs`: fixed loader,
  per-window bridge ownership, async health readiness, fail-open callback, and
  reverse cleanup.

Fixed bounds and semantics:

| Control | Selected value |
| --- | ---: |
| Anonymous item summaries | 6 |
| Newly observed terminal records retained | 3 |
| Each state count | 999 plus overflow flag |
| Item opaque-ID validation | 160 characters |
| Aggregate output | integer 0–100 or explicit indeterminate |
| Polling/timer count | 0 |
| File/lifecycle actions | 0 |

The panel consumes the existing bottom host and shared surface controller. It
adds no host, edge trigger, programmatic reveal, timer, popup owner, z-index
system, content margin, or native-hide selector. Hidden updates modify only
state. Keyboard reveal remains the shared `Ctrl+Alt+Shift+ArrowDown` path;
pointer, focus, Escape, corners, collision, fullscreen, modal, reduced-motion,
transparency, and forced-colors behavior remain ADR-026 responsibilities.

## 7. Security and privacy review

- Native list, view, download, source, target, error, and window objects remain
  in `src/firefox/` and the runtime owner.
- Filenames, source/referrer URLs, target paths, private markers, principals,
  headers, cookies, and named byte counts never enter Svelte, DOM attributes,
  logs, persistence, or shared evidence.
- IDs are context-bound opaque registry values and become stale on disposal.
- State collections and counts are bounded before application/Svelte use.
- Text output is fixed project copy; no user-derived download string is shown.
- No runtime network endpoint, analytics, remote asset, dependency, mapping,
  executable code, file operation, or privileged action was added.
- Download events never request a bottom-edge reveal.
- Native Downloads panel/button, notifications, file picker, reputation,
  malware/executable warnings, confirmations, management, and actions remain
  visible and usable.
- Missing or malformed required data fails the owning window open with fixed
  phase/code/symbol/build/window-kind diagnostics and no download value.

Normal windows receive only `PUBLIC`; private windows receive only `PRIVATE`.
Firefox may share a list among windows of the same kind, while Fennevia shares
no adapter, snapshot, handle registry, subscriber, UI state, or diagnostic
payload between windows. Nothing derived from a private download is persisted.

## 8. First causal runtime result

The first real cold start of the completed implementation reached `healthy` and
the bottom panel reached `ready`; no implementation-caused Browser Console
exception occurred. Controlled failures were therefore used to prove the first
causal diagnostics:

- a missing `DownloadList.addView` capability produced
  `FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING` in phase
  `firefox-downloads-capability` with the fixed symbol only; and
- malformed native item data produces
  `FENNEVIA_FIREFOX_DOWNLOAD_RECORD_INVALID` in phase
  `firefox-downloads-event`.

The missing-capability real run removed every project host and retained native
Firefox UI. Exact bridge restoration then recovered ordinary startup without
startup-cache deletion.

## 9. Automated and real Firefox evidence

Repository verification:

```powershell
npm run verify
node --check .\tests\firefox-window-lifecycle.mjs
```

`npm run verify` passed formatting, lint, Svelte/TypeScript checks, 134 Node
tests, dependency audit, deterministic frontend/bridge double builds, exact
manifest synchronization, and the production artifact/security scan.

Real commands use placeholders so local profile and program paths do not enter
shared evidence:

```powershell
node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>'

node .\tests\firefox-window-lifecycle.mjs `
  --firefox '<FIREFOX_PROGRAM>\firefox.exe' `
  --profile '<FENNEVIA_DEV_PROFILE>' `
  --browser-toolbox

pwsh -NoProfile -File .\tests\firefox-bridge-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'

pwsh -NoProfile -File .\tests\firefox-frontend-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'

pwsh -NoProfile -File .\tests\firefox-shell-recovery.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'

pwsh -NoProfile -File .\tests\firefox-fail-open.Tests.ps1 `
  -FirefoxPath '<FIREFOX_PROGRAM>\firefox.exe' `
  -ProfilePath '<FENNEVIA_DEV_PROFILE>'
```

Observed results:

- cold/restart, initial normal, second normal, and private windows passed;
- real PUBLIC/PRIVATE list views reached ready and were removed on disposal;
- one and multiple known-size records produced correct 25, 50, and weighted 41
  percent states; mixed unknown size removed `aria-valuenow` and became
  indeterminate;
- zero-byte, one-byte, and 5 GiB records, rapid additions, pause, native-style
  resume, succeeded, fixed-error failure, cancellation, and removal passed;
- every event received while hidden left the bottom edge hidden; shared keyboard
  reveal and Escape worked without a feature-owned timer;
- the custom bottom surface and Firefox's native Downloads button/panel opened
  and closed alternately, while the custom panel exposed no file action;
- six anonymous item rows plus a fixed overflow marker bounded large bursts;
- native source/path sentinel values appeared in neither bridge snapshots nor
  DOM text/attributes;
- Browser Toolbox confirmed the bottom root and all other authored descendants
  remained inside the five project-owned XHTML boundaries;
- frontend unmount/remount subscribed and unsubscribed the download adapter
  exactly once per mount;
- missing base, bookmarks, downloads, tabs, and navigation capabilities each
  failed open; missing/throwing frontend, missing lifecycle module, and safe
  start also retained native UI;
- hard-disabled cold start emitted zero Fennevia records and created zero project
  hosts; re-enable restored an ordinary fully passing start; and
- every harness closed Firefox and restored its controlled package artifact in
  `finally`.

The real fixture creates native `Download` records with fixed invalid-network
source sentinels and temporary target names, adds them to the selected list,
mutates lifecycle fields through Firefox's change callback, and removes every
record afterward. It never starts a transfer, sends a network request, creates
or executes a target file, or logs the source/target values.

## 10. Remaining risks and update procedure

`Downloads.sys.mjs`, `DownloadList`, `Download` field shape,
`DownloadsCommon.stateOfDownload()`, and browser indicator/panel ownership are
Firefox internals. Before claiming a new stable release:

1. verify the release build/tag and each source/blob dependency above;
2. inspect current toolkit/browser callers, tests, relevant upstream history,
   and all four compatibility canaries;
3. rerun list-type, initial-replay, state-precedence, aggregate, malformed,
   private, event-burst, and exact-removal tests;
4. rebuild and update the copied Firefox/profile through the exact package
   manifest;
5. rerun ordinary, Browser Toolbox, bridge/frontend/shell/bootstrap fail-open,
   hard-disable, and cleanup matrices; and
6. add a new dated research record and superseding ADR if semantics change.

Known intentional deferrals are filenames, per-item byte text, history,
search/filtering, file icons, pause/resume/cancel/retry/open/reveal/delete,
drag-and-drop, notification replacement, safety/reputation UI, and automatic
panel opening. None is silently approximated by the MVP.
