import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
  const css = await readProjectFile("src/shell/styles/edge-shell.css");
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

test("edge panels touch the trigger gutter, release native drags, and float visible transient shortcuts", async () => {
  const css = await readProjectFile("src/shell/styles/edge-shell.css");

  assert.match(css, /--fennevia-edge-trigger-thickness: 12px;/u);
  assert.match(css, /--fennevia-edge-inset: 7px;/u);
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
  assert.match(css, /animation: fennevia-shortcut-tip 2800ms/u);
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
    /\.fennevia-edge-panel__footer kbd \{[\s\S]*?background: light-dark\(rgb\(247 250 252\), rgb\(20 26 35\)\);/u,
  );

  const component = await readProjectFile("src/shell/App.svelte");
  assert.match(
    component,
    /handlePanelPointerDown[\s\S]*?setPointerHeld\(props\.edge, false\)/u,
  );
  assert.match(component, /handlePanelPointerRelease/u);
  assert.match(component, /onpointercancel=\{handlePanelPointerRelease\}/u);
  assert.match(component, /onpointerup=\{handlePanelPointerRelease\}/u);
  assert.match(component, /<ProgressLight presentation=\{loadLight\} \/>/u);
  assert.match(component, /<ProgressLight presentation=\{downloadLight\} \/>/u);
  assert.match(component, /<ToolbarWidgetGlyph \{widget\} \/>/u);
  assert.match(component, /toolbarWidgetDragMimeType/u);
  assert.match(css, /data-fennevia-customize-active/u);
  assert.match(css, /--fennevia-bottom-clearance/u);
  assert.match(
    css,
    /\.fennevia-customize \{[\s\S]*?var\(--fennevia-left-clearance\)[\s\S]*?var\(--fennevia-right-clearance\)/u,
  );
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
  assert.match(bundle, /data-fennevia-window-controls/u);
  assert.match(bundle, /data-fennevia-bookmark-roots/u);
  assert.match(bundle, /data-fennevia-bookmark-list/u);
  assert.match(bundle, /data-fennevia-bookmark-status/u);
  assert.match(bundle, /data-fennevia-download-summary/u);
  assert.match(bundle, /data-fennevia-download-progress/u);
  assert.match(bundle, /data-fennevia-progress-light/u);
  assert.match(bundle, /data-fennevia-progress-mode/u);
  assert.match(bundle, /data-fennevia-download-state/u);
  assert.match(bundle, /data-fennevia-window-control/u);
  assert.match(bundle, /data-fennevia-browser-tools/u);
  assert.match(bundle, /data-fennevia-browser-tool/u);
  assert.match(bundle, /site-information/u);
  assert.match(bundle, /site-permissions/u);
  assert.match(bundle, /application-menu/u);
  assert.doesNotMatch(bundle, /Show original toolbar/u);
  assert.match(bundle, /Open Firefox site information/u);
  assert.match(bundle, /Open Firefox tracking protection/u);
  assert.match(bundle, /Open Firefox site permissions/u);
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
    /createFirefoxBridgeBoundary,[\s\S]*createFirefoxBookmarksBridge,[\s\S]*createFirefoxBrowserToolsBridge,[\s\S]*createFirefoxDownloadsBridge,[\s\S]*createFirefoxNavigationBridge,[\s\S]*createFirefoxTabsBridge,[\s\S]*createFirefoxUrlbarCoverageBridge,[\s\S]*createFirefoxWindowControlsBridge,[\s\S]*from "\.\.\/firefox\/BridgeBoundary\.sys\.mjs";/u,
  );
  assert.match(runtime, /Reflect\.deleteProperty\(/u);
  assert.doesNotMatch(runtime, /ShellApp\.sys\.mjs|import\s*\(/u);

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
  assert.match(bridge, /createFirefoxUrlbarCoverageBridge/u);
  assert.match(bridge, /createFirefoxWindowControlsBridge/u);
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
