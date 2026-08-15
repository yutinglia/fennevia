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
    /createFirefoxBridgeBoundary,[\s\S]*createFirefoxTabsBridge,[\s\S]*from "\.\.\/firefox\/BridgeBoundary\.sys\.mjs";/u,
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
  assert.match(bridge, /createFirefoxTabsBridge/u);
  assert.match(bridge, /FENNEVIA_FIREFOX_CAPABILITY_MISSING/u);
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
