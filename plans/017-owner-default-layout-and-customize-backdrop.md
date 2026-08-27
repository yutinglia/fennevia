# Owner default layout and customize backdrop plan

Date: 2026-08-27; final verification and media review: 2026-08-28
Status: implementation, focused checks, complete ordinary gate, PowerShell 5.1
compatibility gate, and documentation-media checks passed; real Firefox smoke
not run
Baseline: commit `ac92f46` (`Merge pull request #118 from yutinglia-agent/codex/release-0.17.0-beta.1`)

## 1. Owner request and direct evidence

Make the deterministic default match the owner's current four-edge layout,
correct the remaining address-launcher/Tabs width mismatch first, and make web
content darker and pointer-inactive while Fennevia customization is open.

The marker-owned development profile contains one valid bounded version-2
layout matching the supplied screenshot:

- Top: Back, Forward, Reload/Stop, Home, Trust, an empty Expanded region,
  Downloads, Extensions, Settings, Customize, Application menu, Private, and
  project window controls;
- configured tabs side: a standard-padded Row containing an expanded
  `with-site-status` address launcher, expanded `with-new-tab` Tabs, and a
  Separator;
- opposite side: expanded Bookmarks;
- Bottom: expanded, centered Downloads status.

No browsing value, native widget id, extension id, URL, title, or other profile
content is copied into the default.

## 2. Width correction

The saved Row already applies `var(--fennevia-space-2)` (8 CSS px) on both
inline sides. The launcher later gained another
`var(--fennevia-space-1)` (4 CSS px) inline margin, creating a double inset and
making its capsule visibly narrower than the Tabs content below it.

- Keep the Row's standard padding as the single horizontal alignment owner.
- Set only the composable launcher's inline margin to zero.
- Keep the launcher's 4 CSS px block margin outside Top for vertical breathing
  room; Top retains its existing zero block override.
- Do not change the centered address panel's geometry.

## 3. Default-layout contract

- Build the direct-evidence tree in `createDefaultComposableCustomizeLayout`.
- Keep the existing side-panel swap by placing the complete address/Tabs group
  on whichever edge owns Tabs.
- Use only project widgets and repeatable structural nodes; do not make a
  machine-specific Firefox or extension widget a default.
- Keep valid saved version-2 preferences untouched. Fresh, malformed-fallback,
  and Reset paths alone consume the new deterministic default.

## 4. Customize backdrop contract

- Render one Top-root-owned backdrop only while the shared customize session is
  open.
- Cover the shared frame, darken underlying page content, accept pointer hit
  testing, and opt out of native window dragging.
- Keep all four edge panels, the central customize drawer, and the floating
  inspector above the backdrop and interactive.
- Keep the backdrop non-focusable and hidden from assistive technology. It is a
  pointer barrier, not a modal dialog or close action.
- Do not set `inert` on Firefox content, inspect or mutate content DOM, add a
  host, observer, timer, persistence field, privileged bridge value, or log.
- Let ordinary Svelte conditional rendering and frontend teardown remove it.

## 5. Verification

- Focused model/controller tests prove the exact default, side swap, effective
  styles, structural Separator, reset behavior, and preference canonicalization.
- Focused frontend source/CSS checks prove the single Top backdrop, stacking,
  pointer ownership, no-drag guard, and non-duplicated launcher inline inset.
- Run formatting, lint, typecheck, the complete Node/PowerShell gate,
  deterministic build, and production-artifact scan.
- Real Firefox checks remain `not run`: compare address/Tabs edges at normal
  and high DPI; enter/exit customization; click, right-click, wheel, and drag
  over page-only regions; use every panel and the inspector; verify narrow
  scrolling/window dragging, forced colors, multiple/private windows,
  disposal, and Browser Console state.

Result: the focused layout/toolbar/frontend run passed 53/53. `npm run verify`
passed with 433/433 Node tests, 88.71% line coverage, 81.37% branch coverage,
95.79% function coverage, every fixed PowerShell 7 suite, dependency audit,
deterministic frontend/bridge output, and 14/14 accepted production artifacts.
The complete fixed-list suite also passed under Windows PowerShell 5.1. No
real-Firefox result is inferred from these checks.

## 6. README visual follow-up

The owner supplied a corrected current-source screenshot set after the source
implementation. The English and Traditional Chinese READMEs use:

- one ordinary-layout capture;
- Widgets, Guide, Panels, Interaction, and Appearance customize captures; and
- one generated wide hero that uses the latest Widgets, Guide, Panels,
  Interaction, and Appearance captures as visual references, abstracts all
  real UI copy, and makes the customize workspace the focal point.

The hero and captures are documentation media only; they add no installed
runtime resource or network request. Exact hashes, the complete generation
prompt, current OpenAI service-provenance link, the owner's MPL-2.0 inbound
decision, privacy review, and update/removal procedure are recorded in
`docs/media/PROVENANCE.md` and `THIRD_PARTY_NOTICES.md`. Both READMEs identify
the hero as stylized and keep the runtime captures separate from the pending
complete real-Firefox validation claim.

Both README files resolved all seven media references. All seven PNG files
matched their recorded SHA-256 values and expected minimum dimensions, and
`git diff --check` passed. One transient built-in image-generation network
failure produced no file; the successful retry is the sole final hero recorded
in provenance.
