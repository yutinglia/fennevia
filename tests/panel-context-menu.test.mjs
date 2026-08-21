import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("all four edge panels expose useful bounded context menus", async () => {
  const [appSource, menuSource, styles] = await Promise.all([
    readFile(path.join(projectRoot, "src", "shell", "App.svelte"), "utf8"),
    readFile(
      path.join(
        projectRoot,
        "src",
        "shell",
        "features",
        "context-menu",
        "EdgePanelContextMenu.svelte",
      ),
      "utf8",
    ),
    readFile(
      path.join(projectRoot, "src", "shell", "styles", "foundation.css"),
      "utf8",
    ),
  ]);
  const source = `${appSource}\n${menuSource}`;

  assert.match(appSource, /<EdgePanelContextMenu/u);
  assert.match(menuSource, /addEventListener\("contextmenu"/u);
  assert.match(source, /data-fennevia-edge-context-menu=\{props\.edge\}/u);
  assert.match(source, /\[data-fennevia-tab-item\]/u);
  assert.match(source, /\[data-fennevia-bookmark-item\]/u);
  assert.match(
    menuSource,
    /if \(isItemContextOwner\(target\)\) \{\s+return;\s+\}/u,
  );
  assert.match(source, /role="menu"/u);
  assert.match(source, /role="menuitem"/u);
  assert.match(source, /props\.edge === "top"/u);
  assert.match(source, /props\.edge === "left"/u);
  assert.match(source, /props\.edge === "right"/u);
  assert.match(source, /props\.edge === "bottom"/u);
  for (const action of [
    "customize-fennevia",
    "customize-firefox",
    "manage-bookmarks",
    "native-toolbar",
    "new-tab",
    "open-downloads",
    "settings",
  ]) {
    assert.match(source, new RegExp(`"${action}"`, "u"));
  }
  assert.match(source, /setPopupHeld\(props\.edge, true\)/u);
  assert.match(source, /setPopupHeld\(props\.edge, false\)/u);
  assert.match(menuSource, /blurFocusedContextMenuItem\(\);/u);
  const closeStart = menuSource.indexOf("const closeContextMenu");
  const blurBeforeRemoval = menuSource.indexOf(
    "blurFocusedContextMenuItem();",
    closeStart,
  );
  const menuRemoval = menuSource.indexOf("contextMenu = null;", closeStart);
  assert.ok(closeStart >= 0);
  assert.ok(blurBeforeRemoval > closeStart);
  assert.ok(menuRemoval > blurBeforeRemoval);
  assert.doesNotMatch(
    menuSource,
    /handlePanelPointerOut|addEventListener\("pointerout"/u,
  );
  assert.match(
    menuSource,
    /event\.clientX === 0 && event\.clientY === 0 \? interactiveTarget : null/u,
  );
  assert.match(source, /event\.key === "Escape"/u);
  assert.match(source, /clientX === 0 && clientY === 0/u);
  assert.match(source, /const host = props\.panel/u);
  assert.match(
    menuSource,
    /addEventListener\("pointerdown", closeFromPointer, true\)/u,
  );
  assert.match(source, /removeEventListener\("pointerdown"/u);
  assert.match(source, /removeEventListener\("blur"/u);
  assert.match(styles, /\.fennevia-edge-context-menu/u);
  assert.match(styles, /max-block-size: calc\(100vh - 12px\)/u);
  assert.match(styles, /-moz-window-dragging: no-drag/u);
  assert.doesNotMatch(
    source,
    /\b(?:gBrowser|Services|PlacesUtils|SessionStore|ChromeUtils)\b/u,
  );
});
