import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "..");
const readProjectFile = (relativePath) =>
  readFile(path.join(projectRoot, ...relativePath.split("/")), "utf8");

test("address popup exposes one complete keyboard and pointer combobox", async () => {
  const [component, health, styles] = await Promise.all([
    readProjectFile("src/shell/AddressPopup.svelte"),
    readProjectFile("src/shell/runtime/health.ts"),
    readProjectFile("src/shell/styles/address.css"),
  ]);

  assert.match(component, /role="combobox"/u);
  assert.match(component, /aria-autocomplete="list"/u);
  assert.match(component, /aria-activedescendant=\{activeSuggestionId\}/u);
  assert.match(component, /role="listbox"/u);
  assert.match(component, /role="option"/u);
  assert.match(component, /aria-selected=\{activeSuggestionIndex === index\}/u);
  for (const key of [
    "ArrowDown",
    "ArrowUp",
    "Home",
    "End",
    "PageDown",
    "PageUp",
    "Enter",
  ]) {
    assert.match(component, new RegExp(`event\\.key === "${key}"`, "u"));
  }
  assert.match(
    component,
    /!event\.altKey[\s\S]*!event\.ctrlKey[\s\S]*!event\.metaKey[\s\S]*!event\.shiftKey[\s\S]*event\.key === "ArrowDown"/u,
  );
  assert.match(component, /onclick=\{/u);
  assert.match(component, /onauxclick=\{/u);
  assert.match(component, /onpointermove=\{/u);
  assert.match(component, /aria-live="polite"/u);
  assert.equal(component.match(/aria-live="polite"/gu)?.length, 1);
  assert.match(
    component,
    /state\.snapshot\.queryRevision !== previousQueryRevision[\s\S]*Math\.min\(previousActiveIndex, state\.snapshot\.results\.length - 1\)/u,
  );
  assert.match(component, /option\.scrollIntoView\(\{ block: "nearest" \}\)/u);
  assert.match(
    health,
    /\[role="listbox"\]\[data-fennevia-urlbar-suggestions\]/u,
  );
  assert.match(styles, /max-block-size: clamp\(132px, 40vh, 320px\)/u);
});

test("suggestion rendering keeps private commands and markup out of the DOM", async () => {
  const [component, controller, support] = await Promise.all([
    readProjectFile("src/shell/AddressPopup.svelte"),
    readProjectFile("src/firefox/urlbar-suggestions/controller.ts"),
    readProjectFile("src/firefox/urlbar-suggestions/support.ts"),
  ]);

  assert.doesNotMatch(component, /\{@html\}|result\.payload|result\.url/u);
  assert.doesNotMatch(component, /data-[^=]*token|style:[^=]*=\{result/u);
  assert.match(component, /src=\{result\.icon\}/u);
  assert.match(component, /\{result\.title/u);
  assert.match(component, /\{result\.description\}/u);
  assert.doesNotMatch(controller, /fetch\(|XMLHttpRequest|SearchService/u);
  assert.doesNotMatch(support, /https?:\/\/.*suggest|JSON\.stringify\(result/u);
  assert.match(controller, /resultRegistry\.resolve\(token\)/u);
  assert.match(controller, /owners\.input\.pickResult/u);
  assert.match(controller, /owners\.manager\.startQuery/u);
  assert.match(controller, /candidate\.manager\.cancelQuery/u);
  assert.match(
    controller,
    /callbackResult = callback\(\)[\s\S]*owners\.input\.controller = owners\.nativeController[\s\S]*if \(restoreFailed\)/u,
  );
});

test("coordinator clears ordinary queries and preserves only explicit native handoff", async () => {
  const coordinator = await readProjectFile(
    "src/shell/runtime/address-popup-coordinator.ts",
  );

  assert.match(
    coordinator,
    /snapshot\.closeReason !== "native-handoff"[\s\S]*urlbarSuggestions\.cancel\(\)/u,
  );
  assert.match(
    coordinator,
    /urlbarSuggestions\.prepareNativeHandoff\(\)[\s\S]*requestClose\("native-handoff"\)[\s\S]*urlbarCoverage\.openNativeUrlbar\(\)/u,
  );
  assert.match(
    coordinator,
    /urlbarSuggestions\.query\(controller\.snapshot\(\)\.draftValue\)/u,
  );
});

test("address popup keeps search primary and Firefox handoffs compact", async () => {
  const [component, styles, responsiveStyles] = await Promise.all([
    readProjectFile("src/shell/AddressPopup.svelte"),
    readProjectFile("src/shell/styles/address.css"),
    readProjectFile("src/shell/styles/responsive-accessibility.css"),
  ]);

  const utilitiesIndex = component.indexOf(
    'class="fennevia-address-popup__utilities"',
  );
  const utilitiesEnd = component.indexOf("</section>", utilitiesIndex);
  const utilities = component.slice(utilitiesIndex, utilitiesEnd);
  const trustIndex = utilities.indexOf("data-fennevia-trust-detail");
  const permissionIndex = utilities.indexOf("data-fennevia-permission-detail");
  const nativeAccessIndex = utilities.indexOf(
    "data-fennevia-native-urlbar-access",
  );
  assert.ok(utilitiesIndex >= 0);
  assert.ok(utilitiesEnd > utilitiesIndex);
  assert.ok(trustIndex >= 0);
  assert.ok(permissionIndex > trustIndex);
  assert.ok(nativeAccessIndex > permissionIndex);
  assert.match(component, /fennevia-address-popup__identity/u);
  assert.match(component, /fennevia-address-popup__brand/u);
  assert.match(component, /fennevia-address-popup__private/u);
  assert.match(
    component,
    /class:fennevia-address-popup__status--visible=\{visuallyExposeStatus\}/u,
  );
  assert.match(component, /fennevia-address-popup__suggestion-source/u);
  assert.match(component, /fennevia-address-popup__suggestion-badge/u);
  assert.doesNotMatch(component, /fennevia-address-popup__enter|>↵</u);
  assert.doesNotMatch(
    component,
    /address\.nativeAccessDescription|fennevia-address-popup__firefox-controls-copy/u,
  );
  assert.doesNotMatch(
    component,
    /address\.noPageActions|fennevia-address-popup__urlbar-empty/u,
  );
  assert.doesNotMatch(
    component,
    /data-fennevia-urlbar-items|getUrlbarItemLabel|getUrlbarItemTone/u,
  );
  assert.doesNotMatch(styles, /fennevia-address-popup__urlbar-items/u);
  assert.match(
    styles,
    /\.fennevia-address-popup\s*\{[\s\S]*?inline-size: min\(640px, 100%\);[\s\S]*?gap: var\(--fennevia-space-2\);/u,
  );
  assert.match(
    styles,
    /\.fennevia-address-popup__label\s*\{[\s\S]*?clip-path: inset\(50%\);/u,
  );
  assert.match(
    styles,
    /\.fennevia-address-popup__field-shell\s*\{[\s\S]*?grid-template-columns: 22px minmax\(0, 1fr\);[\s\S]*?min-block-size: 46px;/u,
  );
  assert.match(
    styles,
    /\.fennevia-address-popup__status\s*\{[\s\S]*?clip-path: inset\(50%\);[\s\S]*?\.fennevia-address-popup__status--visible\s*\{[\s\S]*?clip-path: none;/u,
  );
  assert.match(
    styles,
    /\.fennevia-address-popup__utilities\s*\{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?border-block-start: 1px solid/u,
  );
  assert.match(
    styles,
    /\.fennevia-address-popup__utility\s*\{[\s\S]*?min-block-size: 40px;/u,
  );
  assert.match(
    styles,
    /\.fennevia-address-popup__suggestion-source\s*\{[\s\S]*?color: var\(--fennevia-glass-muted\);[\s\S]*?\.fennevia-address-popup__suggestion-badge\s*\{[\s\S]*?border: 1px solid/u,
  );
  assert.match(
    responsiveStyles,
    /@media \(max-width: 700px\)[\s\S]*?\.fennevia-address-popup__utilities\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?\.fennevia-address-popup__native-access\s*\{\s*grid-column: 1 \/ -1;/u,
  );
  assert.match(
    responsiveStyles,
    /@media \(max-width: 520px\)[\s\S]*?\.fennevia-address-popup__utilities\s*\{\s*grid-template-columns: 1fr;/u,
  );
});
