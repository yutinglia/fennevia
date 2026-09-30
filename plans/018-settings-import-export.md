<!-- SPDX-License-Identifier: MPL-2.0 -->

# Fennevia settings import and export

## Owner request and scope

On 2026-10-01 the owner requested an import/export feature after supplying a
redacted layout for diagnosis, and selected all Fennevia layout, appearance,
panel, and interaction settings. This plan precedes implementation.

The feature exports the effective values of the three existing bounded
customize preferences into one versioned JSON file. It does not export the
Firefox profile, browsing data, extension data, operational bootstrap flags,
or arbitrary preferences. Extension toolbar references remain local widget
identifiers so the backup can restore their placement; adopted-widget ownership
is always recomputed on the receiving profile.

## Design

- Add a dedicated settings-transfer section to the existing customize UI.
  Keep the composition host as wiring and provide localized, keyboard-accessible
  Export and Import actions with pending/result states.
- Use Firefox-owned file pickers. Paths, file contents, and raw widget IDs stay
  in the Firefox bridge. The frontend receives only bounded result states and
  counts. No content-accessible mapping or network service is added.
- Keep the file format explicitly branded and versioned. Validate a bounded
  UTF-8 JSON document through the current layout/style/panel validators before
  offering an import confirmation. Reject malformed, oversized, unsupported,
  or inaccessible-Customize configurations without writes.
- Confirm replacement after reading and validating the chosen file. Cancel
  changes nothing. Preserve the current state if another window edits settings
  while the import is being reviewed.
- Apply all three preferences together, restore prior values and native widget
  placement if a write fails, and retain only this profile's actual adoption
  ownership. Missing extensions must not trigger installation or network work.
- Reuse the toolbar-widgets controller, adapter, shared customize lifecycle,
  and existing native adoption rules. Put file I/O, portable validation, and
  transaction logic in dedicated modules with deterministic disposal.

## Evidence and checks

Pin Firefox 157 file-picker and local-file APIs to upstream definitions and
callers, and prove the minimum native capability in the marker-owned profile
before integration. Update ADRs, internals map, security/privacy, and the
testing matrix for the new user-initiated local-file flow.

Focused tests cover round-trip defaults/custom layouts, all settings fields,
size and schema rejection, ownership spoofing, missing widget references,
cancel, stale imports, partial-write rollback, and disposal during pending
selection/I/O. Real Firefox checks cover effective export/import, frontend
actions, preference restoration, and retained native fallback. Run the ordinary
CI-equivalent gate after integration; record unrun native picker GUI, hardware,
and release-matrix checks honestly.

Status: development implementation complete, unreleased. `npm run verify`
passed with 492/492 Node tests, the PowerShell 7 fixed-list suite, dependency
audit, deterministic build and 14/14 production artifacts. The complete Windows
PowerShell 5.1 fixed-list suite also passed. Firefox 157's settings UI/file-I/O
regression and the configured-window-control/download/bookmark regressions pass
on the final generated artifacts. Native picker GUI, second/private-window
transfer, hardware/accessibility release matrices and GitHub-hosted CI remain
not run. Exact scope and hashes: `docs/research/firefox-157-settings-transfer.md`.
