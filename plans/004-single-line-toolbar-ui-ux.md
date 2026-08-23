<!-- SPDX-License-Identifier: MPL-2.0 -->

# Single-line toolbar and shell UI/UX implementation plan

## 1. Status and goal

Status: implementation and focused automation complete on
`codex/fast-edge-debug`; real-Firefox manual validation remains pending.

This fast development pass turns the top surface into one dense, single-line
browser toolbar; exposes Firefox-owned site Trust, permission, extension,
menu, settings, and customization paths; refines the four-edge interaction; and
makes the retained native Windows caption controls visually coherent with the
shell.

The result remains a stock-Firefox Chrome package. It must preserve the shared
edge controller, typed Firefox boundary, project-owned XHTML roots, health gate,
and immediate native fail-open behavior.

The user will perform the final visual and interaction pass after this branch is
pushed. Automated checks in this pass must still cover the changed contracts,
build output, and package inventory. Real-Firefox/manual items that are not run
must remain explicitly unchecked and reported as `not run`.

## 2. Reference boundary

Capability and broad interaction reference only:

- repository: `yutinglia/my-firefox-custom`;
- consulted commit: `7a02f60bb23abe9c191c7fd8cd2a7096bb63aee5`;
- consulted material: repository feature inventory, README files, and the
  user-supplied toolbar screenshot;
- no `.uc.js`, CSS selector, ID, class, timer, global flag, token name, numeric
  value, native-DOM mutation strategy, module layout, icon asset, or visual
  composition may be copied or adapted.

Independently selected Fennevia direction:

- one compact toolbar row with three functional zones rather than a clone of
  the old toolbar;
- ADR-060's fixed packaged Firefox icon family for exact native-equivalent
  controls, ADR-059's separate Trust-state masks, and project-owned caption or
  ambiguous fallback glyphs only where Firefox exposes no exact reusable
  resource; no Firefox asset bytes are copied;
- progressive disclosure at narrow widths while retaining accessible names;
- fixed native capability handoffs rather than cloning arbitrary extension
  identity, labels, icons, commands, or security state;
- a compact segmented caption-control island made from Firefox's retained
  native buttons, not replacement window commands;
- low-motion transitions, visible focus, theme tokens, reduced-transparency,
  reduced-motion, and forced-colors fallbacks.

## 3. Old-project capability disposition

| Capability concept                                    | Fennevia disposition for this pass                                                                                                                                                                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser content border                                | Keep the existing narrow content gutter; verify panels meet the trigger edge without an interaction gap.                                                                                                                                                                   |
| Auto-hidden top/left/right/bottom UI                  | Keep the one shared four-edge controller and the `top > sides > bottom` collision priority.                                                                                                                                                                                |
| Rounded/glass topbar and sidebars                     | Restyle only project-owned surfaces with Fennevia tokens; do not copy the old composition.                                                                                                                                                                                 |
| Sidebar/centered address input                        | Keep the left launcher and centered popup; add a compact address/page launcher to the top row.                                                                                                                                                                             |
| Top page-loading feedback                             | Add a restrained loading accent driven by the existing selected-page loading boolean; do not create another progress listener.                                                                                                                                             |
| Bottom download progress                              | Keep the existing anonymous Downloads bridge and bottom surface.                                                                                                                                                                                                           |
| Floating caption buttons                              | Retain Firefox's native minimize/maximize/restore/close controls and style their container as an independent compact island.                                                                                                                                               |
| Draggable empty chrome                                | Keep neutral panel space draggable and every interactive descendant explicitly `no-drag`; retain the dragged source edge through the native move loop, but classify a stationary release as a click and return it to the shared delayed-hide path.                         |
| Unified extensions and pinned extension actions       | Add a native Unified Extensions handoff plus a complete original-toolbar handoff. Do not clone extension identities or arbitrary extension buttons.                                                                                                                        |
| Firefox app menu, settings, and toolbar customization | Add fixed top-row actions that delegate to current Firefox owners; native customization mode is the only customization UI.                                                                                                                                                 |
| HTTPS/site identity and tracking protection           | ADR-059 presents one Firefox-style Trust shield at the leading edge inside the compact address launcher and one combined popup row. Both retained bridge actions converge on Firefox's current Trust Panel; Fennevia's bounded summary does not replace complete certificate, permission, exception, breach, or tracking data. |
| Site permissions                                      | Add a fixed handoff to Firefox's native permission panel; do not reproduce permission mutation controls in this pass.                                                                                                                                                      |
| Downloads button in the top row                       | Open Firefox's native Downloads panel for its complete item data and actions. Keep the bottom edge as the existing anonymous progress/status surface.                                                                                                                      |
| Native popup glass styling                            | Preserve Firefox-owned panels and theme behavior; do not apply broad native popup selectors.                                                                                                                                                                               |
| Native security-panel replacement                     | Deferred. Record an explicit follow-up to research and reimplement equivalent project-owned identity/protection UI only after its complete data and action contracts are specified.                                                                                        |
| Native status panel restyling                         | Preserve Firefox's native status panel unchanged; no new URL/status data flow in this pass.                                                                                                                                                                                |
| Full-page translation widget                         | ADR-057 adds a placeable semantic button that calls `FullPageTranslationsPanel.open(event)` and routes only the Firefox-owned panel to the clicked host. No page/language/model/result data crosses the bridge.                                                                 |
| Context-menu translation                              | Preserve Firefox's native owner: direct tab-menu open must first call current synchronous `gBrowser.translateTabContextMenu()` and hold NativeUi for `tabContextMenu`; do not add a second translator or remote fallback.                                                                                                                    |
| Native sidebar tool hiding                            | Not needed: active rest already hides exact native sidebar owners with a complete reveal/fallback path.                                                                                                                                                                    |
| Bookmark drag-and-drop/editing                        | Deferred; the bounded right-edge reader/opener may add fixed open/folder/Library context actions, but it must not add drag editing, URL exposure, or a cloned Places menu.                                                                                                                                                                 |
| Local unpacked-extension loader                       | Prohibited by Fennevia's project identity and security model; do not add arbitrary path persistence or a generic loader.                                                                                                                                                   |

## 4. Implementation checklist

### A. Research and architecture

- [x] Record the exact old-project reference commit and no-copy boundary.
- [x] Pin Firefox 153.0.4 official source tag commit
      `c178247e1dfea52241a6b18b18cf3a00f8da935c`.
- [x] Record exact Firefox source owners for site identity, protections,
      Unified Extensions, PanelUI, settings, native customization mode, and
      retained caption controls.
- [x] Add an accepted architecture decision for fixed browser-tool handoffs and
      native caption-control styling without native reparenting or replacement.
- [x] Update the current roadmap/master-plan wording that previously described
      the smaller top surface and unstyled caption controls.

### B. Typed Firefox/browser-tools boundary

- [x] Add a small per-window `src/firefox/` browser-tools controller.
- [x] Validate fixed current capabilities while native UI is still visible.
- [x] Expose only fixed booleans and named actions; expose no native node,
      extension ID/name/icon, arbitrary widget ID, preference value, or URL.
- [x] Re-resolve the owning native target at action time.
- [x] Request the existing native-UI reveal before opening the complete
      original toolbar. ADR-042 later superseded reveal-before-click for the
      six ADR-042 popup-opening actions; ADR-057 later adds the seventh
      translation action. Those re-anchor Firefox-owned panels to the clicked
      project host without revealing native chrome.
- [x] Delegate site identity, protections, site permissions, native Downloads,
      extensions, app menu, settings, and customization to Firefox's current
      implementation.
- [x] Preserve Firefox-owned anchors and panel contents for identity and
      protection details; do not serialize certificate, permission, exception,
      tracker, or extension data through the frontend bridge.
- [x] Add an ordinary application adapter and deterministic disposal.
- [x] Include the new required capabilities in health/fail-open checks.

### C. Single-line top surface

- [x] Remove the generic top panel header/footer from layout while preserving a
      named region, dismiss path, keyboard reveal, and focus restoration.
- [x] Render one row containing navigation, compact address/page status,
      native Trust handoff, new tab, Firefox tools, and
      overflow/native-toolbar access. ADR-059 later merges the left launcher's
      identity/protection chips into one shield embedded at the leading edge of
      the shared address frame.
- [x] Make the address/page capsule open the existing centered popup.
- [x] Use fixed installed Firefox resources for exact native-equivalent icons,
      including Settings, while retaining text-equivalent accessible labels
      and only the reviewed caption/ambiguous project glyph exceptions.
- [x] Add clear hover, active, disabled, focus-visible, loading, private-window,
      narrow-window, forced-colors, and reduced-motion states.
- [x] Use progressive disclosure so the row stays usable without wrapping.
- [x] Keep a short high-contrast shortcut hint as an overlay that reserves no
      layout space. ADR-054 later makes its existing CSS-animation duration
      profile-configurable from 0–10,000 ms (600 ms default); zero omits the
      hint from the Svelte render.
- [x] Preserve `top > left/right > bottom` geometry and add no
      surface-dependent content clearance beyond the requested fixed 7px frame
      gutter.

### D. Caption controls and drag behavior

- [x] Keep the exact Firefox-owned minimize, maximize/restore, and close nodes.
- [x] Style the selected native button group as a compact segmented island with
      balanced spacing and a clearly destructive close hover state.
- [x] Position the island at the content edge while the top surface is hidden
      and immediately below the top surface while it is visible.
- [x] Do not synthesize, replace, reparent, or intercept native window commands.
- [x] Ensure top, side, and bottom neutral regions drag the Firefox window.
- [x] Ensure buttons, fields, tabs, links, and focusable controls never start a
      window drag.
- [x] Ensure a native drag candidate retains its source-edge pointer hold while
      suppressing pointer reveal from the other roots during the native window
      drag. On Windows, consume Firefox's chrome-only drag-region start event
      and synthesized mouse-up, ignore source pointer-out noise during the move
      loop, and retain panel/window fallbacks so a side-panel drag cannot reveal
      the top surface. Confirm movement from the window position or a bounded
      4 CSS px pointer threshold. An actual drag remains held until the next
      real pointer exit; a click-only neutral press explicitly releases through
      the shared inside-window delayed-hide path.

### E. Documentation and provenance

- [x] Add a dated implementation/research record with environment, exact source
      pins, old-project concepts retained, independent design decisions, privacy
      effects, validation, and remaining risk.
- [x] Update `docs/firefox-internals-map.md` for every new symbol/DOM owner and
      caption-style rule.
- [x] Update `docs/security-and-privacy.md` for the fixed native handoffs and
      caption-control review.
- [x] Update `docs/testing-and-recovery.md` with automated and manual matrices.
- [x] Record project-owned identity/protection panel parity as deferred future
      work rather than claiming the bounded summary is a complete replacement.
- [x] Confirm no third-party code or copied asset entered the artifact;
      ADR-059/ADR-060 reference fixed installed Firefox resources without
      vendoring them, so `THIRD_PARTY_NOTICES.md` remains unchanged.

### F. Fast verification, commit, and push

- [x] Format changed source and tests.
- [x] Run focused browser-tools, frontend, native-UI, boundary, health, and
      lifecycle tests.
- [x] Run lint and typecheck for the integrated source boundary.
- [x] Build generated bridge/frontend artifacts and synchronize the package
      manifest from source.
- [x] Run production artifact and provenance leakage checks.
- [x] Review the complete staged diff and `git diff --cached --check`.
- [x] Commit with a Conventional Commits message containing rationale, behavior,
      validation, and remaining manual-test notes.
- [x] Push `codex/fast-edge-debug` to `origin` without force.

## 5. Focused automated evidence

Passed on 2026-08-16 without launching Firefox:

- `npm run build`: deterministic frontend, Firefox bridge, and package-manifest
  synchronization passed.
- Focused Node matrix: 32/32 browser-tools, edge, frontend-build, and native-UI
  tests passed.
- `tests/shell-health.Tests.ps1`: 39/39 lifecycle, health, native-UI, safe-start,
  and host tests passed; its lifecycle harness syntax probe also passed.
- `npm run format:check`, explicit Svelte Prettier check, `npm run lint`, and
  `npm run typecheck`: passed with zero diagnostics.
- `npm run artifacts`: all 12 production artifacts matched the inventory and
  security rules.
- `npm run dependencies:audit` and `node --test tests/license-policy.test.mjs`:
  passed with no installed lifecycle package, no wasm file, and 3/3 licensing
  policy checks; `tests/firefox-window-lifecycle.mjs` also passed `node --check`.

The complete `npm test`/PowerShell/real-Firefox matrices were intentionally not
run for this fast pass. They are not implied by the focused results above.

## 6. Post-push manual Firefox checklist

- [ ] Cold start shows no original toolbar flash after activation.
      ADR-050 implements a first-paint hide for the native toolbox; real
      Firefox verification of this row remains `not run`.
- [ ] Top edge reveals one stable row with no twitch or trigger gap.
- [ ] Back, forward, reload/stop, new tab, and address popup work.
- [ ] The shield appears at the leading edge inside the compact address frame,
      tracks active/insecure/disabled/warning state, and opens Firefox's native
      Trust Panel with current connection, certificate, tracker, exception,
      breach, and protection details.
- [ ] Site permissions opens Firefox's native permission panel.
- [ ] The top-row Downloads button opens Firefox's complete native Downloads
      panel; the bottom edge remains the bounded progress/status view.
- [ ] Unified Extensions opens the Firefox-owned extension panel.
- [ ] Firefox app menu opens from the custom top row.
- [ ] Settings opens native `about:preferences` through Firefox.
- [ ] Customize enters and exits Firefox's original customization mode, with
      Fennevia suspended for the entire mode.
- [ ] Original-toolbar handoff exposes pinned extension buttons and every
      remaining native toolbar item.
- [ ] Caption controls show, look balanced, and minimize/maximize/restore/close
      correctly in restored and maximized windows.
- [ ] Dragging empty top/left/right/bottom chrome moves the window; releasing a
      drag from any edge does not leave that panel open or reveal another edge,
      including top after a left/right drag.
- [ ] Clicking empty draggable top/left/right/bottom chrome without moving the
      window does not leave that panel permanently held; it hides after the
      configured inside-window delay even if no other panel is revealed first.
- [ ] Left and right panels begin below a visible top row; bottom yields to both
      side panels; no panels overlap incorrectly.
- [ ] Moving from a panel into page content uses the configured in-window hide
      delay; leaving the Firefox window uses the configured window-leave delay,
      and the window-level fallback does not start a second timer.
- [ ] Shortcut hint is readable, floats without taking space, and disappears at
      the configured duration; zero renders no hint, and reduced motion uses a
      non-fading expiry.
- [ ] Narrow, short, maximized, browser-fullscreen, DOM-fullscreen, private, and
      second-window layouts remain usable.
- [ ] Reduced motion, forced colors, and reduced transparency remain readable.
- [ ] Emergency fallback restores all native Firefox UI immediately.
