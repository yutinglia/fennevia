import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  findCloseFocusTarget,
  getDisplayTabTitle,
  getTabAccessibleName,
  getTabActionAccessibleName,
  getTabStripKeyAction,
  resolveRovingTabId,
} from "../src/app/tab-strip.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const tab = (overrides = {}) =>
  Object.freeze({
    id: "tab-1",
    loading: false,
    pinned: false,
    selected: false,
    title: "Example",
    ...overrides,
  });

test("tab labels preserve page text as text and expose bounded ordinary state", () => {
  const bidiTitle = "עברית — Example — العربية";
  const candidate = tab({
    faviconUrl: "data:image/png;base64,AAAA",
    loading: true,
    pinned: true,
    title: bidiTitle,
  });

  assert.equal(getDisplayTabTitle(candidate), bidiTitle);
  assert.equal(
    getTabAccessibleName(candidate, 2, 8),
    `${bidiTitle}, 3 of 8, Pinned, Loading`,
  );
  assert.equal(
    getTabActionAccessibleName("close", candidate),
    `Close ${bidiTitle}`,
  );
  assert.equal(
    getTabActionAccessibleName("unpin", candidate),
    `Unpin ${bidiTitle}`,
  );
  assert.doesNotMatch(
    getTabAccessibleName(candidate, 2, 8),
    /data:image|favicon/iu,
  );
  assert.equal(getDisplayTabTitle(tab({ title: " \t " })), "Untitled tab");
});

test("roving focus prefers a live target, then the selected tab, then native order", () => {
  const tabs = [
    tab({ id: "first" }),
    tab({ id: "selected", selected: true }),
    tab({ id: "last" }),
  ];

  assert.equal(resolveRovingTabId(tabs, "last"), "last");
  assert.equal(resolveRovingTabId(tabs, "stale"), "selected");
  assert.equal(resolveRovingTabId([tab({ id: "first" })]), "first");
  assert.equal(resolveRovingTabId([]), null);
  assert.equal(findCloseFocusTarget(tabs, "first"), "selected");
  assert.equal(findCloseFocusTarget(tabs, "last"), "selected");
  assert.equal(findCloseFocusTarget([tabs[0]], "first"), null);
});

test("keyboard navigation wraps, respects direction, and produces explicit actions", () => {
  const tabs = [
    tab({ id: "first" }),
    tab({ id: "middle" }),
    tab({ id: "last" }),
  ];

  assert.deepEqual(getTabStripKeyAction(tabs, "first", "ArrowLeft"), {
    tabId: "last",
    type: "select",
  });
  assert.deepEqual(getTabStripKeyAction(tabs, "first", "ArrowRight", "rtl"), {
    tabId: "last",
    type: "select",
  });
  assert.deepEqual(
    getTabStripKeyAction(tabs, "first", "ArrowUp", "ltr", "vertical"),
    {
      tabId: "last",
      type: "select",
    },
  );
  assert.deepEqual(
    getTabStripKeyAction(tabs, "middle", "ArrowDown", "ltr", "vertical"),
    {
      tabId: "last",
      type: "select",
    },
  );
  assert.equal(
    getTabStripKeyAction(tabs, "middle", "ArrowLeft", "ltr", "vertical"),
    null,
  );
  assert.deepEqual(getTabStripKeyAction(tabs, "middle", "Home"), {
    tabId: "first",
    type: "select",
  });
  assert.deepEqual(getTabStripKeyAction(tabs, "middle", "End"), {
    tabId: "last",
    type: "select",
  });
  assert.deepEqual(getTabStripKeyAction(tabs, "middle", "Delete"), {
    tabId: "middle",
    type: "close",
  });
  assert.deepEqual(getTabStripKeyAction(tabs, "middle", " "), {
    tabId: "middle",
    type: "select",
  });
  assert.equal(getTabStripKeyAction(tabs, "middle", "PageDown"), null);
  assert.equal(getTabStripKeyAction(tabs, "stale", "ArrowRight"), null);
});

test("the component uses semantic sibling controls and property-safe rendering only", async () => {
  const [source, styles] = await Promise.all([
    readFile(path.join(projectRoot, "src", "shell", "App.svelte"), "utf8"),
    readFile(
      path.join(projectRoot, "src", "shell", "styles", "edge-shell.css"),
      "utf8",
    ),
  ]);

  assert.match(source, /role="tablist"/u);
  assert.match(source, /aria-orientation="vertical"/u);
  assert.match(source, /role="tab"/u);
  assert.match(source, /aria-selected=\{tab\.selected\}/u);
  assert.match(source, /tabindex=\{rovingTabId === tab\.id \? 0 : -1\}/u);
  assert.match(source, /use:setFaviconSource=\{tab\.faviconUrl\}/u);
  assert.match(source, /node\.src = nextSource/u);
  assert.match(source, /node\.onerror = null/u);
  assert.doesNotMatch(source, /src=\{tab\.faviconUrl\}|onerror=\{/u);
  assert.match(source, /onfocusin=\{handleRootFocusIn\}/u);
  assert.match(source, /timer\.view\.clearTimeout\(timer\.id\)/u);
  assert.match(source, /delayedFocusTimer !== timer/u);
  assert.match(source, /if \(delayedFocusTimer\) \{\s*return;/u);
  assert.match(
    source,
    /focusTab\(resolveRovingTabId\(currentTabs\.tabs, tabId\)\)\.then\(\s*releaseSurfaceFocus/u,
  );
  assert.match(source, /focusReleaseTimer !== timer/u);
  assert.match(source, /releaseSurfaceFocus\(\);\s*\}, 0\)/u);
  assert.match(source, /onDestroy\(\(\) => \{\s*cancelDelayedFocus\(\)/u);
  assert.match(source, /cancelDelayedFocus\(\);\s*cancelFocusRelease\(\)/u);
  assert.match(source, /"ltr",\s*"vertical"/u);
  assert.match(styles, /@media \(forced-colors: active\)/u);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(styles, /@media \(prefers-reduced-transparency: reduce\)/u);
  assert.match(styles, /unicode-bidi: plaintext/u);
  assert.match(styles, /overflow-y: auto/u);
  assert.match(styles, /:focus-visible/u);
  assert.match(styles, /@supports \(backdrop-filter: blur\(1px\)\)/u);
  for (const token of [
    "glass-surface",
    "glass-tint",
    "glass-text",
    "glass-muted",
    "glass-border",
    "glass-separator",
    "glass-blur",
    "glass-saturation",
    "glass-radius",
    "glass-shadow",
    "edge-inset",
    "edge-trigger-thickness",
    "edge-side-width",
    "edge-top-height",
    "edge-bottom-height",
    "space-1",
    "control-height",
    "motion-duration",
    "motion-easing",
    "focus-color",
    "selected-surface",
  ]) {
    assert.match(styles, new RegExp(`--fennevia-${token}:`, "u"));
  }
  for (const edge of ["top", "left", "right", "bottom"]) {
    assert.match(styles, new RegExp(`data-fennevia-edge=["']${edge}["']`, "u"));
  }
  assert.match(styles, /@media \(max-width: 700px\), \(max-height: 520px\)/u);
  assert.doesNotMatch(styles, /transition\s*:\s*all\b/iu);
  assert.deepEqual(
    [
      ...styles.matchAll(/^\s*animation:\s*([^;]+);/gmu),
    ].map((match) => match[1]),
    [
      "fennevia-shortcut-tip 2800ms ease-out both",
      "fennevia-address-loading 1200ms ease-in-out infinite",
      "none",
      "none",
    ],
  );
  assert.doesNotMatch(
    styles,
    /#(?:navigator-toolbox|browser|tabbrowser-tabbox|main-window)\b/u,
  );
  assert.doesNotMatch(
    source,
    /\{@html|style=.*faviconUrl|url\s*\([^)]*favicon/iu,
  );
  assert.doesNotMatch(
    source,
    /\b(?:gBrowser|Services|PlacesUtils|SessionStore|ChromeUtils)\b/u,
  );

  const itemBody = source.match(
    /<div\s+class="fennevia-tab-strip__item"[\s\S]*?<\/div>\s*\{\/each\}/u,
  )?.[0];
  assert.ok(itemBody);
  const buttonOpenings = [...itemBody.matchAll(/<button\b/gu)].map(
    (match) => match.index,
  );
  const buttonClosings = [...itemBody.matchAll(/<\/button\s*>/gu)].map(
    (match) => match.index,
  );
  assert.equal(buttonOpenings.length, 3);
  assert.equal(buttonClosings.length, 3);
  for (const [index, opening] of buttonOpenings.entries()) {
    assert.ok(opening < buttonClosings[index]);
    assert.ok(
      buttonOpenings[index + 1] === undefined ||
        buttonClosings[index] < buttonOpenings[index + 1],
    );
  }
});
