<!-- SPDX-License-Identifier: MPL-2.0 -->

# Topbar widget mirror implementation plan

## 1. Status and goal

Status: implementation and documentation complete on
`feat/issue-64-topbar-widget-mirror` (issue #64); the manual real-Firefox
checklist in section 5 is still `not run`.

This pass starts the deferred `extension toolbar/action replacement` item in
`plans/002-shell-roadmap.md`. The Fennevia top row gains a widget zone that
mirrors the user's customized Firefox nav-bar `CustomizableUI` placements with
project-owned components and styling:

- extension action widgets render with their real icon, badge, and tooltip;
- pinned built-in widgets render with curated project glyphs for a known set
  and a generic glyph otherwise, and stay activatable;
- spacers and springs render as visual gaps;
- placements already represented by fixed Fennevia controls are skipped.

Native customize mode remains the only customization editor. Fennevia never
writes `CustomizableUI` state. After `aftercustomization`, pin/unpin from the
Unified Extensions panel, or extension install/uninstall/disable, the mirror
refreshes from the current placements.

Popups triggered from mirrored widgets stay Firefox-owned and re-anchor to the
clicked project button through the ADR-042 host-anchor and NativeUi
handoff-token path.

## 2. Owner-approved rule update

The project owner approved (2026-08-17, issue #64) a narrow relaxation of
ADR-037 and `docs/security-and-privacy.md` section 7.4, recorded as ADR-044 in
the same change set:

- read-only enumeration of nav-bar `CustomizableUI` placements is allowed;
- extension identity required for rendering (label, tooltip, icon URL, badge)
  may enter frontend in-memory state for rendering only;
- extension identity remains banned from logs, persistence, diagnostics, CSS
  variables, and root datasets; diagnostics carry widget counts and fixed
  codes only.

All other safety rules stay in force: no `CustomizableUI` writes, no panel
content cloning, no native-DOM reparenting, no drag-and-drop editor, fail-open
unchanged.

## 3. Reference boundary

`yutinglia/my-firefox-custom` is not consulted for this pass. The mirrored
widget set, ordering, and identity come from Firefox's own `CustomizableUI`
state. Firefox 153.0.4 sources are pinned in
`docs/research/firefox-153-toolbar-widget-mirror.md`.

## 4. Implementation checklist

### A. Research and architecture

- [x] Record Firefox 153.0.4 source pins for `CustomizableUI.sys.mjs` area
      queries, widget wrappers, and the listener contract.
- [x] Record the extension action widget shape from `ext-browserAction.js` and
      `ExtensionPopups.sys.mjs`: widget id convention, node attributes for
      label/icon/badge, popup panel identity, and anchoring behavior.
- [x] Record moz-extension icon loadability from the system-principal XHTML
      host and the fallback glyph policy (source-backed; the live-load check
      stays in the section 5 manual list).
- [x] Record built-in widget activation semantics and the panel re-anchor
      policy for panels the activation opens.
- [x] Record private-window behavior for extensions not allowed in private
      browsing.
- [x] Check the compatibility canaries for current CustomizableUI usage
      changes; do not copy code.
- [x] Add ADR-044 and annotate the superseded ADR-037 clause.

### B. Typed toolbar-widgets boundary

- [x] Add a per-window `src/firefox/toolbar-widgets.ts` controller following
      the bridge-boundary capability/diagnostic pattern.
- [x] Snapshot: frozen ordered list of
      `{ handle, kind, label, tooltip, iconUrl, badgeText, badgeBackground, disabled }`
      for mirrorable nav-bar placements; raw widget ids stay privileged.
- [x] Fixed skip list for placements represented by fixed Fennevia controls.
- [x] Subscribe: `CustomizableUI` listener plus bounded widget-node
      observation; push revision snapshots; refresh after customization ends.
- [x] Invoke: activate the current Firefox owner for the widget; re-anchor
      resulting Firefox-owned popups to the clicked project host through the
      ADR-042 machinery; keep the ultimate fail-open fallback.
- [x] Optional capability: missing `CustomizableUI` disables the widget zone
      without failing the window or activation health.
- [x] Deterministic disposal: listeners, observers, handle registry, pending
      popups.

### C. Adapter and top-surface UI

- [x] Add `src/app/toolbar-widgets-state.ts` with immutable snapshots,
      subscription, and disposal, following the existing adapter pattern.
- [x] Render the widget zone on the top row with project glass styling,
      real icons via in-memory `img` sources, badge chips, tooltips, keyboard
      access, and focus-visible states.
- [x] Single-line policy: the zone never wraps; overflow scrolls within the
      zone.
- [x] Forced-colors, reduced-motion, and reduced-transparency fallbacks.
- [x] Wire the bridge in `WindowShell.sys.mjs` and `mountShellApp` following
      the existing bridge conventions; rebuild generated artifacts.

### D. Lifecycle integration

- [x] Customize mode suspension unchanged; mirror refresh after exit.
- [x] Pin/unpin, install/uninstall, enable/disable reflected through listener
      events without polling.
- [x] Private windows follow the researched visibility policy (placements are
      mirrored as Firefox presents them; extensions not allowed in private
      browsing are absent from that window's nav-bar placements).
- [x] Second window and window close leave no shared or leaked state
      (per-window bridge state; disposal covered by unit tests).

### E. Documentation and tests

- [x] Unit tests: snapshot mapping, skip list, event-driven updates, invoke
      and fallback, missing capability, disposal; adapter tests; coverage
      floors hold.
- [x] Update `docs/firefox-internals-map.md`, `docs/security-and-privacy.md`,
      `docs/testing-and-recovery.md`, `plans/002-shell-roadmap.md`, README,
      and issue #1 state.
- [x] `npm run verify` passes.

## 5. Post-merge manual Firefox checklist

- [ ] Pinned extension buttons render with real icon/badge and match nav-bar
      order.
- [ ] Clicking an extension button opens its Firefox-owned popup anchored to
      the project button; non-popup actions fire the extension click.
- [ ] Pinned built-in widgets activate their native behavior.
- [ ] Customize enter/exit updates the mirror to the new placements.
- [ ] Pin/unpin from the Unified Extensions panel updates the mirror live.
- [ ] Install and uninstall of an extension updates the mirror live.
- [ ] Badge text/color updates render live.
- [ ] Private window hides or disables non-private-allowed extensions per the
      recorded policy.
- [ ] Second window mirrors independently; window close leaks nothing.
- [ ] Missing/failed CustomizableUI leaves the fixed controls and native
      fail-open path fully usable.
