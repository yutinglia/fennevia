import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "..");
const readProjectFile = (relativePath) =>
  readFile(path.join(projectRoot, ...relativePath.split("/")), "utf8");

test("stable facades keep feature implementations out of public entry files", async () => {
  const firefoxFeatures = [
    "bookmarks",
    "browser-tools",
    "downloads",
    "navigation",
    "tabs",
    "toolbar-widgets",
    "urlbar-coverage",
    "urlbar-suggestions",
  ];
  for (const feature of firefoxFeatures) {
    const facade = await readProjectFile(`src/firefox/${feature}.ts`);
    assert.match(
      facade,
      new RegExp(
        `^// SPDX-License-Identifier: MPL-2\\.0\\r?\\nexport \\* from "\\./${feature}/controller\\.ts";\\r?\\n?$`,
        "u",
      ),
    );
  }

  const shell = await readProjectFile("src/shell/index.ts");
  assert.match(shell, /from "\.\/runtime\/mount-shell"/u);
  assert.doesNotMatch(shell, /function mountShellApp/u);
});

test("browser tools separate lifecycle wiring from placement and popup actions", async () => {
  const [controller, placement, popupActions] = await Promise.all([
    readProjectFile("src/firefox/browser-tools/controller.ts"),
    readProjectFile("src/firefox/browser-tools/panel-placement.ts"),
    readProjectFile("src/firefox/browser-tools/popup-actions.ts"),
  ]);

  assert.match(controller, /createBrowserToolsPanelPlacement/u);
  assert.match(controller, /createBrowserToolsPopupActionInvoker/u);
  assert.doesNotMatch(controller, /FullPageTranslationsPanel|PanelMultiView/u);
  assert.match(placement, /const openPanelOnHost/u);
  assert.match(popupActions, /const invokeTranslate/u);
  assert.match(popupActions, /const invokeApplicationMenu/u);
});

test("shell composition and CSS retain explicit module ownership", async () => {
  const [app, customize, css] = await Promise.all([
    readProjectFile("src/shell/App.svelte"),
    readProjectFile("src/shell/CustomizePanel.svelte"),
    readProjectFile("src/shell/styles/edge-shell.css"),
  ]);
  assert.doesNotMatch(
    app,
    /\.\/surfaces\/(?:Top|Left|Right|Bottom)Surface\.svelte/u,
  );
  assert.match(
    app,
    /\.\/features\/composable-layout\/ComposableLayout\.svelte/u,
  );
  assert.match(
    app,
    /\.\/features\/context-menu\/EdgePanelContextMenu\.svelte/u,
  );
  assert.match(
    customize,
    /features\/customize\/CustomizeStyleSection\.svelte/u,
  );
  assert.match(
    customize,
    /features\/customize\/CustomizeInteractionSection\.svelte/u,
  );
  assert.match(
    customize,
    /features\/customize\/CustomizePanelsSection\.svelte/u,
  );
  assert.match(customize, /features\/customize\/CustomizeTabList\.svelte/u);
  const tabList = await readProjectFile(
    "src/shell/features/customize/CustomizeTabList.svelte",
  );
  assert.match(tabList, /role="tablist"/u);

  assert.deepEqual(css.trim().split(/\r?\n/u), [
    '@import "./foundation.css";',
    '@import "./downloads.css";',
    '@import "./bookmarks.css";',
    '@import "./address.css";',
    '@import "./tabs.css";',
    '@import "./toolbar.css";',
    '@import "./composable-layout.css";',
    '@import "./customize.css";',
    '@import "./window-controls.css";',
    '@import "./responsive-accessibility.css";',
  ]);
});

test("installer implementation uses one fixed release-inventoried allowlist", async () => {
  const loader = await readProjectFile("scripts/lib/FenneviaInstaller.psm1");
  const implementationFiles = Array.from(
    loader.matchAll(/^ {4}"([A-Za-z]+\.ps1)",?$/gmu),
    (match) => match[1],
  );
  assert.deepEqual(implementationFiles, [
    "Common.ps1",
    "Discovery.ps1",
    "Ownership.ps1",
    "Planning.ps1",
    "Transaction.ps1",
    "Public.ps1",
  ]);
  assert.doesNotMatch(loader, /Get-ChildItem|GetFiles|EnumerateFiles/u);

  for (const implementationFile of implementationFiles) {
    const implementation = await readProjectFile(
      `scripts/lib/installer/${implementationFile}`,
    );
    assert.match(implementation, /^function Fennevia|^function [A-Za-z]/mu);
  }
});
