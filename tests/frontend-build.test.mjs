import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readShellStyles } from "./support/shell-styles.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** @param {string} relativePath */
const readProjectFile = (relativePath) =>
  readFile(path.join(projectRoot, ...relativePath.split("/")), "utf8");

test("the exact frontend toolchain is development-only and lockfile-pinned", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"));
  const packageLock = JSON.parse(await readProjectFile("package-lock.json"));

  assert.equal(packageJson.packageManager, "npm@11.16.0");
  assert.deepEqual(packageJson.engines, {
    node: "24.18.0",
    npm: "11.16.0",
  });
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(Object.keys(packageJson.devDependencies).length, 12);
  assert.equal(packageLock.lockfileVersion, 3);
  assert.deepEqual(
    packageLock.packages[""].devDependencies,
    packageJson.devDependencies,
  );
  assert.equal(packageLock.packages[""].version, packageJson.version);
});

test("visible edge transforms override every directional off-screen transform", async () => {
  const css = await readShellStyles(projectRoot);
  const visibleRule = css.indexOf(
    '.fennevia-edge-root[data-fennevia-visible="true"]',
  );
  const lastDirectionalRule = Math.max(
    css.lastIndexOf(
      "transform: translateY(calc(-100% - var(--fennevia-edge-inset)));",
    ),
    css.lastIndexOf(
      "transform: translateY(calc(100% + var(--fennevia-edge-inset)));",
    ),
    css.lastIndexOf(
      "transform: translateX(calc(-100% - var(--fennevia-edge-inset)));",
    ),
    css.lastIndexOf(
      "transform: translateX(calc(100% + var(--fennevia-edge-inset)));",
    ),
  );

  assert.ok(lastDirectionalRule >= 0);
  assert.ok(visibleRule > lastDirectionalRule);
});

test("composable widget chrome stays centered, compact, and axis-aware", async () => {
  const [
    layoutCss,
    responsiveCss,
    tabsCss,
    bookmarksCss,
    downloadsCss,
    featureWidget,
    projectWidget,
  ] = await Promise.all([
    readProjectFile("src/shell/styles/composable-layout.css"),
    readProjectFile("src/shell/styles/responsive-accessibility.css"),
    readProjectFile("src/shell/styles/tabs.css"),
    readProjectFile("src/shell/styles/bookmarks.css"),
    readProjectFile("src/shell/styles/downloads.css"),
    readProjectFile(
      "src/shell/features/composable-layout/FeatureWidget.svelte",
    ),
    readProjectFile(
      "src/shell/features/composable-layout/ProjectWidget.svelte",
    ),
  ]);

  assert.match(projectWidget, /class="fennevia-layout-address"/u);
  assert.doesNotMatch(
    projectWidget,
    /class="fennevia-address-launcher fennevia-layout-address"/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-layout-node__content \{[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/u,
  );
  assert.match(
    layoutCss,
    /button\.fennevia-layout-control \{[\s\S]*?inline-size: var\(--fennevia-control-height\);[\s\S]*?block-size: var\(--fennevia-control-height\);[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-layout-container--row,[\s\S]*?\.fennevia-layout-wrapper--row[\s\S]*?> \.fennevia-layout-node__content \{\s*flex-direction: row;/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-layout-container--column,[\s\S]*?\.fennevia-layout-wrapper--column[\s\S]*?> \.fennevia-layout-node__content \{\s*flex-direction: column;/u,
  );
  assert.match(layoutCss, /\.fennevia-layout-node \{[\s\S]*?flex: 0 0 auto;/u);
  assert.match(
    layoutCss,
    /\.fennevia-layout-node--container \{\s*align-self: stretch;\s*\}/u,
  );
  assert.doesNotMatch(
    layoutCss,
    /\.fennevia-layout-node--container \{[^}]*\bflex:/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-layout-node--base \{\s*flex: 1 1 auto;\s*border: 0;/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-layout-node--expanded \{\s*flex: 1 1 0;\s*align-self: stretch;/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-layout-wrapper--center \{\s*align-items: center;\s*justify-content: center;/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-layout-wrapper--padding \{\s*padding: var\(--fennevia-space-2\);/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-layout-container--padded \{\s*padding: var\(--fennevia-space-2\);/u,
  );
  assert.doesNotMatch(layoutCss, /flex: 1 1 (?:180px|260px|280px);/u);
  assert.match(
    layoutCss,
    /\.fennevia-feature-widget--column[\s\S]*?> \.fennevia-tabs-summary \{\s*inline-size: 100%;\s*align-self: stretch;/u,
  );
  assert.match(featureWidget, /data-fennevia-feature-widget=\{props\.id\}/u);
  assert.match(
    layoutCss,
    /\.fennevia-feature-widget \{[\s\S]*?min-block-size: 0;[\s\S]*?min-inline-size: 0;[\s\S]*?max-block-size: 100%;[\s\S]*?max-inline-size: 100%;[\s\S]*?overflow: hidden;/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-toolbar-widgets__separator,[\s\S]*?\.fennevia-toolbar-widgets__spacer,[\s\S]*?\.fennevia-toolbar-widgets__spring[\s\S]*?align-self: stretch;/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-toolbar-widgets__spring[\s\S]*?\) \{\s*flex: 1 1 16px;/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-layout-address \{[\s\S]*?padding: 0;[\s\S]*?background: none;[\s\S]*?border: 0;/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-layout-address \{[\s\S]*?inline-size: min\(320px, 100%\);[\s\S]*?max-inline-size: 100%;[\s\S]*?margin-block: var\(--fennevia-space-1\);[\s\S]*?margin-inline: 0;/u,
  );
  assert.match(
    layoutCss,
    /data-fennevia-edge="top"\][\s\S]*?\.fennevia-layout-address \{\s*margin-block: 0;/u,
  );
  assert.match(
    layoutCss,
    /\.fennevia-layout-address[\s\S]*?> \.fennevia-layout-address-launcher \{[\s\S]*?max-inline-size: min\(680px, 100%\);[\s\S]*?block-size: var\(--fennevia-control-height\);/u,
  );
  assert.match(
    tabsCss,
    /\.fennevia-tab-strip--horizontal \{[\s\S]*?min-inline-size: 0;/u,
  );
  assert.match(
    tabsCss,
    /\.fennevia-tab-strip--horizontal[\s\S]*?\.fennevia-tab-strip__new \{[\s\S]*?inline-size: auto;/u,
  );
  assert.match(
    bookmarksCss,
    /\.fennevia-bookmarks \{[\s\S]*?min-block-size: 0;[\s\S]*?min-inline-size: 0;/u,
  );
  assert.match(bookmarksCss, /min-inline-size: min\(300px, 100%\);/u);
  assert.match(
    downloadsCss,
    /grid-template-columns:\s*minmax\(0, 0\.85fr\) minmax\(0, 1\.25fr\)\s*minmax\(0, 1fr\);/u,
  );
  assert.match(
    responsiveCss,
    /\.fennevia-address-launcher\s+\.fennevia-address-launcher__button \{\s*min-block-size: 36px;/u,
  );
  assert.match(
    responsiveCss,
    /\.fennevia-navigation\s+\.fennevia-browser-tools__button:not/u,
  );
  assert.match(
    responsiveCss,
    /\.fennevia-layout-address\s*> \.fennevia-layout-address-launcher \{\s*color: FieldText;\s*background: Field;\s*border-color: FieldText;/u,
  );
});

test("application menu renderers expose native popup semantics", async () => {
  const [browserToolWidget, topSurface] = await Promise.all([
    readProjectFile(
      "src/shell/features/composable-layout/BrowserToolWidget.svelte",
    ),
    readProjectFile("src/shell/surfaces/TopSurface.svelte"),
  ]);

  assert.match(
    browserToolWidget,
    /aria-haspopup=\{props\.id === "application-menu" \? "menu" : undefined\}/u,
  );
  assert.match(topSurface, /aria-haspopup="menu"/u);
});

test("narrow windows reflow all four panels before and below Firefox's normal floor", async () => {
  const css = await readProjectFile(
    "src/shell/styles/responsive-accessibility.css",
  );
  const narrowTier = css.indexOf("@media (max-width: 560px)");
  const ultraCompactTier = css.indexOf("@media (max-width: 360px)");

  assert.ok(narrowTier >= 0);
  assert.ok(ultraCompactTier > narrowTier);
  const narrowRules = css.slice(narrowTier, ultraCompactTier);
  const ultraCompactRules = css.slice(ultraCompactTier);

  assert.doesNotMatch(css, /data-fennevia-compact-window/u);
  assert.doesNotMatch(narrowRules, /--fennevia-edge-side-width:\s*calc\(/u);
  assert.match(ultraCompactRules, /--fennevia-edge-side-width:\s*calc\(/u);
  assert.match(
    css,
    /@media \(max-width: 560px\) \{[\s\S]*?--fennevia-narrow-side-exit-corridor: 104px;[\s\S]*?--fennevia-edge-side-width: min\([\s\S]*?320px,[\s\S]*?100% - var\(--fennevia-edge-inset\) -[\s\S]*?var\(--fennevia-narrow-side-exit-corridor\)/u,
  );
  assert.match(
    css,
    /data-fennevia-bottom-visible[\s\S]*?data-fennevia-bottom-enabled[\s\S]*?--fennevia-compact-bottom-clearance: calc\(/u,
  );
  assert.match(
    css,
    /data-fennevia-edge="bottom"\][\s\S]*?\.fennevia-edge-panel \{[\s\S]*?inset-inline: var\(--fennevia-edge-inset\);[\s\S]*?block-size: var\(--fennevia-edge-bottom-height\);/u,
  );
  assert.match(
    css,
    /data-fennevia-edge="left"[\s\S]*?data-fennevia-edge="right"[\s\S]*?inset-block-end: calc\([\s\S]*?--fennevia-compact-bottom-clearance/u,
  );
  assert.match(
    css,
    /data-fennevia-left-visible\]\[data-fennevia-right-visible\][\s\S]*?data-fennevia-left-enabled\]\[data-fennevia-right-enabled\][\s\S]*?inline-size: calc\([\s\S]*?--fennevia-narrow-side-half-gap/u,
  );
  assert.match(
    css,
    /\.fennevia-composable-layout--row \{[\s\S]*?overscroll-behavior-inline: contain;[\s\S]*?scroll-padding-inline:/u,
  );
  assert.match(css, /scroll-snap-type: inline proximity;/u);
  assert.match(css, /scroll-margin-inline: var\(--fennevia-space-2\);/u);
  assert.match(
    narrowRules,
    /data-fennevia-edge="top"\][\s\S]*?\.fennevia-edge-panel::after \{[\s\S]*?inset-block-end: 0;[\s\S]*?block-size: var\(--fennevia-space-3\);[\s\S]*?pointer-events: none;[\s\S]*?-moz-window-dragging: no-drag;[\s\S]*?content: "";/u,
  );
  assert.match(
    css,
    /\.fennevia-tab-strip--horizontal[\s\S]*?> \.fennevia-tabs-summary[\s\S]*?> span \{\s*display: none;/u,
  );
  assert.match(
    css,
    /\.fennevia-downloads:not\(\.fennevia-downloads--horizontal\) \{[\s\S]*?min-inline-size: 0;/u,
  );
  assert.match(
    css,
    /\.fennevia-bookmarks__context-menu \{\s*min-inline-size: min\(180px, calc\(100% - 12px\)\);/u,
  );
  assert.match(
    css,
    /\.fennevia-edge-panel__footer \{[\s\S]*?inset-inline: var\(--fennevia-space-2\);[\s\S]*?transform: none;/u,
  );
  assert.match(
    css,
    /\.fennevia-customize \{[\s\S]*?--fennevia-compact-bottom-clearance[\s\S]*?inline-size: auto;[\s\S]*?max-inline-size: min\(/u,
  );
  assert.match(
    css,
    /@media \(max-width: 360px\) \{[\s\S]*?--fennevia-edge-gap: 4px;[\s\S]*?--fennevia-edge-side-width: calc\([\s\S]*?100% - var\(--fennevia-edge-inset\) - var\(--fennevia-edge-inset\)[\s\S]*?--fennevia-edge-top-height: 48px;[\s\S]*?--fennevia-edge-bottom-height: 60px;/u,
  );
});

test("customize mode previews exact drops and exposes bounded widget styles", async () => {
  const [
    app,
    composableLayout,
    widgetInspector,
    dragPreview,
    projectWidget,
    featureWidget,
    customizePanel,
    customizeGuide,
    customizeTabs,
    customizePalette,
    layoutCss,
    customizeCss,
    responsiveCss,
  ] = await Promise.all([
    readProjectFile("src/shell/App.svelte"),
    readProjectFile(
      "src/shell/features/composable-layout/ComposableLayout.svelte",
    ),
    readProjectFile(
      "src/shell/features/composable-layout/WidgetInspector.svelte",
    ),
    readProjectFile(
      "src/shell/features/composable-layout/LayoutDragPreview.svelte",
    ),
    readProjectFile(
      "src/shell/features/composable-layout/ProjectWidget.svelte",
    ),
    readProjectFile(
      "src/shell/features/composable-layout/FeatureWidget.svelte",
    ),
    readProjectFile("src/shell/CustomizePanel.svelte"),
    readProjectFile(
      "src/shell/features/customize/CustomizeGuideSection.svelte",
    ),
    readProjectFile("src/shell/features/customize/CustomizeTabList.svelte"),
    readProjectFile("src/shell/features/customize/customize-palette.ts"),
    readProjectFile("src/shell/styles/composable-layout.css"),
    readProjectFile("src/shell/styles/customize.css"),
    readProjectFile("src/shell/styles/responsive-accessibility.css"),
  ]);

  assert.match(composableLayout, /<LayoutDragPreview/u);
  assert.match(
    composableLayout,
    /renderDropSlot\(pathKey\(parentPath\), index/u,
  );
  assert.match(composableLayout, /data-fennevia-layout-source=/u);
  assert.match(composableLayout, /data-fennevia-layout-selected=/u);
  assert.match(composableLayout, /resolveToolbarWidgetDragAutoScrollDelta/u);
  assert.match(composableLayout, /requestAnimationFrame\(runAutoScroll\)/u);
  assert.match(composableLayout, /data-fennevia-layout-keyboard-selector/u);
  assert.match(composableLayout, /const focusEditableNode/u);
  assert.doesNotMatch(composableLayout, /data-fennevia-layout-style-select/u);
  assert.doesNotMatch(composableLayout, /type: "set-node-style"/u);
  assert.match(widgetInspector, /data-fennevia-widget-inspector=/u);
  assert.match(widgetInspector, /data-fennevia-widget-config-style=/u);
  assert.match(widgetInspector, /data-fennevia-widget-config-padding=/u);
  assert.match(widgetInspector, /type: "set-container-padding"/u);
  assert.match(widgetInspector, /type: "set-node-style"/u);
  assert.match(widgetInspector, /customizePanelElement/u);
  assert.match(widgetInspector, /const focusTargetForNode/u);
  assert.doesNotMatch(
    widgetInspector,
    /data-fennevia-layout-keyboard-selector/u,
  );
  assert.match(
    widgetInspector,
    /focusTargetForNode\(anchor\)[\s\S]*?clearSelectedInstance\(\)[\s\S]*?focusTarget\.focus\(\{ preventScroll: true \}\)/u,
  );
  assert.match(
    composableLayout,
    /data-fennevia-layout-node=""[\s\S]*?tabindex="-1"/u,
  );
  assert.match(widgetInspector, /anchorRoot=|props\.anchorRoot/u);
  assert.match(
    app,
    /<CustomizePanel[\s\S]*?<WidgetInspector[\s\S]*?anchorRoot=\{props\.frame\}/u,
  );
  assert.match(
    app,
    /aria-hidden="true"[\s\S]*?class="fennevia-customize-backdrop"[\s\S]*?data-fennevia-customize-backdrop=/u,
  );
  assert.match(
    app,
    /props\.edge === "top" && customizeOpen[\s\S]*?class="fennevia-customize-backdrop"[\s\S]*?<CustomizePanel/u,
  );
  assert.match(app, /props\.edge === "top"[\s\S]*?<WidgetInspector/u);
  assert.equal(app.match(/<WidgetInspector/gu)?.length, 1);
  assert.match(dragPreview, /data-fennevia-layout-drop-preview=/u);

  const clearSearch = customizePanel.indexOf('paletteQuery = "";');
  const closeCustomize = customizePanel.indexOf("props.onClose();");
  assert.ok(clearSearch >= 0 && closeCustomize > clearSearch);
  assert.match(customizePanel, /filterCustomizePalette/u);
  assert.match(customizePanel, /data-fennevia-customize-search=/u);
  assert.match(customizePanel, /data-fennevia-customize-category=/u);
  assert.match(customizePanel, /data-fennevia-customize-kind=/u);
  assert.match(customizePanel, /data-fennevia-customize-group-layout=/u);
  assert.match(customizePanel, /grid-item--feature-companion/u);
  assert.match(customizePanel, /groupCustomizePaletteEntries/u);
  assert.match(customizePanel, /<CustomizeGuideSection/u);
  assert.match(customizePanel, /data-fennevia-customize-tabpanel="guide"/u);
  assert.match(customizeTabs, /"widgets",\s*"guide",/u);
  assert.match(
    customizePalette,
    /kind === "feature" \|\| kind === "feature-companion"/u,
  );
  assert.match(customizePalette, /feature: 0/u);
  assert.match(customizeGuide, /customize\.guide\.companionsTitle/u);
  assert.match(customizeGuide, /customize\.guide\.layoutWidgetsTitle/u);
  assert.match(customizeGuide, /data-fennevia-guide-expanded=/u);
  assert.equal(customizeGuide.match(/role="img"/gu)?.length, 3);
  assert.doesNotMatch(customizeGuide, /\$state|fetch\(/u);
  assert.match(customizePanel, /setDragImage/u);
  assert.match(customizePanel, /source\?\.type !== "layout-node"/u);

  assert.match(
    projectWidget,
    /props\.widgetStyle === "with-site-status"[\s\S]*?<TrustWidget/u,
  );
  assert.match(projectWidget, /data-fennevia-widget-style=/u);
  assert.match(
    featureWidget,
    /showNewTab=\{props\.widgetStyle === "with-new-tab"\}/u,
  );

  assert.match(layoutCss, /@keyframes fennevia-layout-preview-inline/u);
  assert.match(layoutCss, /@keyframes fennevia-layout-preview-block/u);
  assert.match(layoutCss, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(layoutCss, /@media \(forced-colors: active\)/u);
  assert.match(layoutCss, /\.fennevia-widget-inspector/u);
  assert.match(customizeCss, /grid-template-columns: repeat\(4,/u);
  assert.match(customizeCss, /grid-item--feature-companion/u);
  assert.match(customizeCss, /grid-item--feature-primary-only/u);
  assert.match(
    customizeCss,
    /customize__widget-intro[\s\S]*?customize__panel-field--destination[\s\S]*?grid-template-columns: max-content minmax\(180px, 1fr\)/u,
  );
  assert.match(customizeCss, /\.fennevia-customize__guide-pairs/u);
  assert.match(
    customizeCss,
    /\.fennevia-customize-backdrop \{[\s\S]*?position: absolute;[\s\S]*?z-index: 1;[\s\S]*?inset: 0;[\s\S]*?48%[\s\S]*?pointer-events: auto;[\s\S]*?-moz-window-dragging: no-drag;/u,
  );
  assert.match(responsiveCss, /grid-template-columns: repeat\(3,/u);
  assert.doesNotMatch(layoutCss, /\.fennevia-layout-node__style-editor/u);
  assert.doesNotMatch(layoutCss, /\.fennevia-layout-node__controls/u);
  assert.match(layoutCss, /data-fennevia-widget-style="with-site-status"/u);
  assert.match(customizeCss, /\.fennevia-customize__palette-categories/u);
  assert.match(customizeCss, /data-fennevia-customize-dragging="true"/u);
});

test("edge panels touch the trigger gutter, coordinate native drags, and float visible transient shortcuts", async () => {
  const css = await readShellStyles(projectRoot);

  assert.match(css, /--fennevia-edge-trigger-thickness: 12px;/u);
  assert.match(css, /--fennevia-hide-delay: 300ms;/u);
  assert.match(css, /--fennevia-edge-inset: 7px;/u);
  assert.match(css, /--fennevia-shortcut-tip-duration: 600ms;/u);
  assert.match(
    css,
    /data-fennevia-edge="top"\][\s\S]*?\.fennevia-edge-trigger \{\s*inset-inline: 0;/u,
  );
  assert.match(
    css,
    /data-fennevia-edge="bottom"\][\s\S]*?\.fennevia-edge-trigger \{\s*inset-inline: var\(--fennevia-edge-trigger-thickness\);/u,
  );
  assert.match(
    css,
    /data-fennevia-edge="right"\][\s\S]*?\.fennevia-edge-trigger \{\s*inset-block-start: var\(--fennevia-edge-trigger-thickness\);/u,
  );
  assert.match(css, /-moz-window-dragging: drag/u);
  assert.match(css, /-moz-window-dragging: no-drag/u);
  assert.match(
    css,
    /position: absolute;[\s\S]*@keyframes fennevia-shortcut-tip/u,
  );
  assert.match(
    css,
    /animation: fennevia-shortcut-tip var\(--fennevia-shortcut-tip-duration\)/u,
  );
  assert.match(css, /@keyframes fennevia-shortcut-tip-reduced-motion/u);
  assert.match(
    css,
    /data-fennevia-edge="top"\]\s*\.fennevia-edge-panel__footer \{\s*inset-block-start: calc\(100% \+ var\(--fennevia-space-2\)\);/u,
  );
  assert.match(
    css,
    /data-fennevia-edge="bottom"\]\s*\.fennevia-edge-panel__footer \{\s*inset-block-end: calc\(100% \+ var\(--fennevia-space-2\)\);/u,
  );
  assert.match(
    css,
    /data-fennevia-edge="left"\]\s*\.fennevia-edge-panel__footer \{\s*inset-block-start: 50%;\s*inset-inline-start: calc\(100% \+ var\(--fennevia-space-2\)\);/u,
  );
  assert.match(
    css,
    /data-fennevia-edge="right"\]\s*\.fennevia-edge-panel__footer \{\s*inset-block-start: 50%;\s*inset-inline-end: calc\(100% \+ var\(--fennevia-space-2\)\);/u,
  );
  assert.match(
    css,
    /\.fennevia-edge-panel__footer kbd \{[\s\S]*?background: var\(\s*--input-text-background-color,\s*var\(--fennevia-glass-surface\)\s*\);/u,
  );
  assert.match(css, /--panel-background-color/u);
  assert.match(css, /--toolbar-background-color/u);
  assert.match(css, /--color-accent-primary/u);
  assert.match(css, /--focus-outline-color/u);
  assert.match(
    css,
    /\.fennevia-toolbar-widgets__compound-value \{[\s\S]*?min-inline-size: 4ch;[\s\S]*?font-variant-numeric: tabular-nums;/u,
  );
  assert.doesNotMatch(css, /247 250 252/u);

  const [
    component,
    customizePanelSource,
    progressLight,
    toolbarWidgets,
    composableLayout,
    widgetInspector,
    mountShell,
    customizeStyle,
    customizePanels,
    edgeInteractions,
    windowDrag,
    pointerGeometry,
    health,
  ] = await Promise.all([
    readProjectFile("src/shell/App.svelte"),
    readProjectFile("src/shell/CustomizePanel.svelte"),
    readProjectFile("src/shell/surfaces/EdgeProgressLight.svelte"),
    readProjectFile(
      "src/shell/features/composable-layout/FirefoxToolbarWidget.svelte",
    ),
    readProjectFile(
      "src/shell/features/composable-layout/ComposableLayout.svelte",
    ),
    readProjectFile(
      "src/shell/features/composable-layout/WidgetInspector.svelte",
    ),
    readProjectFile("src/shell/runtime/mount-shell.ts"),
    readProjectFile("src/shell/runtime/customize-style.ts"),
    readProjectFile(
      "src/shell/features/customize/CustomizePanelsSection.svelte",
    ),
    readProjectFile("src/shell/runtime/edge-app-interactions.ts"),
    readProjectFile("src/shell/runtime/window-drag.ts"),
    readProjectFile("src/shell/runtime/pointer-geometry.ts"),
    readProjectFile("src/shell/runtime/health.ts"),
  ]);
  assert.match(
    component,
    /createWindowDragCandidateController[\s\S]*?onStart: \(\) => props\.shell\.setWindowDragActive\(true, props\.edge\)/u,
  );
  assert.match(
    component,
    /canStart: \(event\) =>[\s\S]*?!customizeOpen[\s\S]*?!edgeUi\.isInteractivePointerTarget\(event\.target\)/u,
  );
  assert.match(
    component,
    /onEnd: \(clickOnly\) => \{[\s\S]*?setWindowDragActive\(false\)[\s\S]*?if \(clickOnly\)[\s\S]*?releasePointer\(props\.edge, "inside-window"\)/u,
  );
  assert.match(component, /handleTriggerPointer[\s\S]*?pointerActivatesEdge/u);
  assert.match(
    edgeInteractions,
    /pointerActivatesEdge[\s\S]*?event\.buttons !== 0/u,
  );
  assert.match(
    component,
    /onpointercancel=\{\(event\) => panelWindowDrag\.release\(event, true\)\}/u,
  );
  assert.match(component, /onpointerdown=\{panelWindowDrag\.begin\}/u);
  assert.match(component, /onpointerup=\{panelWindowDrag\.release\}/u);
  assert.match(component, /<EdgeProgressLight/u);
  assert.match(progressLight, /resolveLoadProgressLight/u);
  assert.match(progressLight, /resolveDownloadProgressLight/u);
  assert.match(progressLight, /props\.source !== "loading"/u);
  assert.match(progressLight, /props\.source !== "downloads"/u);
  assert.match(progressLight, /props\.source === "downloads"[\s\S]*?: null/u);
  assert.match(progressLight, /<ProgressLight \{presentation\} \/>/u);
  assert.match(component, /toolbarLayoutContainsProjectWidget/u);
  assert.match(component, /data-fennevia-side-role=\{sidePanelRole/u);
  assert.match(component, /data-fennevia-enabled=\{surfaceState\.enabled\}/u);
  assert.match(
    component,
    /if \(!snapshot\.open && wasOpen\) \{\s*props\.onDismiss\(props\.edge\);\s*return;/u,
  );
  assert.doesNotMatch(
    component,
    /revealCustomizeToggle|customizeToggle\(\)\?\.focus/u,
  );
  assert.doesNotMatch(mountShell, /focusCustomizeToggle/u);
  assert.match(
    toolbarWidgets,
    /<ToolbarWidgetGlyph widget=\{props\.widget\} \/>/u,
  );
  assert.match(toolbarWidgets, /props\.widget\.parts\.length > 0/u);
  assert.match(
    toolbarWidgets,
    /data-fennevia-browser-tool="toolbar-widget-part"/u,
  );
  assert.match(toolbarWidgets, /part\.valueText/u);
  assert.match(toolbarWidgets, /fennevia-toolbar-widgets__compound-value/u);
  assert.match(toolbarWidgets, /const partLabel/u);
  assert.match(
    toolbarWidgets,
    /toolbarWidgets\.invoke\([\s\S]*?resolveBrowserToolHost\(event\),[\s\S]*?event/u,
  );
  assert.match(composableLayout, /toolbarWidgetDragMimeType/u);
  assert.match(composableLayout, /data-fennevia-layout-container/u);
  assert.match(
    composableLayout,
    /class:fennevia-layout-container--padded=\{node\.padding === "standard"\}/u,
  );
  assert.match(composableLayout, /data-fennevia-layout-wrapper/u);
  assert.match(composableLayout, /baseContainerInstanceId/u);
  assert.match(composableLayout, /data-fennevia-layout-base/u);
  assert.match(
    composableLayout,
    /class:fennevia-layout-node--editing=\{props\.customizeOpen &&\s*!isBaseContainer\}/u,
  );
  assert.match(
    composableLayout,
    /handleDragOver\(event, rootDropParentPath, rootDirection\)/u,
  );
  assert.match(composableLayout, /node\.type === "wrapper"/u);
  assert.match(composableLayout, /node\.children\.length === 0/u);
  assert.match(composableLayout, /data-fennevia-layout-node-content/u);
  assert.match(composableLayout, /data-fennevia-layout-structure-label/u);
  assert.match(composableLayout, /class:fennevia-layout-node--special/u);
  assert.match(composableLayout, /data-fennevia-empty-panel-drop-target/u);
  assert.match(
    composableLayout,
    /const selectEmptyPanel[\s\S]*?setLastFocusedZone\(props\.edge\)/u,
  );
  assert.match(
    widgetInspector,
    /node\.projectId === "customize-shell"[\s\S]*?"customize\.required"/u,
  );
  assert.match(composableLayout, /data-fennevia-layout-keyboard-selector/u);
  assert.doesNotMatch(composableLayout, /fennevia-layout-node__controls/u);
  assert.doesNotMatch(composableLayout, /fennevia-layout-node__style-editor/u);
  assert.match(widgetInspector, /resolveWidgetInspectorPosition/u);
  assert.match(widgetInspector, /customize\.containerPadding/u);
  assert.match(widgetInspector, /customizePanelElement/u);
  assert.match(widgetInspector, /subscribeToolbarWidgetDrag/u);
  assert.match(
    widgetInspector,
    /subscribeToolbarWidgetDrag\(\(source\) => \{\s*dragActive = source !== null;/u,
  );
  assert.match(widgetInspector, /data-fennevia-widget-inspector-dodging/u);
  assert.match(widgetInspector, /new view\.ResizeObserver\(reposition\)/u);
  assert.match(widgetInspector, /observer\.disconnect\(\)/u);
  assert.match(composableLayout, /subscribeToolbarWidgetDrag/u);
  assert.match(composableLayout, /ondragleave=\{handleDragLeave\}/u);
  assert.match(composableLayout, /data-fennevia-window-drag-region/u);
  assert.match(toolbarWidgets, /data-fennevia-window-drag-region/u);
  assert.match(edgeInteractions, /\[tabindex\]:not\(\[tabindex="-1"\]\)/u);
  assert.match(
    css,
    /data-fennevia-window-drag-region[\s\S]*?-moz-window-dragging: drag;[\s\S]*?data-fennevia-customize-active[\s\S]*?-moz-window-dragging: no-drag;/u,
  );
  assert.match(
    css,
    /\.fennevia-widget-inspector \{[\s\S]*?position: absolute;[\s\S]*?z-index: 12;/u,
  );
  assert.match(
    css,
    /data-fennevia-widget-inspector-positioned="true"[\s\S]*?pointer-events: auto;/u,
  );
  assert.match(
    css,
    /data-fennevia-widget-inspector-positioned="true"\]\[data-fennevia-widget-inspector-dodging="true"\] \{[\s\S]*?opacity: 0;[\s\S]*?pointer-events: none;[\s\S]*?transform: translateY\(-2px\) scale\(0\.96\);/u,
  );
  const editingRule = css.match(
    /\.fennevia-layout-node--editing \{(?<body>[\s\S]*?)\n\}/u,
  )?.groups?.body;
  assert.ok(editingRule);
  assert.doesNotMatch(editingRule, /min-(?:block|inline)-size|border\s*:/u);
  assert.match(
    css,
    /\.fennevia-layout-node--editing::after \{[\s\S]*?position: absolute;[\s\S]*?inset: 0;[\s\S]*?box-sizing: border-box;[\s\S]*?border: 1px dashed[\s\S]*?pointer-events: none;/u,
  );
  assert.match(
    css,
    /\.fennevia-layout-node--editing:hover:not\([\s\S]*?\):not\(\[data-fennevia-layout-source="true"\]\)::after \{[\s\S]*?border-color:/u,
  );
  assert.match(
    css,
    /data-fennevia-layout-selected="true"[\s\S]*?::after \{[\s\S]*?border: 2px solid/u,
  );
  assert.match(
    css,
    /@media \(forced-colors: active\)[\s\S]*?\.fennevia-layout-node--editing::after \{[\s\S]*?border-color: Highlight;/u,
  );
  assert.match(
    css,
    /\.fennevia-layout-node__structure-label \{[\s\S]*?opacity: 0;[\s\S]*?pointer-events: none;/u,
  );
  assert.doesNotMatch(css, /\.fennevia-layout-node__controls/u);
  assert.doesNotMatch(css, /\.fennevia-layout-node__style-editor/u);
  assert.match(
    css,
    /\.fennevia-layout-container__placeholder--root \{[\s\S]*?flex: 0 1 auto;[\s\S]*?margin: auto;/u,
  );
  assert.match(
    css,
    /\.fennevia-layout-wrapper--expanded[\s\S]*?> \.fennevia-feature-widget \{[\s\S]*?inline-size: 100%;[\s\S]*?align-self: stretch;/u,
  );
  assert.match(
    component,
    /shell\.snapshot\(\)\.interaction\.triggerThicknessCssPixels/u,
  );
  assert.match(mountShell, /shell\.setInteractionConfig/u);
  assert.match(mountShell, /shell\.setPanelDodgeMode/u);
  assert.match(mountShell, /PANEL_DODGE_MODE_ATTRIBUTE/u);
  assert.match(
    mountShell,
    /frame\.toggleAttribute\(\s*`data-fennevia-\$\{edge\}-enabled`,\s*enabled/u,
  );
  assert.match(
    mountShell,
    /toolbarLayoutContainsProjectWidget\([\s\S]*?state\.snapshot\.layout\[edge\],[\s\S]*?"tabs"/u,
  );
  assert.match(
    mountShell,
    /for \(const edge of \["left", "right", "bottom"\] as const\)[\s\S]*?shell\.setEdgeEnabled\(edge, enabled\)/u,
  );
  assert.match(
    mountShell,
    /releaseSurfaceFocusIfActive[\s\S]*?activeElementFor\(edge\)[\s\S]*?restoreFocus\(edge\)[\s\S]*?discardFocusOrigin\(edge\)/u,
  );
  assert.match(
    mountShell,
    /if \(!enabled\) \{\s*releaseSurfaceFocusIfActive\(edge\);/u,
  );
  assert.match(mountShell, /showEmptyCustomizeTargets/u);
  assert.match(mountShell, /isToolbarOptionalPanelEnabled/u);
  assert.match(
    mountShell,
    /customizeSession\.subscribe\(\(\) => \{\s*applyCustomizeState\(widgetsState\.snapshot\(\)\);/u,
  );
  assert.match(
    health,
    /const panelEnabledFor[\s\S]*?snapshot\.panels\.leftPanelEnabled[\s\S]*?snapshot\.panels\.rightPanelEnabled[\s\S]*?snapshot\.panels\.bottomPanelEnabled/u,
  );
  assert.match(
    health,
    /verifyLayoutNodes[\s\S]*?data-fennevia-layout-instance/u,
  );
  assert.match(mountShell, /shell\.releasePointer\(edge, "outside-window"\)/u);
  assert.match(mountShell, /shell\.setWindowDragActive\(false\)/u);
  assert.match(
    mountShell,
    /resolveWindowDragEdge\(event\.target\) \?\?[\s\S]*?snapshot\.surfaces\[candidate\]\.holds\.pointer/u,
  );
  assert.match(
    mountShell,
    /hasWindowDragMoved\([\s\S]*?shell\.releasePointer\(candidate\.edge, "inside-window"\)/u,
  );
  assert.match(
    mountShell,
    /releaseWindowInteraction[\s\S]*?releaseWindowDrag\(\);[\s\S]*?typeof isChromeWindowActive === "function" && isChromeWindowActive\(\)[\s\S]*?releaseWindowPointer\(\);/u,
  );
  assert.match(mountShell, /isChromeWindowActive/u);
  assert.match(
    edgeInteractions,
    /resolveWindowDragEdge[\s\S]*?closest<HTMLElement>\("\[data-fennevia-edge-panel\]"\)[\s\S]*?isEdgeName\(edge\)/u,
  );
  assert.match(
    mountShell,
    /WINDOW_DRAG_START_EVENT = "draggableregionleftmousedown"/u,
  );
  assert.match(
    mountShell,
    /addEventListener\(WINDOW_DRAG_START_EVENT, beginWindowDrag\)/u,
  );
  assert.match(mountShell, /addEventListener\("mouseup", releaseWindowDrag\)/u);
  assert.match(
    mountShell,
    /addEventListener\("pointerup", releaseWindowDrag\)/u,
  );
  assert.match(
    mountShell,
    /addEventListener\("pointercancel", cancelWindowDrag\)/u,
  );
  assert.match(windowDrag, /minimumWindowDragDistanceCssPixels = 4/u);
  assert.match(
    windowDrag,
    /createWindowDragCandidateController[\s\S]*?hasWindowDragMoved[\s\S]*?onEnd/u,
  );
  assert.doesNotMatch(customizePanels, /value="tabs-left"|value="tabs-right"/u);
  assert.equal(customizePanels.match(/<option value="loading">/gu)?.length, 2);
  assert.equal(
    customizePanels.match(/<option value="downloads">/gu)?.length,
    2,
  );
  assert.equal(customizePanels.match(/<option value="off">/gu)?.length, 2);
  assert.match(customizePanels, /leftPanelEnabled/u);
  assert.match(customizePanels, /rightPanelEnabled/u);
  assert.match(customizePanels, /bottomPanelEnabled/u);
  assert.match(customizePanels, /data-fennevia-customize-multiple-placements/u);
  assert.match(customizePanels, /data-fennevia-customize-panel-dodge/u);
  for (const mode of [
    "single-dynamic",
    "single-reserved",
    "multiple-dynamic",
    "multiple-reserved",
  ]) {
    assert.match(customizePanels, new RegExp(`value="${mode}"`, "u"));
  }
  assert.match(customizePanels, /allowCompactWindow/u);
  assert.match(customizePanels, /data-fennevia-customize-compact-window/u);
  assert.match(customizePanels, /data-fennevia-customize-clean-layout/u);
  assert.match(customizePanels, /role="alertdialog"/u);
  assert.match(
    customizePanels,
    /const cancelClean[\s\S]*?cleanConfirmOpen = false;[\s\S]*?const confirmClean[\s\S]*?props\.onCleanLayout\(\)/u,
  );
  assert.match(
    customizePanelSource,
    /onCleanLayout=\{\(\) =>\s*void runEdit\(\{ revision, type: "clean-layout" \}\)\}/u,
  );
  assert.match(
    mountShell,
    /removeEventListener\(WINDOW_DRAG_START_EVENT, beginWindowDrag\)/u,
  );
  assert.match(
    mountShell,
    /removeEventListener\("mouseup", releaseWindowDrag\)/u,
  );
  assert.match(mountShell, /windowLeaveHideDelayMs/u);
  assert.match(customizeStyle, /--fennevia-edge-trigger-thickness/u);
  assert.match(customizeStyle, /--fennevia-hide-delay/u);
  assert.match(customizeStyle, /--fennevia-shortcut-tip-duration/u);
  assert.doesNotMatch(component, /sidePanelRole !== "bookmarks"/u);
  assert.match(component, /shortcutHintDuration !== 0/u);
  assert.match(css, /\.fennevia-bookmarks__status:empty/u);
  assert.match(
    component,
    /resolveOwnedSurfacePointerOutRelease\(\s*event,\s*rootElement,\s*panelElement/u,
  );
  assert.match(
    edgeInteractions,
    /resolveOwnedSurfacePointerOutRelease[\s\S]*?crossedPointerBoundary\(event\)[\s\S]*?isIgnoredOwnedSurfacePointerOut\(event, root, panel\)[\s\S]*?event\.relatedTarget === null \? "outside-window" : "inside-window"/u,
  );
  assert.match(
    pointerGeometry,
    /export const isIgnoredOwnedSurfacePointerOut = [\s\S]*?relatedTarget === null[\s\S]*?isPointInsideWindowViewport\([\s\S]*?isPointInsideElement\(root,[\s\S]*?isPointInsideElement\(panel,/u,
  );
  assert.match(
    mountShell,
    /isPointInsideWindowViewport\(view, event\.clientX, event\.clientY\) &&[\s\S]*?isPointInsideVisibleEdgePanel\(frame, event\.clientX, event\.clientY\)/u,
  );
  assert.match(
    edgeInteractions,
    /export \{[\s\S]*?isIgnoredOwnedSurfacePointerOut,[\s\S]*?isPointInsideElement,[\s\S]*?isPointInsideVisibleEdgePanel,[\s\S]*?isPointInsideWindowViewport,[\s\S]*?\}/u,
  );
  assert.match(
    pointerGeometry,
    /export const isPointInsideElement = [\s\S]*?getBoundingClientRect\(\)/u,
  );
  assert.match(
    pointerGeometry,
    /export const isPointInsideVisibleEdgePanel = [\s\S]*?data-fennevia-visible='true'/u,
  );
  assert.match(
    pointerGeometry,
    /export const isPointInsideWindowViewport = [\s\S]*?clientX >= 0[\s\S]*?clientX <= view\.innerWidth/u,
  );
  assert.match(
    mountShell,
    /import \{[\s\S]*?isPointInsideVisibleEdgePanel,[\s\S]*?isPointInsideWindowViewport,[\s\S]*?\} from "\.\/pointer-geometry"/u,
  );
  assert.match(css, /data-fennevia-customize-active/u);
  assert.match(css, /--fennevia-bottom-clearance/u);
  assert.match(css, /data-fennevia-panel-dodge-mode="single-reserved"/u);
  assert.match(css, /data-fennevia-panel-dodge-mode="multiple-reserved"/u);
  assert.match(css, /data-fennevia-left-enabled/u);
  assert.match(css, /data-fennevia-right-enabled/u);
  assert.match(css, /\.fennevia-customize \{[\s\S]*?overflow: hidden;/u);
  assert.match(css, /\.fennevia-customize__tabs/u);
  assert.match(css, /\.fennevia-customize__tabpanel/u);
  assert.match(
    css,
    /\.fennevia-customize \{[\s\S]*?var\(--fennevia-bottom-clearance\)/u,
  );
  assert.doesNotMatch(
    css,
    /\.fennevia-customize \{[\s\S]*?inset-inline-end: var\(--fennevia-edge-inset\);/u,
  );

  const glyph = await readProjectFile("src/shell/ToolbarWidgetGlyph.svelte");
  assert.match(glyph, /moz-extension:\/\//u);
  assert.match(glyph, /style:mask-image=\{nativeMaskImage\}/u);
  assert.match(glyph, /style:-webkit-mask-image=\{nativeMaskImage\}/u);
  assert.doesNotMatch(glyph, /<img[^>]+src=\{[^}]*chrome:/u);

  const [
    firefoxIcon,
    topSurface,
    trustIcon,
    leftSurface,
    addressPopup,
    bookmarks,
    downloads,
    customizePanel,
    shellIcon,
  ] = await Promise.all([
    readProjectFile("src/shell/FirefoxIcon.svelte"),
    readProjectFile("src/shell/surfaces/TopSurface.svelte"),
    readProjectFile("src/shell/FirefoxTrustIcon.svelte"),
    readProjectFile("src/shell/surfaces/LeftSurface.svelte"),
    readProjectFile("src/shell/AddressPopup.svelte"),
    readProjectFile("src/shell/BookmarksPanel.svelte"),
    readProjectFile("src/shell/DownloadsPanel.svelte"),
    readProjectFile("src/shell/CustomizePanel.svelte"),
    readProjectFile("src/shell/ShellIcon.svelte"),
  ]);
  const nativeFirefoxIconUrls = [
    "chrome://browser/skin/fxa/avatar-empty.svg",
    "chrome://global/skin/icons/arrow-down.svg",
    "chrome://global/skin/icons/arrow-right.svg",
    "chrome://browser/skin/back.svg",
    "chrome://browser/skin/bookmark.svg",
    "chrome://browser/skin/bookmark-star-on-tray.svg",
    "chrome://browser/skin/customize.svg",
    "chrome://global/skin/icons/developer.svg",
    "chrome://browser/skin/downloads/downloads.svg",
    "chrome://global/skin/icons/edit.svg",
    "chrome://browser/skin/firefox-view.svg",
    "chrome://browser/skin/forward.svg",
    "chrome://browser/skin/fullscreen.svg",
    "chrome://browser/skin/history.svg",
    "chrome://browser/skin/home.svg",
    "chrome://browser/skin/library.svg",
    "chrome://browser/skin/menu.svg",
    "chrome://browser/skin/notification-icons/camera.svg",
    "chrome://browser/skin/notification-icons/microphone.svg",
    "chrome://browser/skin/notification-icons/screen.svg",
    "chrome://browser/skin/privateBrowsing.svg",
    "chrome://global/skin/icons/print.svg",
    "chrome://browser/skin/pin.svg",
    "chrome://browser/skin/screenshot.svg",
    "chrome://browser/skin/sidebar-collapsed.svg",
    "chrome://browser/skin/tabbrowser/crashed.svg",
    "chrome://browser/skin/tabbrowser/tab-audio-blocked-circle-12.svg",
    "chrome://browser/skin/tabbrowser/tab-audio-muted-small.svg",
    "chrome://browser/skin/tabbrowser/tab-audio-playing-small.svg",
    "chrome://global/skin/icons/check.svg",
    "chrome://global/skin/icons/close.svg",
    "chrome://global/skin/icons/defaultFavicon.svg",
    "chrome://global/skin/icons/error.svg",
    "chrome://global/skin/icons/loading.svg",
    "chrome://global/skin/icons/open-in-new.svg",
    "chrome://global/skin/icons/plus.svg",
    "chrome://global/skin/icons/reload.svg",
    "chrome://global/skin/icons/search-glass.svg",
    "chrome://global/skin/icons/settings.svg",
    "chrome://global/skin/media/pause-fill.svg",
    "chrome://global/skin/media/picture-in-picture-closed.svg",
    "chrome://mozapps/skin/extensions/extension.svg",
    "chrome://browser/skin/translations.svg",
    "chrome://browser/skin/window.svg",
    "resource://content-accessible/close-12.svg",
  ];
  for (const iconUrl of nativeFirefoxIconUrls) {
    assert.ok(firefoxIcon.includes(iconUrl), iconUrl);
  }
  for (const name of [
    "back",
    "customize",
    "extensions",
    "forward",
    "home",
    "menu",
    "settings",
  ]) {
    assert.match(
      topSurface,
      new RegExp(`<FirefoxIcon(?:\\s+|[^>]*\\s)name="${name}"`, "u"),
    );
  }
  assert.match(
    topSurface,
    /<FirefoxIcon\s+name=\{currentNavigation\.snapshot\.loading \? "stop" : "reload"\}/u,
  );
  assert.match(
    topSurface,
    /data-fennevia-action="home"\s+data-fennevia-default-focus=""/u,
  );
  assert.doesNotMatch(
    topSurface,
    /data-fennevia-action="back"\s+data-fennevia-default-focus=""/u,
  );
  assert.match(firefoxIcon, /aria-hidden="true"/u);
  assert.match(firefoxIcon, /style:mask-image=\{maskImage\}/u);
  assert.match(firefoxIcon, /style:-webkit-mask-image=\{maskImage\}/u);
  assert.doesNotMatch(firefoxIcon, /<svg\b|<img\b/u);
  assert.match(
    css,
    /\.fennevia-firefox-icon[\s\S]*?background-color: currentColor;[\s\S]*?mask-size: contain;/u,
  );
  assert.match(addressPopup, /<FirefoxIcon name="close" \/>/u);
  assert.match(addressPopup, /<FirefoxIcon name="search" \/>/u);
  assert.match(addressPopup, /<FirefoxIcon name="open-in-new" \/>/u);
  assert.match(bookmarks, /<FirefoxIcon name="loading" \/>/u);
  assert.match(bookmarks, /<FirefoxIcon name="error" \/>/u);
  assert.match(downloads, /<FirefoxIcon name="download" \/>/u);
  assert.match(
    downloads,
    /<FirefoxIcon name=\{presentations\[item\.state\]\.icon\} \/>/u,
  );
  assert.match(customizePanel, /<FirefoxIcon name="close" \/>/u);
  assert.doesNotMatch(
    `${addressPopup}\n${bookmarks}\n${downloads}`,
    /[×⌁◌▾▸•↗↓✓Ⅱ]/u,
  );
  for (const nativeName of [
    "back",
    "bookmark",
    "camera",
    "customize",
    "download",
    "extensions",
    "forward",
    "loading",
    "menu",
    "pin",
    "settings",
    "tab",
  ]) {
    assert.doesNotMatch(shellIcon, new RegExp(`\\| "${nativeName}"`, "u"));
  }
  for (const exceptionName of [
    "close",
    "generic",
    "maximize",
    "minimize",
    "restore",
    "shield",
    "zoom",
  ]) {
    assert.match(shellIcon, new RegExp(`(?:\\||=) "${exceptionName}"`, "u"));
  }

  for (const state of ["active", "disabled", "insecure", "warning"]) {
    assert.match(
      trustIcon,
      new RegExp(`chrome://browser/skin/trust-icon-${state}\\.svg`, "u"),
    );
  }
  assert.match(trustIcon, /aria-hidden="true"/u);
  assert.match(trustIcon, /style:mask-image=\{maskImage\}/u);
  assert.match(trustIcon, /style:-webkit-mask-image=\{maskImage\}/u);
  assert.doesNotMatch(trustIcon, /<img\b/u);
  assert.match(leftSurface, /data-fennevia-trust-status/u);
  assert.match(addressPopup, /data-fennevia-trust-detail/u);
  assert.ok(
    leftSurface.indexOf("data-fennevia-trust-status") <
      leftSurface.indexOf('data-fennevia-address-launcher=""'),
  );
  assert.doesNotMatch(
    `${leftSurface}\n${addressPopup}`,
    /data-fennevia-(?:connection|protection)-(?:status|detail)/u,
  );
  assert.doesNotMatch(bookmarks, /bookmarks\.hint/u);
  assert.match(bookmarks, /const noticeText[\s\S]*?return "";/u);

  const customize = await Promise.all([
    readProjectFile("src/shell/CustomizePanel.svelte"),
    readProjectFile(
      "src/shell/features/customize/CustomizeInteractionSection.svelte",
    ),
    readProjectFile(
      "src/shell/features/customize/CustomizeStyleSection.svelte",
    ),
  ]).then((parts) => parts.join("\n"));
  assert.match(customize, /#0062f9/u);
  assert.match(customize, /#fbfbfe/u);
  assert.match(customize, /data-fennevia-customize-auto-hide-delay/u);
  assert.match(customize, /data-fennevia-customize-edge-trigger-size/u);
  assert.match(customize, /data-fennevia-customize-shortcut-hint-duration/u);
  assert.match(customize, /data-fennevia-customize-temporary-reveal-duration/u);
  assert.match(customize, /data-fennevia-customize-window-leave-hide-delay/u);
  assert.match(customize, /type="range"/u);
  assert.doesNotMatch(customize, /#3b82f6|#8b5cf6|#64748b|#f7fafc/u);
});

test("deferred UI work routes rejected promises to the fatal boundary", async () => {
  const [app, customizePanel, customizeTabs, toolbarWidgets, top, left] =
    await Promise.all([
      readProjectFile("src/shell/App.svelte"),
      readProjectFile("src/shell/CustomizePanel.svelte"),
      readProjectFile("src/shell/features/customize/CustomizeTabList.svelte"),
      readProjectFile(
        "src/shell/features/toolbar-widgets/ToolbarWidgetZone.svelte",
      ),
      readProjectFile("src/shell/surfaces/TopSurface.svelte"),
      readProjectFile("src/shell/surfaces/LeftSurface.svelte"),
    ]);

  assert.match(
    app,
    /<CustomizePanel[\s\S]*?onFatalError=\{props\.onFatalError\}/u,
  );
  assert.match(
    customizePanel,
    /<CustomizeTabList[\s\S]*?onFatalError=\{props\.onFatalError\}/u,
  );
  assert.match(
    customizeTabs,
    /focusSelectedTab\(tab\)\.catch\(props\.onFatalError\)/u,
  );
  for (const source of [toolbarWidgets, top, left]) {
    assert.match(
      source,
      /const reportAsyncError = \(work: Promise<unknown>\).*work\.catch\(props\.onFatalError\)/su,
    );
  }
  assert.doesNotMatch(
    toolbarWidgets,
    /\bvoid (?:runBrowserToolAction|runToolbarWidgetEdit|runToolbarWidgetPartAction|runToolbarWidgetAction)\(/u,
  );
  assert.doesNotMatch(top, /\bvoid runBrowserToolAction\(/u);
  assert.doesNotMatch(left, /\bvoid runBrowserToolAction\(/u);
});

test("the installed frontend is one IIFE, one style module, and one notice", async () => {
  const [bundle, styleModule, notices, manifest] = await Promise.all([
    readProjectFile("profile/chrome/fennevia/content/shell/ShellApp.js"),
    readProjectFile(
      "profile/chrome/fennevia/content/shell/ShellStyles.sys.mjs",
    ),
    readProjectFile(
      "profile/chrome/fennevia/content/shell/THIRD_PARTY_NOTICES.txt",
    ),
    readProjectFile("package-manifest.json").then(
      (content) =>
        /** @type {{expectedFiles: string[]}} */ (JSON.parse(content)),
    ),
  ]);

  assert.match(bundle, /^\(function\(\)\{/u);
  assert.match(bundle, /__fenneviaRegisterShellFrontend/u);
  assert.match(bundle, /FENNEVIA_SVELTE_RUNTIME_/u);
  assert.match(bundle, /data-fennevia-composable-layout/u);
  assert.match(bundle, /data-fennevia-layout-instance/u);
  assert.match(bundle, /data-fennevia-window-drag-region/u);
  assert.match(bundle, /data-fennevia-bookmark-roots/u);
  assert.match(bundle, /data-fennevia-bookmark-list/u);
  assert.match(bundle, /data-fennevia-bookmark-status/u);
  assert.doesNotMatch(
    bundle,
    /Ctrl or Command \+ Enter opens a bookmark in a new tab/u,
  );
  assert.doesNotMatch(bundle, /Ctrl 或 Command \+ Enter 可在新分頁開啟書籤/u);
  assert.match(bundle, /data-fennevia-download-summary/u);
  assert.match(bundle, /data-fennevia-download-progress/u);
  assert.match(bundle, /data-fennevia-progress-light/u);
  assert.match(bundle, /data-fennevia-progress-mode/u);
  assert.match(bundle, /data-fennevia-download-state/u);
  assert.match(bundle, /data-fennevia-window-control/u);
  assert.match(bundle, /data-fennevia-browser-tool/u);
  assert.match(bundle, /site-information/u);
  assert.match(bundle, /site-permissions/u);
  assert.match(bundle, /application-menu/u);
  assert.doesNotMatch(bundle, /Show original toolbar/u);
  assert.match(bundle, /Open Firefox site trust/u);
  assert.match(bundle, /Open Firefox site permissions/u);
  assert.match(bundle, /data-fennevia-trust-status/u);
  assert.match(bundle, /data-fennevia-trust-detail/u);
  assert.match(bundle, /chrome:\/\/browser\/skin\/trust-icon-active\.svg/u);
  assert.match(bundle, /chrome:\/\/browser\/skin\/trust-icon-disabled\.svg/u);
  assert.match(bundle, /chrome:\/\/browser\/skin\/trust-icon-insecure\.svg/u);
  assert.match(bundle, /chrome:\/\/browser\/skin\/trust-icon-warning\.svg/u);
  assert.match(bundle, /data-fennevia-icon/u);
  assert.match(bundle, /data-fennevia-action/u);
  assert.doesNotMatch(bundle, /[\r\n]/u);
  assert.doesNotMatch(bundle, /[ \t]+$/u);
  assert.doesNotMatch(bundle, /\b(?:import|export)\s/u);
  assert.doesNotMatch(bundle, /\bimport\s*\(/u);
  assert.doesNotMatch(
    bundle,
    /svelte\.dev|import\.meta\.hot|sourceMappingURL/u,
  );
  assert.doesNotMatch(
    bundle,
    /\b(?:fetch|WebSocket|EventSource|XMLHttpRequest|importScripts)\s*\(/u,
  );

  const styleMatch = styleModule.match(
    /^export const shellAppCss = (?<value>.+);\r?\n$/su,
  );
  assert.ok(styleMatch?.groups?.value);
  const css = /** @type {string} */ (JSON.parse(styleMatch.groups.value));
  assert.doesNotMatch(css, /@import|url\s*\(|:global|\/\*\$vite\$/iu);
  assert.match(css, /^#fennevia-shell-frame-host \{/u);
  assert.match(css, /#fennevia-shell-frame-host \.fennevia-edge-panel/u);
  assert.match(css, /#fennevia-shell-frame-host \.fennevia-navigation/u);
  assert.match(css, /#fennevia-shell-frame-host \.fennevia-bookmarks/u);
  assert.match(css, /#fennevia-shell-frame-host \.fennevia-downloads/u);
  assert.match(
    css,
    /\.fennevia-address-launcher__cluster \{[\s\S]*?grid-template-columns: auto minmax\(0, 1fr\);/u,
  );
  assert.match(
    css,
    /\.fennevia-address-launcher__indicator \{[\s\S]*?background: transparent;[\s\S]*?border: 0;/u,
  );
  assert.match(css, /data-fennevia-download-progress="indeterminate"/u);
  assert.match(css, /--fennevia-progress-light-thickness: 2px;/u);
  assert.match(css, /@keyframes fennevia-progress-light-pulse/u);
  assert.match(
    css,
    /data-fennevia-progress-mode="indeterminate"\][\s\S]*?inline-size: 100%;/u,
  );
  assert.match(
    css,
    /\.fennevia-progress-light \{[\s\S]*?pointer-events: none;/u,
  );
  assert.doesNotMatch(css, /#(?:00f5ff|00ffaa|80ff00|00ff64)\b/iu);
  assert.doesNotMatch(css, /hue-rotate/u);
  assert.doesNotMatch(css, /z-index:\s*2000[01]/u);
  assert.doesNotMatch(css, /#(?:top-loading-bar|download-progress-bar)\b/u);
  assert.match(css, /\.fennevia-window-controls/u);
  assert.match(css, /\.fennevia-browser-tools__button/u);
  assert.match(css, /\):disabled/u);
  assert.match(css, /data-fennevia-loading="true"/u);
  assert.match(css, /-moz-window-dragging: drag/u);
  assert.match(css, /@keyframes fennevia-shortcut-tip/u);
  assert.match(css, /@keyframes fennevia-tab-opened/u);
  assert.match(css, /data-fennevia-just-opened="true"/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(css, /@media \(forced-colors: active\)/u);
  assert.match(css, /--panel-background-color/u);
  assert.match(css, /--color-accent-primary/u);
  assert.match(css, /--focus-outline-color/u);
  assert.doesNotMatch(css, /247 250 252/u);
  assert.doesNotMatch(
    css,
    /#(?:navigator-toolbox|browser|tabbrowser-tabbox|main-window)\b/u,
  );

  assert.match(notices, /Package: svelte@5\.56\.9/u);
  assert.match(notices, /License: MIT/u);
  assert.match(notices, /included in ShellApp\.js/u);
  assert.doesNotMatch(notices, /ShellApp\.sys\.mjs/u);
  assert.doesNotMatch(notices, /\b(?:https?|wss?):\/\//iu);

  const shellFiles = manifest.expectedFiles.filter((file) =>
    file.startsWith("content/shell/"),
  );
  assert.deepEqual(shellFiles, [
    "content/shell/ShellApp.js",
    "content/shell/ShellStyles.sys.mjs",
    "content/shell/THIRD_PARTY_NOTICES.txt",
  ]);
});

test("the privileged adapter loads only the fixed per-window bundle", async () => {
  const [runtime, viteConfig, bridgeConfig] = await Promise.all([
    readProjectFile(
      "profile/chrome/fennevia/content/runtime/WindowShell.sys.mjs",
    ),
    readProjectFile("vite.config.ts"),
    readProjectFile("vite.firefox.config.ts"),
  ]);

  assert.match(
    runtime,
    /const SHELL_APP_SCRIPT_URI =\s*"chrome:\/\/fennevia\/content\/shell\/ShellApp\.js";/u,
  );
  assert.match(runtime, /Services\.scriptloader\.loadSubScript\(/u);
  assert.match(runtime, /const productionShellByFrame = new WeakMap\(\)/u);
  assert.match(
    runtime,
    /frame\.insertBefore\(style, mountPoints\.surfaces\.top\.host\)/u,
  );
  assert.match(
    runtime,
    /createFirefoxBridgeBoundary,[\s\S]*createFirefoxBookmarksBridge,[\s\S]*createFirefoxBrowserToolsBridge,[\s\S]*createFirefoxDownloadsBridge,[\s\S]*createFirefoxNavigationBridge,[\s\S]*createFirefoxTabDragCoordinator,[\s\S]*createFirefoxTabsBridge,[\s\S]*createFirefoxUrlbarCoverageBridge,[\s\S]*createFirefoxWindowControlsBridge,[\s\S]*from "\.\.\/firefox\/BridgeBoundary\.sys\.mjs";/u,
  );
  assert.match(runtime, /Reflect\.deleteProperty\(/u);
  assert.doesNotMatch(runtime, /ShellApp\.sys\.mjs|import\s*\(/u);

  assert.match(
    runtime,
    /isChromeWindowActive\(\) \{[\s\S]*?Services\.focus\.activeWindow === browserWindow/u,
  );
  assert.match(runtime, /createFirefoxLocaleBridge/u);
  assert.match(runtime, /createStaticLocaleBridge/u);
  assert.match(runtime, /getShellChromeHostLabel/u);
  assert.match(viteConfig, /fragments: "tree"/u);
  assert.match(viteConfig, /formats: \["iife"\]/u);
  assert.match(viteConfig, /codeSplitting: false/u);
  assert.match(viteConfig, /sourcemap: false/u);
  assert.match(bridgeConfig, /formats: \["es"\]/u);
  assert.match(bridgeConfig, /codeSplitting: false/u);
  assert.match(bridgeConfig, /sourcemap: false/u);
});

test("the generated Firefox boundary is one deterministic private ESM artifact", async () => {
  const [bridge, manifest] = await Promise.all([
    readProjectFile(
      "profile/chrome/fennevia/content/firefox/BridgeBoundary.sys.mjs",
    ),
    readProjectFile("package-manifest.json").then(
      (content) =>
        /** @type {{expectedFiles: string[]}} */ (JSON.parse(content)),
    ),
  ]);

  assert.match(bridge, /createFirefoxBridgeBoundary/u);
  assert.match(bridge, /createFirefoxBookmarksBridge/u);
  assert.match(bridge, /createFirefoxBrowserToolsBridge/u);
  assert.match(bridge, /createFirefoxDownloadsBridge/u);
  assert.match(bridge, /createFirefoxNavigationBridge/u);
  assert.match(bridge, /createFirefoxTabsBridge/u);
  assert.match(bridge, /createFirefoxTabDragCoordinator/u);
  assert.match(bridge, /createFirefoxUrlbarCoverageBridge/u);
  assert.match(bridge, /createFirefoxWindowControlsBridge/u);
  assert.match(bridge, /createFirefoxLocaleBridge/u);
  assert.match(bridge, /getShellChromeHostLabel/u);
  assert.match(bridge, /FENNEVIA_FIREFOX_CAPABILITY_MISSING/u);
  assert.match(bridge, /FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING/u);
  assert.match(bridge, /FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING/u);
  assert.match(bridge, /FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING/u);
  assert.match(bridge, /FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING/u);
  assert.match(bridge, /FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING/u);
  assert.match(bridge, /export \{/u);
  assert.doesNotMatch(
    bridge,
    /sourceMappingURL|import\.meta\.hot|\bimport\s*\(/u,
  );
  assert.doesNotMatch(
    bridge,
    /\b(?:fetch|WebSocket|EventSource|XMLHttpRequest|importScripts)\s*\(/u,
  );
  assert.doesNotMatch(bridge, /\b(?:https?|wss?):\/\//iu);

  assert.deepEqual(
    manifest.expectedFiles.filter((file) =>
      file.startsWith("content/firefox/"),
    ),
    ["content/firefox/BridgeBoundary.sys.mjs"],
  );
});
