import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readShellStyles } from "./support/shell-styles.mjs";

import {
  findCloseFocusTarget,
  findOpenedTabIds,
  findTabGroupMoveIndex,
  findTabMoveIndex,
  getDisplayTabTitle,
  getTabAccessibleName,
  getTabActionAccessibleName,
  getTabAudioAction,
  getTabStripKeyAction,
  countMultiSelectedTabs,
  hasAccelModifier,
  isDraggedTabMissing,
  isCollapsedDragMember,
  isTabInDragGroup,
  newTabHighlightDurationMs,
  normalizeTabDropPointerY,
  resolveDraggedTabTranslateY,
  resolveRovingTabId,
  resolveTabPointerAction,
  resolveExternalTabDragShift,
  resolveExternalTabDropIndex,
  resolveTabDragShift,
  resolveTabDropIndex,
  resolveTabDropPreview,
} from "../src/app/tab-strip.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("regular tabs keep intrinsic height above the new-tab button", async () => {
  const styles = await readShellStyles(projectRoot);
  const listRule = styles.match(
    /^#fennevia-shell-frame-host \.fennevia-tab-strip__list \{([^}]*)\}/mu,
  )?.[1];
  const regularPartitionRule = styles.match(
    /\.fennevia-tab-strip__partition--regular \{([^}]*)\}/u,
  )?.[1];

  assert.ok(listRule, "expected the outer tab-list sizing rule");
  assert.ok(
    regularPartitionRule,
    "expected the regular tab-partition sizing rule",
  );
  assert.match(listRule, /flex: 0 1 auto;/u);
  assert.match(regularPartitionRule, /flex: 1 1 auto;/u);
  assert.doesNotMatch(regularPartitionRule, /flex: 1 1 0;/u);
});

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
    getTabActionAccessibleName("close", candidate, undefined, 3),
    "Close 3 tabs",
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
      cameraInUse: "Using camera",
      close: "Close",
      crashed: "Crashed",
      indexOf: "{index} of {total}",
      loading: "Loading",
      mediaBlocked: "Media blocked",
      microphoneInUse: "Using microphone",
      mute: "Mute",
      muted: "Muted",
      pin: "Pin",
      pinned: "Pinned",
      pip: "Picture in picture",
      playing: "Playing",
      screenSharing: "Sharing screen",
      unmute: "Unmute",
      unpin: "Unpin",
      untitled: "未命名分頁",
    }),
    "未命名分頁",
  );
});

test("accessible names include audio, capture, crash, and other tab states", () => {
  const candidate = tab({
    attention: true,
    audio: "muted",
    container: { color: "blue", label: "Personal" },
    crashed: true,
    pictureInPicture: true,
    sharing: "microphone",
    title: "Example",
  });
  assert.equal(
    getTabAccessibleName(candidate, 0, 2),
    "Example, 1 of 2, Crashed, Muted, Using microphone, Attention, Picture in picture, Personal",
  );
  assert.equal(getTabAudioAction(candidate), "unmute");
  assert.equal(
    getTabActionAccessibleName("unmute", candidate),
    "Unmute Example",
  );
  assert.equal(getTabAudioAction(tab({ audio: "playing" })), "mute");
  assert.equal(getTabAudioAction(tab({ audio: "blocked" })), "resume-media");
  assert.equal(getTabAudioAction(tab()), null);
  assert.match(
    getTabAccessibleName(tab({ sharing: "camera" }), 0, 1),
    /Using camera/u,
  );
  assert.match(
    getTabAccessibleName(tab({ sharing: "screen" }), 0, 1),
    /Sharing screen/u,
  );
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
  assert.equal(findTabGroupMoveIndex(tabs, ["open-a", "open-b"], 1), null);
  assert.equal(
    findTabGroupMoveIndex(
      [
        tab({ id: "open-a", multiselected: true }),
        tab({ id: "open-b", multiselected: true }),
        tab({ id: "open-c" }),
      ],
      ["open-a", "open-b"],
      1,
    ),
    1,
  );
  assert.equal(
    findTabGroupMoveIndex(
      [
        tab({ id: "open-a" }),
        tab({ id: "open-b", multiselected: true }),
        tab({ id: "open-c", multiselected: true }),
      ],
      ["open-b", "open-c"],
      -1,
    ),
    0,
  );
  assert.equal(
    countMultiSelectedTabs([
      tab({ id: "open-a", multiselected: true }),
      tab({ id: "open-b" }),
      tab({ id: "open-c", multiselected: true }),
    ]),
    2,
  );
  assert.equal(
    isTabInDragGroup(
      [
        tab({ id: "open-a", multiselected: true }),
        tab({ id: "open-b", multiselected: true }),
      ],
      "open-a",
      "open-b",
    ),
    true,
  );
  assert.equal(
    isCollapsedDragMember(
      [
        tab({ id: "open-a", multiselected: true }),
        tab({ id: "open-b", multiselected: true }),
      ],
      "open-a",
      "open-b",
    ),
    true,
  );
  assert.equal(
    isCollapsedDragMember(
      [
        tab({ id: "open-a", multiselected: true }),
        tab({ id: "open-b", multiselected: true }),
      ],
      "open-a",
      "open-a",
    ),
    false,
  );
  assert.equal(
    resolveTabPointerAction(
      { altKey: false, ctrlKey: true, metaKey: false, shiftKey: false },
      tab(),
    ),
    "toggle-multi",
  );
  assert.equal(
    resolveTabPointerAction(
      { altKey: false, ctrlKey: false, metaKey: false, shiftKey: true },
      tab(),
    ),
    "range",
  );
  assert.equal(
    resolveTabPointerAction(
      { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
      tab({ multiselected: true, selected: false }),
    ),
    "activate-keep-multi",
  );
  assert.equal(
    resolveTabPointerAction(
      {
        altKey: false,
        ctrlKey: false,
        getModifierState: (key) => key === "Accel",
        metaKey: false,
        shiftKey: false,
      },
      tab(),
    ),
    "toggle-multi",
  );
  assert.equal(hasAccelModifier({ ctrlKey: false, metaKey: true }), true);
  assert.equal(resolveTabDropIndex(tabs, "open-b", [10, 30, 50, 70], 20), 2);
  assert.equal(resolveTabDropIndex(tabs, "open-b", [10, 30, 50, 70], 80), null);
  assert.equal(
    resolveTabDropIndex(tabs, "open-b", [10, Number.NaN, 50, 70], 20),
    null,
  );
  assert.equal(resolveTabDropIndex(tabs, "pinned-a", [10, 30, 50, 70], 80), 1);
  assert.equal(
    resolveTabDropIndex(
      [
        tab({ id: "open-a", multiselected: true, selected: true }),
        tab({ id: "open-b", multiselected: true }),
        tab({ id: "open-c", multiselected: true }),
        tab({ id: "open-d" }),
      ],
      "open-a",
      [20, 0, 0, 64],
      50,
    ),
    2,
  );
  assert.equal(
    resolveTabDragShift(
      [
        tab({ id: "open-a", multiselected: true, selected: true }),
        tab({ id: "open-b", multiselected: true }),
        tab({ id: "open-c" }),
      ],
      "open-a",
      2,
      1,
    ),
    null,
  );
  assert.deepEqual(
    resolveTabDropPreview(
      [
        tab({ id: "open-a", multiselected: true, selected: true }),
        tab({ id: "open-b", multiselected: true }),
        tab({ id: "open-c" }),
      ],
      "open-a",
      1,
    ),
    { index: 2, position: "before" },
  );
  assert.deepEqual(resolveTabDropPreview(tabs, "open-b", 2), {
    index: 2,
    position: "before",
  });
  assert.deepEqual(resolveTabDropPreview(tabs, "pinned-a", 1), {
    index: 1,
    position: "after",
  });
  assert.equal(resolveTabDragShift(tabs, "open-b", 2, 2), "down");
  assert.equal(resolveTabDragShift(tabs, "open-b", 2, 3), null);
  assert.equal(resolveTabDragShift(tabs, "pinned-a", 1, 1), "up");
  assert.equal(resolveTabDragShift(tabs, "pinned-a", 1, 2), null);
  assert.equal(resolveTabDragShift(tabs, "open-a", 2, 3), null);
  assert.equal(resolveTabDragShift(tabs, "missing", 1, 0), null);
  assert.equal(resolveTabDragShift(tabs, "open-b", 8, 2), null);
  assert.equal(resolveTabDragShift(tabs, "open-b", 2, -1), null);
  assert.equal(resolveTabDropPreview(tabs, "open-a", 2), null);
  assert.equal(resolveTabDropPreview(tabs, "missing", 1), null);
  assert.equal(
    resolveExternalTabDropIndex(tabs, [10, 30, 50, 70], 20, false),
    2,
  );
  assert.equal(
    resolveExternalTabDropIndex(tabs, [10, 30, 50, 70], 60, false),
    3,
  );
  assert.equal(
    resolveExternalTabDropIndex(tabs, [10, 30, 50, 70], 80, true),
    2,
  );
  assert.equal(resolveExternalTabDropIndex([], [], 20, false), 0);
  assert.equal(resolveExternalTabDropIndex(tabs, [10], 20, false), null);
  assert.equal(resolveExternalTabDragShift(tabs, 2, 2), "down");
  assert.equal(resolveExternalTabDragShift(tabs, 2, 1), null);
  assert.equal(resolveExternalTabDragShift(tabs, 4, 3), null);
  assert.equal(resolveExternalTabDragShift(tabs, 8, 1), null);
});

test("source drag cleanup distinguishes adoption from an in-window reorder", () => {
  const reorderedTabs = [tab({ id: "tab-2" }), tab({ id: "tab-1" })];

  assert.equal(isDraggedTabMissing(reorderedTabs, null), false);
  assert.equal(isDraggedTabMissing(reorderedTabs, "tab-1"), false);
  assert.equal(isDraggedTabMissing(reorderedTabs, "transferred-tab"), true);
});

test("drop pointer normalization expands both list edges without changing the middle", () => {
  assert.equal(normalizeTabDropPointerY(80, 100, 300), 100);
  assert.equal(normalizeTabDropPointerY(125, 100, 300), 100);
  assert.equal(normalizeTabDropPointerY(140, 100, 300), 140);
  assert.equal(normalizeTabDropPointerY(275, 100, 300), 300);
  assert.equal(normalizeTabDropPointerY(320, 100, 300), 300);

  assert.equal(normalizeTabDropPointerY(119, 100, 140), 100);
  assert.equal(normalizeTabDropPointerY(121, 100, 140), 140);
  assert.equal(normalizeTabDropPointerY(Number.NaN, 100, 300), null);
  assert.equal(
    normalizeTabDropPointerY(120, Number.NEGATIVE_INFINITY, 300),
    null,
  );
  assert.equal(
    normalizeTabDropPointerY(120, 100, Number.POSITIVE_INFINITY),
    null,
  );
  assert.equal(normalizeTabDropPointerY(120, 100, 100), null);
  assert.equal(normalizeTabDropPointerY(120, 200, 100), null);
});

test("dragged tab translation follows the pointer and clamps to its partition", () => {
  assert.equal(resolveDraggedTabTranslateY(100, 145, 15, 60, 220), 30);
  assert.equal(resolveDraggedTabTranslateY(100, 10, 15, 60, 220), -40);
  assert.equal(resolveDraggedTabTranslateY(100, 400, 15, 60, 220), 120);
  assert.equal(resolveDraggedTabTranslateY(100, Number.NaN, 15, 60, 220), null);
  assert.equal(resolveDraggedTabTranslateY(100, 145, -1, 60, 220), null);
  assert.equal(resolveDraggedTabTranslateY(100, 145, 15, 220, 60), null);
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
  assert.equal(newTabHighlightDurationMs, 500);
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
  assert.match(source, /aria-multiselectable="true"/u);
  assert.match(
    tabSource,
    /aria-orientation=\{props\.orientation === "row" \? "horizontal" : "vertical"\}/u,
  );
  assert.match(
    tabSource,
    /let pinnedTabEntries = \$derived\([\s\S]*?filter\(\(\{ tab \}\) => tab\.pinned\)/u,
  );
  assert.match(
    tabSource,
    /let regularTabEntries = \$derived\([\s\S]*?filter\(\(\{ tab \}\) => !tab\.pinned\)/u,
  );
  assert.match(
    tabSource,
    /\{#if pinnedTabEntries\.length > 0 \|\| externalDrag\?\.pinned === true\}[\s\S]*?data-fennevia-tab-pinned-section=""[\s\S]*?role="group"/u,
  );
  assert.match(
    tabSource,
    /aria-label=\{t\("tab\.pinnedCount", \{[\s\S]*?count: pinnedTabEntries\.length/u,
  );
  assert.match(
    tabSource,
    /data-fennevia-tab-partition="pinned"[\s\S]*?\{#each pinnedTabEntries as entry \(entry\.tab\.id\)\}/u,
  );
  assert.match(
    tabSource,
    /data-fennevia-tab-partition-divider=""[\s\S]*?data-fennevia-tab-partition="regular"[\s\S]*?\{#each regularTabEntries as entry \(entry\.tab\.id\)\}/u,
  );
  assert.match(source, /role="tab"/u);
  assert.match(
    source,
    /aria-selected=\{tab\.selected \|\| tab\.multiselected === true\}/u,
  );
  assert.match(source, /tabindex=\{rovingTabId === tab\.id \? 0 : -1\}/u);
  assert.match(source, /use:setFaviconSource=\{tab\.faviconUrl\}/u);
  assert.match(source, /node\.hidden = true;[\s\S]*?node\.src = nextSource/u);
  assert.match(source, /node\.onload = \(\) => \{\s*node\.hidden = false;/u);
  assert.match(source, /node\.src = nextSource/u);
  assert.match(source, /node\.onload = null/u);
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
  assert.match(
    topSource,
    /const handlePrimaryNavigationClick = \([\s\S]*?if \(event\.button !== 0\) \{\s*return;[\s\S]*?runNavigationAction\(action\);/u,
  );
  assert.match(
    topSource,
    /const blurActivatedControl = \([\s\S]*?target\.blur\(\);[\s\S]*?runNavigationAction\(action\);[\s\S]*?blurActivatedControl\(event\);/u,
  );
  assert.equal(
    topSource.match(/handlePrimaryNavigationClick\(event,/gu)?.length,
    4,
  );
  assert.match(source, /preventMiddleAutoscroll/u);
  assert.match(source, /navigation\.reload\(gesture\)/u);
  assert.match(
    source,
    /revealProgrammatically\(\s*props\.edge,\s*newTabHighlightDurationMs/u,
  );
  assert.match(
    source,
    /data-fennevia-just-opened=\{highlightedTabIds\.includes\(tab\.id\)\}/u,
  );
  assert.match(
    source,
    /"ltr",\s*props\.orientation === "row" \? "horizontal" : "vertical"/u,
  );
  assert.match(source, /handleTabAuxClick/u);
  assert.match(
    tabSource,
    /const restorePointerInteractionAfterMutation = async \([\s\S]*?releaseIfOutside = true,[\s\S]*?await tick\(\);[\s\S]*?isPointInsideElement\([\s\S]*?setPointerHeld\(props\.edge, true\);[\s\S]*?releasePointer\(props\.edge, "inside-window"\);[\s\S]*?blurOwnedSurfaceControl\(\);/u,
  );
  assert.match(tabSource, /pointerType === "touch"/u);
  assert.match(tabSource, /event\.button !== 0 && event\.button !== 1/u);
  assert.match(
    tabSource,
    /event\.detail === 0[\s\S]*?event\.clientX === 0[\s\S]*?event\.clientY === 0/u,
  );
  assert.equal(
    tabSource.match(
      /closeTab\([^\n]+, pointerInteractionFromMouseEvent\(event\)\)/gu,
    )?.length,
    2,
  );
  assert.match(tabSource, /handleTabClick\(event, tab\)/u);
  assert.match(tabSource, /handleTabPointerDown\(event, tab\)/u);
  assert.match(
    tabSource,
    /onpointerdown=\{\(event\) => handleTabPointerDown\(event, tab\)\}/u,
  );
  assert.match(tabSource, /resolveTabPointerAction/u);
  assert.match(tabSource, /findTabGroupMoveIndex/u);
  assert.match(
    tabSource,
    /data-fennevia-multiselected=\{tab\.multiselected === true\}/u,
  );
  assert.match(tabSource, /from "\.\.\/\.\.\/runtime\/pointer-geometry"/u);
  assert.match(
    tabSource,
    /restorePointerInteractionAfterMutation\(pointerInteraction, false\)/u,
  );
  assert.match(tabSource, /onclick=\{handleNewTabClick\}/u);
  assert.match(tabSource, /onauxclick=\{handleNewTabAuxClick\}/u);
  assert.match(
    tabSource,
    /data-fennevia-action="new-tab"[\s\S]*?onmousedown=\{preventMiddleAutoscroll\}/u,
  );
  assert.match(
    tabSource,
    /const handleNewTabClick = \([\s\S]*?if \(event\.button !== 0\) \{\s*return;[\s\S]*?event\.ctrlKey \|\| event\.metaKey[\s\S]*?relatedToCurrent[\s\S]*?selected: !\(relatedToCurrent && event\.shiftKey\)/u,
  );
  assert.match(
    tabSource,
    /const handleNewTabAuxClick = \([\s\S]*?if \(event\.button !== 1\) \{\s*return;[\s\S]*?relatedToCurrent: true[\s\S]*?selected: !event\.shiftKey/u,
  );
  assert.match(
    tabSource,
    /const openTab = \([\s\S]*?if \(pointerInteraction\) \{\s*props\.shell\.setPointerHeld\(props\.edge, true\);[\s\S]*?props\.tabs\.open\([\s\S]*?options\.relatedToCurrent === true[\s\S]*?relatedToCurrent: true/u,
  );
  assert.match(
    tabSource,
    /const selectTab = \([\s\S]*?if \(pointerInteraction\) \{\s*props\.shell\.setPointerHeld\(props\.edge, true\);[\s\S]*?props\.tabs\.select\(tabId\);/u,
  );
  assert.match(
    tabSource,
    /const closeTab = \([\s\S]*?if \(pointerInteraction\) \{\s*props\.shell\.setPointerHeld\(props\.edge, true\);[\s\S]*?props\.tabs\.close\(tabId\);/u,
  );
  assert.match(
    tabSource,
    /if \(pointerInteraction\) \{[\s\S]*?restorePointerInteractionAfterMutation\(pointerInteraction\)[\s\S]*?\} else \{[\s\S]*?restoreFocusAfterClose/u,
  );
  assert.match(source, /openContextMenu/u);
  assert.match(source, /draggable="true"/u);
  assert.match(source, /data-fennevia-action="toggle-mute"/u);
  assert.match(source, /data-fennevia-tab-status="crashed"/u);
  assert.match(source, /data-fennevia-tab-status=\{tab\.sharing\}/u);
  assert.match(source, /data-fennevia-tab-status="picture-in-picture"/u);
  assert.match(source, /<FirefoxIcon name="loading" \/>/u);
  assert.match(source, /<FirefoxIcon name="pin" \/>/u);
  assert.match(source, /<FirefoxIcon name="tab-close" \/>/u);
  assert.doesNotMatch(tabSource, /[□↻▭ø■♪◆◇×]/u);
  assert.match(
    source,
    /data-fennevia-container-color=\{tab\.container\?\.color\}/u,
  );
  assert.match(
    tabSource,
    /class="fennevia-tab-strip__container-bar"[\s\S]*?data-fennevia-container-bar=\{tab\.container\.color\}/u,
  );
  assert.match(
    styles,
    /data-fennevia-container-color="blue"[\s\S]*?--fennevia-tab-container-color: #37adff;/u,
  );
  assert.match(
    styles,
    /\.fennevia-tab-strip__container-bar \{[\s\S]*?inset-inline-start: 0;[\s\S]*?inline-size: 3px;[\s\S]*?background: var\(--fennevia-tab-container-color\);/u,
  );
  assert.match(
    styles,
    /forced-colors: active[\s\S]*?\.fennevia-tab-strip__container-bar[\s\S]*?background: Highlight;/u,
  );
  assert.doesNotMatch(
    styles,
    /data-fennevia-container-color(?:="[^"]+")?\][^}]*box-shadow:|data-fennevia-container-color\]::before/u,
  );
  assert.match(
    styles,
    /\.fennevia-tab-strip__favicon:not\(\[hidden\]\)\s*\+ \.fennevia-tab-strip__fallback \{\s*visibility: hidden;/u,
  );
  assert.match(
    tabSource,
    /class="fennevia-tab-strip__favicon"[\s\S]*?class="fennevia-tab-strip__fallback"/u,
  );
  assert.match(source, /findTabMoveIndex/u);
  assert.match(source, /findTabGroupMoveIndex/u);
  assert.match(source, /resolveTabDropIndex/u);
  assert.match(source, /resolveTabDropPreview/u);
  assert.match(
    tabSource,
    /normalizeTabDropPointerY\([\s\S]*?primaryBoundsStart\(bounds\),[\s\S]*?primaryBoundsEnd\(bounds\)/u,
  );
  assert.match(source, /transfer\.setDragImage/u);
  assert.match(tabSource, /transfer\.clearData\(\)/u);
  assert.match(tabSource, /transfer\.setData\(TAB_DRAG_MIME_TYPE, "1"\)/u);
  assert.doesNotMatch(tabSource, /setData\("text\/plain"|getData\(/u);
  assert.match(tabSource, /props\.tabs\.beginDrag/u);
  assert.match(tabSource, /props\.tabs\.inspectDrag/u);
  assert.match(tabSource, /props\.tabs\.dropDrag/u);
  assert.match(tabSource, /props\.tabs\.endDrag/u);
  assert.match(
    tabSource,
    /if \(targetIndex === null\)[\s\S]*?drag\.source === "same-window"[\s\S]*?endSourceDrag\(undefined, true\)/u,
  );
  assert.match(
    tabSource,
    /closest<HTMLElement>\(\s*"\[data-fennevia-tab-item\]"/u,
  );
  assert.match(tabSource, /event\.clientX - bounds\.left/u);
  assert.match(tabSource, /event\.clientY - bounds\.top/u);
  assert.match(tabSource, /dragGeometry\.itemMids/u);
  assert.match(tabSource, /dragGeometry\.itemHeights/u);
  assert.match(tabSource, /dragGeometry\.itemTops/u);
  assert.match(
    tabSource,
    /dragGeometry\.pinnedScrollTop -[\s\S]*?primaryScrollPosition\([\s\S]*?pinnedTabListElement/u,
  );
  assert.match(
    tabSource,
    /dragGeometry\.regularScrollTop -[\s\S]*?primaryScrollPosition\([\s\S]*?regularTabListElement/u,
  );
  assert.match(
    tabSource,
    /primaryPointerCoordinate[\s\S]*?props\.orientation === "row" \? event\.clientX : event\.clientY/u,
  );
  assert.match(
    tabSource,
    /primaryScrollPosition[\s\S]*?element\.scrollLeft[\s\S]*?element\.scrollTop/u,
  );
  assert.match(
    tabSource,
    /partitionBounds\(drag\.pinned\) \?\? list\.getBoundingClientRect\(\)/u,
  );
  assert.match(
    tabSource,
    /drag\.pinned \? pinnedTabEntries\.length : currentTabs\.tabs\.length/u,
  );
  assert.match(
    tabSource,
    /const deferEmptyPinnedPartitionPreview = \([\s\S]*?pinnedTabEntries\.length > 0[\s\S]*?tick\(\)\.then\(\(\) => \{[\s\S]*?clearDragGeometry\(\);[\s\S]*?captureDragGeometry\(list, drag\.id\)[\s\S]*?updateDropPreview\(list, drag, 0\)/u,
  );
  assert.match(
    tabSource,
    /function clearTabDrag\(retainPointer = false\) \{\s*pendingPinnedPartitionDragId = null;/u,
  );
  assert.match(tabSource, /const geometryMatches/u);
  assert.match(source, /aria-keyshortcuts=/u);
  assert.match(source, /aria-live="polite"/u);
  assert.match(source, /data-fennevia-drag-active/u);
  assert.match(source, /data-fennevia-drag-following/u);
  assert.match(source, /data-fennevia-drag-collapsed/u);
  assert.match(source, /data-fennevia-drag-stack/u);
  assert.match(tabSource, /tab\.id === draggingTabId/u);
  assert.match(source, /data-fennevia-drag-shift/u);
  assert.match(
    tabSource,
    /data-fennevia-drag-shift=\{externalDrag[\s\S]*?tab\.pinned === externalDrag\.pinned[\s\S]*?resolveExternalTabDragShift/u,
  );
  assert.match(source, /resolveDraggedTabTranslateY/u);
  assert.match(source, /style:transform/u);
  assert.match(source, /resolveTabDragShift/u);
  assert.match(source, /resolveExternalTabDragShift/u);
  assert.match(source, /resolveExternalTabDropIndex/u);
  assert.match(source, /data-fennevia-drop-preview/u);
  assert.match(
    tabSource,
    /\{#if externalDrag\?\.pinned === true && dragTargetIndex !== null\}[\s\S]*?data-fennevia-external-drop-slot="pinned"[\s\S]*?\{\/if\}/u,
  );
  assert.match(
    tabSource,
    /\{#if externalDrag\?\.pinned === false && dragTargetIndex !== null\}[\s\S]*?data-fennevia-external-drop-slot="regular"[\s\S]*?\{\/if\}/u,
  );
  assert.match(
    tabSource,
    /\{#if externalDrag && externalPreviewTransform\}[\s\S]*?class="fennevia-tab-strip__external-preview"[\s\S]*?data-fennevia-external-preview=""[\s\S]*?style:transform=\{externalPreviewTransform\}[\s\S]*?<FirefoxIcon name="tab" \/>[\s\S]*?t\("tab\.dragPreview"\)[\s\S]*?\{\/if\}/u,
  );
  assert.match(source, /ondragleave=\{handleTabListDragLeave\}/u);
  assert.match(source, /clearTabDrag\(\)/u);
  assert.match(
    tabSource,
    /function clearTabDrag\(retainPointer = false\) \{[\s\S]*?if \(retainPointer\) \{[\s\S]*?dragHoldActive = false;[\s\S]*?setPointerHeld\(props\.edge, true\);[\s\S]*?setDragHold\(false\);[\s\S]*?blurOwnedSurfaceControl\(\);/u,
  );
  assert.match(
    tabSource,
    /const finishOwnedTabDrag = \(\) => \{[\s\S]*?clearTabDrag\(true\);[\s\S]*?tick\(\)\.then\(\(\) => \{[\s\S]*?setPointerHeld\(props\.edge, true\);/u,
  );
  assert.match(
    tabSource,
    /const endSourceDrag = \([\s\S]*?if \(!dragId\) \{\s*return;[\s\S]*?finally \{\s*finishOwnedTabDrag\(\);/u,
  );
  assert.match(
    tabSource,
    /const result = props\.tabs\.dropDrag\(targetIndex\);[\s\S]*?finishOwnedTabDrag\(\);[\s\S]*?announceTabMove/u,
  );
  assert.match(
    tabSource,
    /setDragHold\(true\);\s*blurOwnedSurfaceControl\(\);/u,
  );
  assert.match(
    tabSource,
    /const setDragHold = \(active: boolean\) => \{[\s\S]*?if \(active\) \{[\s\S]*?dragHoldActive = true;[\s\S]*?setPointerHeld\(props\.edge, true\);/u,
  );
  assert.match(
    tabSource,
    /const updateTabDropAtPointer = \(event: DragEvent, list: HTMLElement\) => \{[\s\S]*?setDragHold\(true\);[\s\S]*?holdExternalDrag\(drag\);/u,
  );
  assert.match(source, /data-fennevia-tab-drop-zone=""/u);
  assert.match(source, /ondragover=\{handleTabDropZoneDragOver\}/u);
  assert.match(source, /ondrop=\{handleTabDropZoneDrop\}/u);
  assert.match(
    tabSource,
    /reportAsyncError\(\s*tick\(\)\.then\(\(\) => \{[\s\S]*?captureDragGeometry/u,
  );
  assert.doesNotMatch(tabSource, /void tick\(\)\.then/u);
  assert.match(
    tabSource,
    /props\.tabs\.subscribe[\s\S]*?sourceDragId !== null[\s\S]*?isDraggedTabMissing\(nextState\.tabs, draggingTabId\)[\s\S]*?if \(sourceTabLeftWindow\) \{\s*clearTabDrag\(\);\s*reportAsyncError\(tick\(\)\.then\(releaseSurfaceFocus\)\);/u,
  );
  assert.match(source, /use:manageTabDragWindow/u);
  assert.match(source, /holdExternalDrag\(drag\)/u);
  assert.match(source, /const previewExternalDragAtEnd/u);
  assert.match(
    tabSource,
    /handleWindowDragEnter[\s\S]*?!isInsideProjectFrame\(event\)[\s\S]*?previewExternalDragAtEnd\(drag\)/u,
  );
  assert.match(
    tabSource,
    /handleWindowDragOver[\s\S]*?isInsideProjectFrame\(event\)[\s\S]*?isInsideTabDropZone\(event\)[\s\S]*?setDragHold\(true\)[\s\S]*?clearDropTarget\(\)[\s\S]*?previewExternalDragAtEnd\(drag\)/u,
  );
  assert.match(
    tabSource,
    /handleWindowDragLeave = \(event: DragEvent\)[\s\S]*?event\.relatedTarget !== null[\s\S]*?clearTabDrag\(\)/u,
  );
  assert.doesNotMatch(source, /targetWindowDragDepth/u);
  assert.match(source, /view\.addEventListener\("dragenter"[^]*true\)/u);
  assert.match(source, /view\.removeEventListener\("dragenter"[^]*true\)/u);
  assert.match(source, /view\.addEventListener\("dragleave"[^]*true\)/u);
  assert.match(source, /view\.removeEventListener\("dragleave"[^]*true\)/u);
  assert.match(source, /dataTransfer[\s\S]*mozUserCancelled/u);
  assert.match(source, /view\.addEventListener\("dragend"[^]*true\)/u);
  assert.match(source, /view\.removeEventListener\("dragend"[^]*true\)/u);
  assert.match(source, /#fennevia-shell-frame-host/u);
  assert.match(source, /class="fennevia-tab-strip__drop-indicator"/u);
  assert.match(source, /style:inset-block-start/u);
  assert.match(source, /style:inset-inline-start/u);
  assert.match(source, /"translateX" : "translateY"/u);
  assert.match(
    styles,
    /data-fennevia-drag-shift="up"[\s\S]*?translateY\(\s*calc\(-100% - var\(--fennevia-space-1\)\)/u,
  );
  assert.match(
    styles,
    /data-fennevia-drag-shift="down"[\s\S]*?translateY\(\s*calc\(100% \+ var\(--fennevia-space-1\)\)/u,
  );
  assert.match(
    styles,
    /\.fennevia-tab-strip--horizontal[\s\S]*?data-fennevia-drag-shift="up"[\s\S]*?translateX\(calc\(-100% - var\(--fennevia-space-1\)\)\)/u,
  );
  assert.match(
    styles,
    /\.fennevia-tab-strip__external-drop-slot \{[\s\S]*?flex: none;[\s\S]*?block-size: 38px;[\s\S]*?visibility: hidden;[\s\S]*?pointer-events: none;/u,
  );
  assert.match(
    styles,
    /\.fennevia-tab-strip__external-preview \{[\s\S]*?position: absolute;[\s\S]*?block-size: 38px;[\s\S]*?pointer-events: none;[\s\S]*?transition: transform var\(--fennevia-motion-duration\)/u,
  );
  assert.match(
    styles,
    /data-fennevia-drag-collapsed="true"[\s\S]*?display: none;/u,
  );
  assert.match(styles, /data-fennevia-drag-stack="true"[\s\S]*?box-shadow:/u);
  assert.match(styles, /\.fennevia-tab-strip__tab \{[\s\S]*?cursor: default;/u);
  assert.doesNotMatch(
    styles,
    /\.fennevia-tab-strip[^{}]*\{[^{}]*cursor: (?:grab|grabbing);/u,
  );
  assert.match(
    styles,
    /\.fennevia-tab-strip__item \{[\s\S]*?transition:[\s\S]*?opacity 100ms ease-out/u,
  );
  assert.match(
    styles,
    /data-fennevia-drag-active="true"[\s\S]*?fennevia-tab-strip__item:not\(\[data-fennevia-drag-following="true"\]\)[\s\S]*?transition:[\s\S]*?transform var\(--fennevia-motion-duration\)/u,
  );
  assert.match(
    styles,
    /data-fennevia-dragging="true"[\s\S]*?border-style: dashed;[\s\S]*?opacity: 0\.16;[\s\S]*?pointer-events: none;/u,
  );
  assert.match(
    styles,
    /data-fennevia-dragging="true"\]\[data-fennevia-drag-following="true"\][\s\S]*?z-index: 2;[\s\S]*?border-style: solid;[\s\S]*?opacity: 0\.94;[\s\S]*?transition:[\s\S]*?opacity 100ms ease-out/u,
  );
  assert.match(styles, /\.fennevia-tab-strip__drop-indicator/u);
  assert.match(styles, /\.fennevia-tab-strip__announcement/u);
  assert.match(
    styles,
    /forced-colors: active[\s\S]*?\.fennevia-tab-strip__drop-indicator[\s\S]*?background: Highlight;/u,
  );
  assert.match(
    styles,
    /prefers-reduced-motion: reduce[\s\S]*?\.fennevia-tab-strip__external-preview[\s\S]*?transition-duration: 1ms;/u,
  );
  assert.match(
    styles,
    /forced-colors: active[\s\S]*?\.fennevia-tab-strip__external-preview[\s\S]*?background: Highlight;/u,
  );
  assert.match(
    styles,
    /\.fennevia-tab-strip__item \{[\s\S]*?grid-template-areas: "tab pin close";[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 30px 30px;/u,
  );
  assert.match(
    styles,
    /\.fennevia-tab-strip__item\[data-fennevia-audio\] \{[\s\S]*?grid-template-areas: "tab audio pin close";[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 30px 30px 30px;/u,
  );
  assert.match(
    styles,
    /\[data-fennevia-action="toggle-mute"\] \{\s*grid-area: audio;/u,
  );
  assert.match(
    styles,
    /\[data-fennevia-action="unpin-tab"\][\s\S]*?\) \{\s*grid-area: pin;/u,
  );
  assert.match(
    styles,
    /\[data-fennevia-action="close-tab"\] \{\s*grid-area: close;/u,
  );
  assert.doesNotMatch(styles, /fennevia-tab-loading/u);
  assert.match(
    styles,
    /\.fennevia-tab-strip__status:is\([\s\S]*?data-fennevia-tab-status="microphone"[\s\S]*?color: var\(--fennevia-danger-color\);/u,
  );
  assert.match(styles, /@media \(forced-colors: active\)/u);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(styles, /@media \(prefers-reduced-transparency: reduce\)/u);
  assert.match(styles, /unicode-bidi: plaintext/u);
  assert.match(
    styles,
    /\.fennevia-tab-strip__list \{[^}]*flex: 0 1 auto;[^}]*overflow: hidden;/u,
  );
  assert.match(
    styles,
    /\.fennevia-tab-strip__pinned-section \{[\s\S]*?max-block-size: min\(34vh, 190px\);[\s\S]*?overflow: hidden;/u,
  );
  assert.match(
    styles,
    /\.fennevia-tab-strip__partition \{[\s\S]*?overflow-y: auto;[\s\S]*?scrollbar-gutter: stable;/u,
  );
  assert.match(
    styles,
    /\.fennevia-tab-strip__partition--regular \{\s*flex: 1 1 auto;/u,
  );
  assert.match(
    styles,
    /forced-colors: active[\s\S]*?\.fennevia-tab-strip__pinned-section[\s\S]*?background: Canvas;[\s\S]*?\.fennevia-tab-strip__pinned-count[\s\S]*?background: Highlight;/u,
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
      "fennevia-tab-opened 500ms var(--fennevia-motion-easing) both",
      "fennevia-layout-preview-inline var(--fennevia-motion-duration) var(--fennevia-motion-easing)",
      "fennevia-layout-preview-block var(--fennevia-motion-duration) var(--fennevia-motion-easing)",
      "none",
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

  const itemBody = tabSource.match(
    /\{#snippet renderTab\(tab: TabSnapshot, index: number\)\}[\s\S]*?\{\/snippet\}/u,
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
