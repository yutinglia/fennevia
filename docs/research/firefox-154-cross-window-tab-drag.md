# Firefox 154 cross-window tab drag and detach research

## Environment

- Date: 2026-08-22
- Firefox version: 154.0 release
- Build ID: `20260812182057`
- Channel: release
- Operating system: Windows 11, x64
- Profile state: owner runtime report plus official-source review and focused
  local automation; clean development-profile and Browser Toolbox replay of
  this fix: **not run**
- Project base commit: `00811d7`
- Working branch: `codex/improve-tab-drag-preview`
- Official Firefox commit:
  [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086)

## Owner report and first causal error

The owner reported four connected failures in the current project tab drag:

1. a tab could not be dropped into another Fennevia browser window's tab bar;
2. dropping over another Firefox content area did not append it there, and
   dropping over a non-Firefox application did not create a Firefox window;
3. the left surface could remain held open after drag end;
4. dropping over browser content navigated to
   `http://tab-registry-3-handle-2`.

A follow-up target-window report identified two presentation/cleanup defects:
leaving the target window again without dropping could retain an empty target
row, and the accepted target position reserved only a blank slot without a
visible tab-shaped preview.

A second follow-up report found that a successful cross-window transfer could
occasionally leave the source window's left surface held open. The source tab
had already left that window, but source-side visual cleanup still depended on
the later HTML drag-end event reaching a listener in the source window.

The first causal project error for the navigation was direct and reproducible
from source: `TabStrip.svelte` put its internal opaque tab-registry ID into
`DataTransfer` as `text/plain`. Browser content or the platform could therefore
treat a value such as `tab-registry-3-handle-2` as user-dropped navigation text.
The source button also owned `dragend` cleanup, so a drag ending beyond that
element was not a reliable release point for the shared left-edge pointer hold.

No complete URL, title, profile path, or other browsing value from the owner's
runtime was collected or logged. The reported internal handle is used here
only as the fixed causal shape already visible in project source.

## Current Firefox behavior

Firefox 154's
[`drag-and-drop.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/tabbrowser/content/drag-and-drop.js)
provides the relevant behavior:

- a valid drop into another browser window delegates to that target
  `gBrowser.adoptTab(...)`;
- an unconsumed, non-cancelled drag end checks Firefox's detach policy and
  delegates to the browser-window replacement path;
- `mozUserCancelled` and an accepted drop prevent detach.

The target drop handler performs `adoptTab` synchronously while handling the
accepted target drop; source `dragend` is a separate terminal handler. Firefox
source does not establish that an HTML `dragend` whose original project-owned
source node has already been detached must traverse the source browser window.
Fennevia therefore treats the owner-observed missing cleanup as an event-path
race: this is an implementation inference from the source order and project
state transition, not a new Firefox contract.

The same source also keeps live tab motion to a same-document drag. For
vertical tabs configured to expand on hover, `_updateTabStylesOnDrag` waits for
`SidebarController.expandOnHoverComplete` before sizing the moving tab to the
expanded sidebar. Stock Firefox therefore starts from a present native target
strip and explicitly coordinates drag geometry with sidebar expansion. A
Fennevia target cannot rely on that native visibility because its project left
surface is hidden at rest; it must reveal its own target surface before the
pointer can reach the list.

Firefox 154's
[`tabbrowser.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/tabbrowser/content/tabbrowser.js)
owns `adoptTab(tab, options)` and `replaceTabWithWindow(tab, options)`.
`adoptTab` creates/adopts into the target tabbrowser and closes the source
owner through Firefox's own browser-swap path. `replaceTabWithWindow` delegates
creation and transfer to Firefox and returns no new window for a sole-tab
source. These are unstable internals and are therefore isolated in the tabs
controller, required by health, and recorded in the internals map.

Firefox 154's
[`EventStateManager.cpp`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/dom/events/EventStateManager.cpp)
provides the remote-content event-order evidence. A top-level remote target is
resolved from the parent-process `<browser>` element. `PostHandleEvent` calls
`HandleCrossProcessEvent` only after parent chrome DOM dispatch, and the
`dragover` path distinguishes a chrome-only accepted drop through
`SetOnlyChromeDrop`. Consequently, a capture listener on the actual browser
window can accept Fennevia's marker before Firefox forwards the drag to the
remote page. In the same source, internal frame/content target changes generate
`dragleave` with the next chrome target as non-null `relatedTarget`, while the
actual window `eDragExit` generates `dragleave` with `relatedTarget = nullptr`.
That distinction is the source-backed cancellation boundary for removing a
target preview after a no-drop window exit. This is source evidence for the
selected implementation; the real Firefox replay remains pending.

No Firefox source code, selector, class, timing value, native event payload, or
DOM strategy was copied. The official source is behavioral and API evidence
only.

## Compatibility canaries

The same-day review recorded in
`docs/research/firefox-153-154-panel-context-actions.md` and
`docs/research/firefox-154-tab-drag-spatial-preview.md` pinned the current
Alice0775/userChrome.js, MrOtherGuy/fx-autoconfig,
xiaoxiaoflood/firefox-scripts, and aminomancer/uc.css.js revisions. None
provides a smaller Fennevia-specific cross-window contract. Loader discovery,
metadata, sandbox, native-tab-DOM, and window-global customization patterns are
irrelevant to this project-owned Svelte strip and were not adapted.
`yutinglia/my-firefox-custom` was not consulted.

## Options considered

1. Keep the tab ID in `text/plain` and add target listeners. Rejected because
   it preserves the demonstrated navigation injection path.
2. Serialize a native tab, URL, title, or random transfer ID into drag data.
   Rejected because native objects cannot safely cross HTML drag boundaries and
   browsing values need not leave the privileged process.
3. Give each window an independent transfer registry. Rejected because target
   windows could not resolve source ownership without copying privileged state
   or adding a general cross-window lookup layer.
4. Reimplement tabs or browser windows in Svelte. Prohibited by native-UI
   ownership and fail-open rules.
5. Resolve target Firefox windows by source `dragend` screen coordinates.
   Rejected after source review because a non-Firefox foreground window may
   cover a background Firefox window at the same point; geometry cannot prove
   which application received the drop.
6. Use one ephemeral process-owned native transfer, a marker-only OS payload,
   actual target-window event capture plus `adoptTab`, and source-window native
   detach. Selected as the minimum contract matching Firefox's ownership model.

## Independent Fennevia design

- Exactly one process coordinator may own an active drag. It stores a random
  bounded ID, source context and window kind, pinned state, one native tab, and
  an active-state predicate. Beginning another live drag is rejected.
- `DataTransfer.clearData()` runs before adding only
  `application/x-fennevia-tab-transfer` with constant value `1`. No opaque tab
  ID or random drag ID is transferable, and no `text/plain` or URL flavor is
  present.
- Same-window list drops use the existing `moveTabTo` path. Target-window list
  drops inspect ordinary metadata and invoke only that target's bridge; the
  bridge adopts at the resolved pinned-aware insertion index and returns a new
  target-scoped opaque ID.
- A drop over another Firefox content area appends. The target chrome window
  capture listener receives the event before Firefox's post-dispatch remote
  forwarding, prevents page handling, and calls that target's bridge with the
  current tab count. No source-side geometry fallback guesses a target window.
- A same-kind marker entering or moving over another browser window activates
  that target's existing shared `setPointerHeld("left", true)` path before
  project-frame routing. The target left surface therefore reveals immediately
  even when the first event is over browser content, and remains held while the
  pointer moves between its content and tab list.
- While an external drag has an accepted target index, the target list appends
  one invisible, aria-hidden, non-interactive flex item matching the existing
  Fennevia row height. This real layout slot absorbs the one-row transform
  preview, so a short list extends to the prospective destination instead of
  exposing a scrollbar caused only by transformed overflow. Lists that
  genuinely exceed the available panel height remain scrollable.
- A separate absolute, pointer-transparent tab-shaped row is visible at the
  exact accepted insertion geometry. It uses only the packaged Firefox tab
  icon and a fixed localized “Moving tab” label. It is decorative and does not
  expose or copy the source title, URL, favicon value, native tab DOM, or drag
  ID. Browser content previews append-at-end; the tab list previews its
  pinned-aware insertion point; project frame space outside the list shows no
  false landing preview.
- Window-capture `dragleave` ignores non-null `relatedTarget` transitions
  between nested chrome descendants and treats null `relatedTarget` as the
  actual window exit documented by Firefox's `eDragExit` path. That exit,
  target drop, observed drag end, setup failure, or disposal clears the visible
  preview, layout slot, external state, and shared hold without a private
  timer; the established edge controller owns delayed hide.
- A drag not consumed by another Fennevia window delegates to
  `replaceTabWithWindow` unless Firefox's detach preference disables it. A
  sole-tab source is left unchanged. Escape cancellation never detaches.
- Normal and private targets are mutually invisible. Active source transfers
  and browser-window capture listeners are removed on window/controller
  disposal. The coordinator snapshot contains opaque IDs only, never the
  native tab.
- A capture listener on the owning browser window receives `dragend` even when
  the event still traverses that window. As a second, idempotent completion
  signal, the source adapter compares the active dragged ID with every
  reconciled tab snapshot. If the ID disappears after target adoption, it
  clears source visual state and the shared pointer hold, then waits for the DOM
  reconciliation tick and releases focus/keyboard holds only if focus is no
  longer inside the source surface. This covers removal of the focused dragged
  row without hiding a source surface that still owns intentional focus. It
  does not invoke source `endDrag` while the target is still consuming the
  coordinator transfer. A same-window reorder retains the ID and does not
  trigger this fallback. A later `dragend`, every cancellation, setup failure,
  and component disposal remains safe and converges on the same cleared
  frontend state.

## Security, privacy, and ownership

The owner's explicit request for cross-window transfer approves the narrow
ADR-063 exception to the former no-cross-window-native-handle rule. Only the
single active privileged coordinator may temporarily retain the native source
tab. It cannot persist, enumerate tabs, retain completed native objects, cross
normal/private kinds, or expose the native value to Svelte, DOM, `DataTransfer`,
logs, diagnostics, preferences, clipboard, telemetry, or a network endpoint.

The random drag ID is visible only to the source window's ordinary adapter for
matching its later `dragend`; targets receive a copied ID, pinned boolean, and
same/other-window enum only. The OS payload has no identifier at all. Tab URLs,
titles, favicons, content, history, principals, containers, and browser objects
never enter the coordinator's public inspection result. No new dependency,
runtime network request, resource mapping, content-accessible asset,
persistence path, or native DOM mutation is introduced.

No external code or asset was copied or adapted. Official Firefox source is
MPL-licensed evidence only, so no `THIRD_PARTY_NOTICES.md` update is required.

## Validation

Focused automated validation covers:

- same-window move and completed-transfer behavior;
- cross-window insertion and target-scoped opaque identity;
- browser-window capture routing for target-content append;
- normal/private rejection;
- cancellation, detach-policy blocking, and external-drop detach delegation;
- stale transfer, single-active-drag, token validation, and exact disposal;
- marker-only drag data with an explicit absence of `text/plain`/`getData`;
- capture-phase `dragend` registration/removal and shared-hold cleanup source;
- source-snapshot disappearance cleanup after adoption, post-reconciliation
  focus release, and no false cleanup for same-window reorder;
- pinned-aware external insertion and spatial gap shifts;
- external target row-height layout reservation, visible generic target row,
  true-window-exit cleanup, and ordinary default tab cursor;
- missing `adoptTab`/`replaceTabWithWindow` capability diagnostics.

Final ordinary-gate results are recorded in `docs/testing-and-recovery.md` and
`docs/current-status.md`. Completed locally on 2026-08-22:

- focused Node set: **passed**, 36/36 tests; the later source auto-hide
  regression in `tests/tab-strip.test.mjs` passed 9/9;
- `npm run typecheck`: **passed**, 0 errors and 0 warnings;
- `npm run lint`: **passed**;
- `npm run verify`: **passed** with 331/331 Node tests, 87.27% line
  coverage, 79.19% branch coverage, 95.23% function coverage, every fixed
  PowerShell 7 suite, dependency audit, deterministic frontend/bridge builds,
  and 14/14 accepted production artifacts;
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File
.\tests\run-static-powershell-tests.ps1`: **passed** every fixed-list suite
  under Windows PowerShell 5.1.

Real Firefox 153.0.4/154.0 source/target tab-bar drops, source/target content
drops, non-Firefox application drops, Escape, sole-tab behavior, overlapping
windows, pinned partitions, visible target-row placement, no-drop target-window
exit cleanup, left-edge auto-hide, reduced motion, forced colors,
normal/second/private isolation, target/source window closure, fail-open, and
Browser Console/Toolbox ownership rows are **not run**, not passed.
