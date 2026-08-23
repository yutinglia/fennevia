import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("bookmark rows expose bounded pointer and keyboard context actions", async () => {
  const [source, styles] = await Promise.all([
    readFile(
      path.join(projectRoot, "src", "shell", "BookmarksPanel.svelte"),
      "utf8",
    ),
    readFile(
      path.join(projectRoot, "src", "shell", "styles", "bookmarks.css"),
      "utf8",
    ),
  ]);

  assert.match(
    source,
    /oncontextmenu=\{\(event\) => handleBookmarkContextMenu/u,
  );
  assert.match(source, /event\.key === "ContextMenu"/u);
  assert.match(source, /event\.shiftKey && event\.key === "F10"/u);
  assert.match(source, /role="menu"/u);
  assert.match(source, /role="menuitem"/u);
  assert.match(source, /activateContextMenuAction\("manage-bookmarks"\)/u);
  assert.match(source, /props\.onDismiss\(\);\s*props\.bookmarks\.manage\(\)/u);
  assert.match(source, /props\.bookmarks\.manage\(\)/u);
  assert.match(source, /event\.key === "Escape"/u);
  assert.match(source, /setPopupHeld\(props\.edge, true\)/u);
  assert.match(source, /setPopupHeld\(props\.edge, false\)/u);
  assert.match(source, /onauxclick=/u);
  assert.match(
    source,
    /handleBookmarkClick[\s\S]*?event\.button !== 0[\s\S]*?return/u,
  );
  assert.match(source, /openBookmark\(bookmarkId, "new-tab"\)/u);
  assert.match(source, /onmousedown=/u);
  assert.match(source, /preventMiddleAutoscroll/u);
  assert.match(source, /use:setFaviconSource=\{row\.node\.faviconUrl\}/u);
  assert.match(source, /referrerpolicy="no-referrer"/u);
  assert.match(source, /draggable="false"/u);
  assert.match(source, /blurFocusedContextMenuItem\(\);/u);
  const closeStart = source.indexOf("const closeBookmarkContextMenu");
  const blurBeforeRemoval = source.indexOf(
    "blurFocusedContextMenuItem();",
    closeStart,
  );
  const menuRemoval = source.indexOf("contextMenu = null;", closeStart);
  assert.ok(closeStart >= 0);
  assert.ok(blurBeforeRemoval > closeStart);
  assert.ok(menuRemoval > blurBeforeRemoval);
  assert.doesNotMatch(source, /handleBookmarkPanelPointerOut|onpointerout=/u);
  assert.match(source, /restoreFocus \? source : null/u);
  assert.match(
    source,
    /addEventListener\("pointerdown", closeFromPointer, true\)/u,
  );
  assert.match(source, /removeEventListener\("pointerdown"/u);
  assert.match(source, /removeEventListener\("blur"/u);
  assert.match(styles, /\.fennevia-bookmarks__context-menu/u);
  assert.match(styles, /\.fennevia-bookmarks__item-favicon/u);
  assert.doesNotMatch(
    source,
    /\b(?:gBrowser|Services|PlacesUtils|SessionStore|ChromeUtils)\b/u,
  );
});
