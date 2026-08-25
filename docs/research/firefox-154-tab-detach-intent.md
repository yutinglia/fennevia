# Firefox 154 tab-detach intent and drag-event ownership research

## Environment and reports

- Date: 2026-08-26.
- Supported source target: Firefox 154.0 release at official commit
  [`032a9fc1ac0cc3209f7c142744ba2e40847c8086`](https://github.com/mozilla-firefox/firefox/commit/032a9fc1ac0cc3209f7c142744ba2e40847c8086).
- Owner reproduction and probe: Firefox 154.0.1 Build ID
  `20260824154132`, Windows x64, normal window, existing marker-owned
  development profile, runtime-reported project commit `unknown`.
- Project base commit: `a25a84d`.
- Request source: direct project-owner report; no dedicated GitHub issue.
- No URL, title, query, profile path, or other browsing value was collected.

The owner reported two initial failure shapes:

1. A quick or slightly careless click-drag could detach a tab, sometimes more
   than once. A new-window startup stack showed `MozTabbrowserTab.isEmpty`
   reading `linkedBrowser.currentURI` while the browser was null.
2. Dropping a tab at its original position could leave that row unable to drag.
   Repeating the gesture with a second tab produced
   `FENNEVIA_FIREFOX_TAB_DRAG_BEGIN_REJECTED` at `tabs.beginDrag`, followed by
   the shell's fail-open disposal and native-Firefox fallback.

Intermediate attempts stopped the fallback but also left tabs able to move
only about one index, or not at all, and unable to leave the tabbar. The owner
reproduced that behavior after installed runtime and shell hashes had been
matched to generated repository artifacts, ruling out a stale deployment for
that run.

## Existing behavior and initial fixes

ADR-063 lets an unconsumed, non-cancelled source drag call Firefox's native
window-detach action. The frontend previously treated every source `dragend`
except Escape as non-cancelled, even when HTML drag began after only a tiny
pointer wobble and never reached an owned drop target. A terminal displacement
gate was therefore added without delaying `dragstart`: the source retains one
bounded screen point, and detach is cancelled unless the terminal point is at
least 16 CSS pixels away.

The process drag coordinator permits one active transfer. The second reported
stack directly showed a stale same-window transfer reaching a later
`beginDrag`. The controller now cancels an active transfer immediately before
a new physical drag only when that same opaque window context owns it. It does
not cancel another window's active transfer, and it adds no persistent tab lock
or cooldown.

Those changes addressed destructive intent and prevented a stale local gesture
from escalating to shell fallback, but they did not explain why ordinary HTML
drag stopped progressing. Static code reading alone did not reveal the event
owner that cancelled it, so a temporary runtime probe was added.

## Probe design

The probe used a unique session identifier and bounded event/state categories.
It recorded no browsing values. Component records were buffered and written
outside timing-sensitive event handlers. Window records distinguished capture,
target/bubble tail, marker presence, `defaultPrevented`, `effectAllowed`, and
whether native drag lifecycle events followed. The probe and its raw local log
were temporary development artifacts and are not part of the package.

An earlier Marionette attempt synthesized `dragstart` but could not drive the
browser-chrome native `dragover`/`dragend` path, so it was treated only as a tool
limit, not acceptance evidence. The decisive evidence came from the owner's
physical reproduction.

## Decisive evidence and causal chain

The first physical probe run established:

- the tab component entered and exited its `dragstart` handler;
- `DataTransfer` contained the Fennevia marker and `effectAllowed` was `move`;
- at component exit, `defaultPrevented` was false;
- at the window bubble tail/final listener, the same event had
  `defaultPrevented` true;
- no subsequent native `dragenter`, `dragover`, `drop`, or `dragend` arrived;
  ordinary pointer movement continued instead.

This proved that an ancestor cancelled `dragstart` after the tab handler. The
ancestor was `ComposableLayout.svelte`: every layout node had the layout
`beginDrag` handler, and when Customize was closed it called
`event.preventDefault()` without first checking whether the event belonged to
that node. A child tab's bubbling drag was therefore mistaken for a forbidden
layout drag.

The selected fix makes layout drag ownership explicit:

```text
if (event.target !== event.currentTarget) return
```

After that guard was deployed, the probe showed native drag lifecycle events
again. The owner confirmed outside-window detach and cross-window transfer.

Same-window reorder still failed in that intermediate build. The next probe
showed that a capture-phase in-frame fallback introduced during the earlier
attempt queued source cancellation before the local Svelte drop handler could
consume the coordinator transfer. This explained the asymmetric symptom:
outside and cross-window paths worked, while local reorder did not. The
fallback was removed. Subsequent records showed successful local drop results
at multiple target indices, and the owner confirmed the issue fixed.

The probe did not support the speculative CSS caption-hit-test explanation.
The temporary tab-strip `-moz-window-dragging: no-drag` rule and source-row
pointer-event change were reverted.

## Firefox 154 source evidence

Firefox 154's
[`drag-and-drop.js`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/tabbrowser/content/drag-and-drop.js#L707-L772)
suppresses detach for cancellation, an accepted drop, disabled policy or
Customize mode, and a release still near the native tab strip before calling
`replaceTabsWithWindow`. Fennevia had the policy checks but no equivalent
explicit-intent guard for its project-owned strip.

Firefox's
[`test_drag_coords.html`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/dom/events/test/test_drag_coords.html)
verifies that synthesized `dragend.screenX/screenY` retains the terminal offset
from `dragstart`. ADR-067 still prohibits using those coordinates as a panel
hit test. ADR-081 uses only the start-to-terminal distance as destructive-action
intent.

Firefox 154's
[`replaceTabWithWindow`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/tabbrowser/content/tabbrowser.js#L6918-L6951)
returns the opened window before startup adopts the passed tab.
[`_setInitialFocus`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/base/content/browser-init.js#L787-L826)
can then read `getTabToAdopt()?.isEmpty`, whose
[`MozTabbrowserTab.isEmpty`](https://github.com/mozilla-firefox/firefox/blob/032a9fc1ac0cc3209f7c142744ba2e40847c8086/browser/components/tabbrowser/content/tab.js#L280-L310)
getter dereferences `linkedBrowser.currentURI`. This makes the reported
null-browser stack consistent with rapidly repeated detach/adoption, but the
relationship was not captured under Browser Toolbox and remains an inference,
not a proven root cause.

## Compatibility canaries

The required canaries were checked at their current heads:

- `alice0775/userChrome.js`
  [`a39f5cb60d40d01a1ae6d65935db152e7ac23111`](https://github.com/alice0775/userChrome.js/commit/a39f5cb60d40d01a1ae6d65935db152e7ac23111);
- `MrOtherGuy/fx-autoconfig`
  [`dfdab5684faffc112b76ccb1d8cab7f75da0102c`](https://github.com/MrOtherGuy/fx-autoconfig/commit/dfdab5684faffc112b76ccb1d8cab7f75da0102c);
- `xiaoxiaoflood/firefox-scripts`
  [`a898ac59fb0ca3886c0c46b184fdbc037c83c037`](https://github.com/xiaoxiaoflood/firefox-scripts/commit/a898ac59fb0ca3886c0c46b184fdbc037c83c037);
- `aminomancer/uc.css.js`
  [`88514013ddc375f4770f4a35d8d07a91d6dd7d8f`](https://github.com/aminomancer/uc.css.js/commit/88514013ddc375f4770f4a35d8d07a91d6dd7d8f).

No current issue in those repositories described this project-owned layout
event conflict, and no implementation was copied or adapted.
`yutinglia/my-firefox-custom` was not consulted.

## Options considered

1. Remove tab detach. Rejected because intentional source-content and external
   detach are accepted ADR-063 behavior.
2. Cancel `dragstart` until movement exceeds a threshold. Rejected because a
   cancelled HTML drag cannot resume in the same gesture and would break
   reorder and adoption.
3. Add a window-wide cooldown or retain a post-detach tab set. Rejected because
   it blocks later intentional gestures and adds timing or stale identity state.
4. Arm detach only after observing an outside-frame event. Rejected after owner
   testing because missing outside events disabled ordinary long-distance and
   outside-tabbar dragging.
5. Add a capture-phase in-frame terminal fallback. Rejected by probe evidence:
   it raced ahead of the delegated local drop path and broke same-window
   reorder.
6. Make the complete tab strip a CSS `no-drag` client region and alter source
   pointer hit testing. Rejected after the event-phase probe identified the
   cancelling ancestor; the CSS changes were not causal and were reverted.
7. Gate only an unconsumed terminal detach by a 16-pixel start/end distance.
   Selected because it preserves the existing HTML drag lifecycle.
8. Ignore bubbled child `dragstart` events in the composable-layout handler.
   Selected because event ownership is exact and it preserves layout dragging
   during Customize.
9. Recover a stale coordinator transfer only for a new drag from the same
   opaque window context. Selected as a narrow fail-open protection; genuine
   cross-window transfers remain protected.

## Independent Fennevia design

- `dragstart` begins the existing coordinator transfer immediately.
- Composable layout handles only events targeted at the exact draggable layout
  node; child features retain their own drag ownership.
- The source stores one bounded start point. An unconsumed terminal at least 16
  CSS pixels away may use the existing detach action; a smaller or invalid
  displacement is cancelled.
- Local list/drop-zone handlers remain the only in-frame tab-drop owner. There
  is no capture-phase terminal fallback.
- A new source drag can recover only its own window context's stale transfer.
- No post-detach tab ID, timer, cooldown, transferable identifier, log field,
  preference, persistence, network request, or new Firefox capability is added.
- The temporary probe, its runtime hook, and raw log are removed after owner
  confirmation.

## Verification and limits

Before the final probe-guided event-ownership correction, the focused tests and
then-current full gate passed, but they did not detect the Svelte ancestor event
cancellation or the fallback ordering race. That limitation is why direct
event-phase evidence was required rather than treating a green static/unit gate
as proof of the interactive behavior.

Final acceptance evidence is the owner-operated Firefox 154.0.1 run: outside
detach and cross-window transfer worked after the event-ownership guard, and
same-window reorder across multiple indices worked after removal of the racing
fallback. The owner then confirmed the issue fixed.

After probe removal and the final correction, the owner requested the complete
automated gate. `npm run verify` passed formatting, lint, type checking, 428/428
coverage tests, the pwsh fixed-list suites, dependency audit, deterministic
build, and the 14-file production-artifact scan. Coverage was 88.48% lines and
95.63% functions. The additional Windows PowerShell 5.1 fixed-list suite also
passed. The private-window, complete Browser Console, and full release matrices
remain `not run`. No acceptance claim is based on Marionette synthesis.

No external code, selector, class, timer, or numeric value was copied or
adapted. Official Firefox source was used only as behavior and race evidence.
