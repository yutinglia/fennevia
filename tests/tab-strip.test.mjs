import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readShellStyles } from "./support/shell-styles.mjs";

import {
  findCloseFocusTarget,
  findOpenedTabIds,
  findTabMoveIndex,
  getDisplayTabTitle,
  getTabAccessibleName,
  getTabActionAccessibleName,
  getTabAudioAction,
  getTabStripKeyAction,
  newTabHighlightDurationMs,
  resolveRovingTabId,
  resolveTabDropIndex,
  resolveTabDropPreview,
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
  assert.equal(
    getDisplayTabTitle(tab({ title: " \t " }), {
      allowMedia: "Allow media for",
      attention: "Attention",
      close: "Close",
      indexOf: "{index} of {total}",
      loading: "Loading",
      mediaBlocked: "Media blocked",
      mute: "Mute",
      muted: "Muted",
      pin: "Pin",
      pinned: "Pinned",
      pip: "Picture in picture",
      playing: "Playing",
      unmute: "Unmute",
      unpin: "Unpin",
      untitled: "未命名分頁",
    }),
    "未命名分頁",
  );
});

test("accessible names include audio, attention, and container labels", () => {
  const candidate = tab({
    attention: true,
    audio: "muted",
    container: { color: "blue", label: "Personal" },
    pictureInPicture: true,
    title: "Example",
  });
  assert.equal(
    getTabAccessibleName(candidate, 0, 2),
    "Example, 1 of 2, Muted, Attention, Picture in picture, Personal",
  );
  assert.equal(getTabAudioAction(candidate), "unmute");
  assert.equal(
    getTabActionAccessibleName("unmute", candidate),
    "Unmute Example",
  );
  assert.equal(getTabAudioAction(tab({ audio: "playing" })), "mute");
  assert.equal(getTabAudioAction(tab({ audio: "blocked" })), "resume-media");
  assert.equal(getTabAudioAction(tab()), null);
});

test("move helpers stay inside the pinned partition and ignore no-op drops", () => {
  const tabs = [
    tab({ id: "pinned-a", pinned: true }),
    tab({ id: "pinned-b", pinned: true }),
    tab({ id: "open-a", selected: true }),
    tab({ id: "open-b" }),
  ];
  assert.equal(findTabMoveIndex(tabs, "open-a", 1), 3);
  assert.equal(findTabMoveIndex(tabs, "open-a", -1), null);
  assert.equal(findTabMoveIndex(tabs, "pinned-b", 1), null);
  assert.equal(findTabMoveIndex(tabs, "pinned-a", 1), 1);
  assert.equal(resolveTabDropIndex(tabs, "open-b", [10, 30, 50, 70], 20), 2);
  assert.equal(resolveTabDropIndex(tabs, "open-b", [10, 30, 50, 70], 80), null);
  assert.equal(resolveTabDropIndex(tabs, "pinned-a", [10, 30, 50, 70], 80), 1);
  assert.deepEqual(resolveTabDropPreview(tabs, "open-b", 2), {
    index: 2,
    position: "before",
  });
  assert.deepEqual(resolveTabDropPreview(tabs, "pinned-a", 1), {
    index: 1,
    position: "after",
  });
  assert.equal(resolveTabDropPreview(tabs, "open-a", 2), null);
  assert.equal(resolveTabDropPreview(tabs, "missing", 1), null);
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

test("opened-tab detection ignores reorder and reports only new ids", () => {
  const first = tab({ id: "first", selected: true });
  const second = tab({ id: "second" });
  const opened = tab({ id: "opened", selected: true });

  assert.deepEqual(findOpenedTabIds([first], [first, opened]), ["opened"]);
  assert.deepEqual(findOpenedTabIds([first, second], [second, first]), []);
  assert.deepEqual(findOpenedTabIds([], [first, second]), ["first", "second"]);
  assert.equal(newTabHighlightDurationMs, 1_600);
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
  const [frameSource, tabSource, topSource, styles] = await Promise.all([
    readFile(path.join(projectRoot, "src", "shell", "App.svelte"), "utf8"),
    readFile(
      path.join(
        projectRoot,
        "src",
        "shell",
        "features",
        "tabs",
        "TabStrip.svelte",
      ),
      "utf8",
    ),
    readFile(
      path.join(projectRoot, "src", "shell", "surfaces", "TopSurface.svelte"),
      "utf8",
    ),
    readShellStyles(projectRoot),
  ]);
  const source = [frameSource, tabSource, topSource].join("\n");

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
  assert.match(
    tabSource,
    /const reportAsyncError = \(work: Promise<unknown>\).*work\.catch\(props\.onFatalError\)/su,
  );
  assert.doesNotMatch(tabSource, /void (?:focusTab|revealOpenedTabs)\(/u);
  assert.match(frameSource, /tick\(\)[\s\S]*\.catch\(props\.onFatalError\)/u);
  assert.match(source, /focusReleaseTimer !== timer/u);
  assert.match(source, /releaseSurfaceFocus\(\);\s*\}, 0\)/u);
  assert.match(tabSource, /onDestroy\(\(\) => \{\s*cancelDelayedFocus\(\)/u);
  assert.match(tabSource, /cancelHighlight\(\)/u);
  assert.match(frameSource, /onDestroy\(\(\) => \{\s*cancelFocusRelease\(\)/u);
  assert.match(source, /data-fennevia-action="home"/u);
  assert.match(source, /handleNavigationAuxClick/u);
  assert.match(source, /preventMiddleAutoscroll/u);
  assert.match(source, /navigation\.reload\(gesture\)/u);
  assert.match(
    source,
    /revealProgrammatically\("left", newTabHighlightDurationMs\)/u,
  );
  assert.match(
    source,
    /data-fennevia-just-opened=\{highlightedTabIds\.includes\(tab\.id\)\}/u,
  );
  assert.match(source, /"ltr",\s*"vertical"/u);
  assert.match(source, /handleTabAuxClick/u);
  assert.match(source, /openContextMenu/u);
  assert.match(source, /draggable="true"/u);
  assert.match(source, /data-fennevia-action="toggle-mute"/u);
  assert.match(
    source,
    /data-fennevia-container-color=\{tab\.container\?\.color\}/u,
  );
  assert.match(source, /findTabMoveIndex/u);
  assert.match(source, /resolveTabDropIndex/u);
  assert.match(source, /resolveTabDropPreview/u);
  assert.match(source, /transfer\.setDragImage/u);
  assert.match(source, /data-fennevia-drop-preview/u);
  assert.match(source, /ondragleave=\{handleTabListDragLeave\}/u);
  assert.match(source, /clearTabDrag\(\)/u);
  assert.match(source, /setPointerHeld\("left", true\)/u);
  assert.match(styles, /data-fennevia-drop-preview="before"/u);
  assert.match(styles, /data-fennevia-drop-preview="after"/u);
  assert.match(styles, /@media \(forced-colors: active\)/u);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(styles, /@media \(prefers-reduced-transparency: reduce\)/u);
  assert.match(styles, /unicode-bidi: plaintext/u);
  assert.match(
    styles,
    /\.fennevia-tab-strip__list \{[\s\S]*?flex: 0 1 auto;[\s\S]*?overflow-y: auto;/u,
  );
  assert.match(styles, /\.fennevia-tab-strip__new \{[\s\S]*?flex: none;/u);
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
    "control-radius",
    "chip-radius",
    "glass-shadow",
    "edge-inset",
    "edge-trigger-thickness",
    "shortcut-tip-duration",
    "progress-light-thickness",
    "progress-light",
    "edge-side-width",
    "edge-top-height",
    "edge-bottom-height",
    "space-1",
    "control-height",
    "motion-duration",
    "motion-easing",
    "focus-color",
    "selected-surface",
    "danger-color",
  ]) {
    assert.match(styles, new RegExp(`--fennevia-${token}:`, "u"));
  }
  assert.match(styles, /--panel-background-color/u);
  assert.match(styles, /--toolbar-background-color/u);
  assert.match(styles, /--color-accent-primary/u);
  assert.match(styles, /--focus-outline-color/u);
  assert.doesNotMatch(styles, /247 250 252/u);
  for (const edge of ["top", "left", "right", "bottom"]) {
    assert.match(styles, new RegExp(`data-fennevia-edge=["']${edge}["']`, "u"));
  }
  assert.match(styles, /@media \(max-width: 700px\), \(max-height: 520px\)/u);
  assert.doesNotMatch(styles, /transition\s*:\s*all\b/iu);
  assert.deepEqual(
    [...styles.matchAll(/^\s*animation:\s*([^;]+);/gmu)].map((match) =>
      match[1].replace(/\s+/gu, " "),
    ),
    [
      "fennevia-progress-light-pulse 1.4s ease-in-out infinite alternate",
      "fennevia-shortcut-tip var(--fennevia-shortcut-tip-duration) ease-out both",
      "fennevia-tab-opened 1600ms var(--fennevia-motion-easing) both",
      "fennevia-shortcut-tip-reduced-motion var(--fennevia-shortcut-tip-duration) step-end both",
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
  assert.equal(buttonOpenings.length, 4);
  assert.equal(buttonClosings.length, 4);
  for (const [index, opening] of buttonOpenings.entries()) {
    assert.ok(opening < buttonClosings[index]);
    assert.ok(
      buttonOpenings[index + 1] === undefined ||
        buttonClosings[index] < buttonOpenings[index + 1],
    );
  }
});
