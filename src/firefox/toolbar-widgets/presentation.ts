// SPDX-License-Identifier: MPL-2.0
import { type CustomizeSpecialKind } from "../customize-model.ts";
import {
  LABEL_MAX_LENGTH,
  BADGE_MAX_LENGTH,
  ICON_URL_MAX_LENGTH,
  QUOTED_CSS_URL_PATTERN,
  SINGLE_QUOTED_CSS_URL_PATTERN,
  UNQUOTED_CSS_URL_PATTERN,
  MOZ_EXTENSION_URL_PREFIX,
  CHROME_URL_PREFIX,
  RESOURCE_URL_PREFIX,
  FORBIDDEN_ICON_URL_CHARACTER_PATTERN,
  WIDGET_ID_SELECTOR_PATTERN,
  FLUENT_RESOURCE_ID_MAX_LENGTH,
  FLUENT_RESOURCE_ID_LIMIT,
  FLUENT_RESOURCE_ID_PATTERN,
  LOCALIZATION_KEY_PATTERN,
  INCOMPLETE_BUNDLE_FORMAT_PATTERN,
  TOOLBAR_FLUENT_RESOURCE_IDS,
  isNativeRecord,
  isFunction,
  isNativeNode,
  boundString,
  readColor,
} from "./native-support.ts";
import type { NativeRecord, NativeNode } from "./native-support.ts";

export const readSpecialKind = (
  widgetId: string,
): CustomizeSpecialKind | null => {
  if (widgetId.startsWith("customizableui-special-")) {
    const match = /^customizableui-special-(spring|spacer|separator)/u.exec(
      widgetId,
    );
    return match ? (match[1] as CustomizeSpecialKind) : null;
  }
  if (
    widgetId === "spring" ||
    widgetId === "spacer" ||
    widgetId === "separator"
  ) {
    return widgetId;
  }
  return widgetId === "vertical-spacer" ? "spacer" : null;
};

export const readRecordString = (
  record: NativeRecord | null,
  key: string,
): string => {
  if (!record) {
    return "";
  }
  try {
    const value = record[key];
    return typeof value === "string" ? value : "";
  } catch {
    // Lazy wrapper getters (e.g. l10n-backed labels) may throw.
    return "";
  }
};

export const getDocumentElementById = (
  window: NativeRecord,
  id: string,
): unknown => {
  const document = window.document;
  if (!isNativeRecord(document) || !isFunction(document.getElementById)) {
    return undefined;
  }
  return Reflect.apply(document.getElementById, document, [id]);
};

export const querySelectorOn = (
  node: NativeRecord,
  selector: string,
): unknown => {
  if (!isFunction(node.querySelector)) {
    return undefined;
  }
  try {
    return Reflect.apply(node.querySelector, node, [selector]);
  } catch {
    return undefined;
  }
};

export const readAttribute = (node: NativeNode, name: string): string => {
  try {
    const value = Reflect.apply(node.getAttribute, node, [name]);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
};

export const extractCssUrl = (value: string): string => {
  if (value === "" || value === "none") {
    return "";
  }
  const quoted = QUOTED_CSS_URL_PATTERN.exec(value);
  if (quoted) {
    return quoted[1].replace(/\\(.)/gu, "$1");
  }
  const singleQuoted = SINGLE_QUOTED_CSS_URL_PATTERN.exec(value);
  if (singleQuoted) {
    return singleQuoted[1].replace(/\\(.)/gu, "$1");
  }
  const unquoted = UNQUOTED_CSS_URL_PATTERN.exec(value);
  return unquoted ? unquoted[1].replace(/\\(.)/gu, "$1") : "";
};

export const isAllowedPresentationIconUrl = (
  url: string,
  kind: "builtin" | "extension",
): boolean => {
  if (
    url === "" ||
    url.length > ICON_URL_MAX_LENGTH ||
    FORBIDDEN_ICON_URL_CHARACTER_PATTERN.test(url)
  ) {
    return false;
  }
  if (kind === "extension") {
    return url.startsWith(MOZ_EXTENSION_URL_PREFIX);
  }
  return (
    url.startsWith(CHROME_URL_PREFIX) || url.startsWith(RESOURCE_URL_PREFIX)
  );
};

export const readFirstCollectionNode = (
  collection: unknown,
): NativeNode | null => {
  if (isNativeNode(collection)) {
    return collection;
  }
  if (Array.isArray(collection)) {
    const first = collection[0];
    return isNativeNode(first) ? first : null;
  }
  if (!isNativeRecord(collection)) {
    return null;
  }
  const indexed = collection[0];
  if (isNativeNode(indexed)) {
    return indexed;
  }
  if (isFunction(collection.item)) {
    try {
      const item = Reflect.apply(collection.item, collection, [0]);
      return isNativeNode(item) ? item : null;
    } catch {
      return null;
    }
  }
  return null;
};

export const readStyleListStyleImage = (style: unknown): string => {
  if (!isNativeRecord(style)) {
    return "";
  }
  try {
    const direct = style.listStyleImage;
    if (typeof direct === "string" && direct !== "") {
      const url = extractCssUrl(direct);
      if (url) {
        return url;
      }
    }
  } catch {
    // Computed style getters may throw for disconnected nodes.
  }
  if (isFunction(style.getPropertyValue)) {
    try {
      const value = Reflect.apply(style.getPropertyValue, style, [
        "list-style-image",
      ]);
      if (typeof value === "string") {
        return extractCssUrl(value);
      }
    } catch {
      return "";
    }
  }
  return "";
};

export const readCssRuleListStyleImage = (rule: NativeRecord): string => {
  try {
    const style = rule.style;
    const fromStyle = readStyleListStyleImage(style);
    if (fromStyle) {
      return fromStyle;
    }
  } catch {
    // Some CSSRule types have no style object.
  }
  return "";
};

export const readSelectorWidgetIds = (selectorText: unknown): string[] => {
  if (typeof selectorText !== "string" || selectorText === "") {
    return [];
  }
  const ids: string[] = [];
  WIDGET_ID_SELECTOR_PATTERN.lastIndex = 0;
  for (const match of selectorText.matchAll(WIDGET_ID_SELECTOR_PATTERN)) {
    const widgetId = match[1];
    if (widgetId) {
      ids.push(widgetId);
    }
  }
  return ids;
};

export const collectBuiltinIconUrlsFromRule = (
  rule: unknown,
  sink: Map<string, string>,
  inheritedIds: readonly string[] = [],
): void => {
  if (!isNativeRecord(rule)) {
    return;
  }
  let selectorText: unknown;
  try {
    selectorText = rule.selectorText;
  } catch {
    selectorText = undefined;
  }
  const selectorIds = readSelectorWidgetIds(selectorText);
  const widgetIds = selectorIds.length > 0 ? selectorIds : inheritedIds;
  const url = readCssRuleListStyleImage(rule);
  if (url && isAllowedPresentationIconUrl(url, "builtin")) {
    for (const widgetId of widgetIds) {
      sink.set(widgetId, url);
    }
  }
  let nested: unknown;
  try {
    nested = rule.cssRules;
  } catch {
    nested = undefined;
  }
  if (isNativeRecord(nested) && typeof nested.length === "number") {
    const length = nested.length;
    for (let index = 0; index < length; index += 1) {
      collectBuiltinIconUrlsFromRule(nested[index], sink, widgetIds);
    }
  }
};

export const readIndexedEntry = (
  collection: unknown,
  index: number,
): unknown => {
  if (Array.isArray(collection)) {
    return collection[index];
  }
  if (!isNativeRecord(collection)) {
    return undefined;
  }
  return collection[index];
};

export const readFluentAttribute = (
  attributes: unknown,
  name: string,
): string => {
  if (Array.isArray(attributes)) {
    for (const item of attributes) {
      if (
        isNativeRecord(item) &&
        item.name === name &&
        typeof item.value === "string"
      ) {
        return item.value;
      }
    }
    return "";
  }
  if (!isNativeRecord(attributes)) {
    return "";
  }
  if (typeof attributes.length === "number" && attributes.length > 0) {
    const length = attributes.length;
    for (let index = 0; index < length; index += 1) {
      const item = attributes[index];
      if (
        isNativeRecord(item) &&
        item.name === name &&
        typeof item.value === "string"
      ) {
        return item.value;
      }
    }
  }
  const direct = attributes[name];
  return typeof direct === "string" ? direct : "";
};

export const readFluentMessageText = (
  messages: unknown,
  l10nId: string,
): string => {
  const first = readIndexedEntry(messages, 0);
  if (!isNativeRecord(first)) {
    return "";
  }
  const fromAttributes =
    readFluentAttribute(first.attributes, "label") ||
    readFluentAttribute(first.attributes, "tooltiptext");
  const value = typeof first.value === "string" ? first.value : "";
  const text = fromAttributes || value;
  if (!text || text === l10nId) {
    return "";
  }
  return boundString(text, LABEL_MAX_LENGTH);
};

export const formatFluentFromLocalization = (
  l10n: NativeRecord,
  l10nId: string,
): string => {
  if (isFunction(l10n.formatMessagesSync)) {
    try {
      const messages = Reflect.apply(l10n.formatMessagesSync, l10n, [
        [{ id: l10nId }],
      ]);
      const fromMessage = readFluentMessageText(messages, l10nId);
      if (fromMessage) {
        return fromMessage;
      }
    } catch {
      // DocumentL10n throws after setAsync(); a dedicated sync instance
      // should not. Either way, try formatValueSync next.
    }
  }
  if (!isFunction(l10n.formatValueSync)) {
    return "";
  }
  try {
    const value = Reflect.apply(l10n.formatValueSync, l10n, [l10nId]);
    if (typeof value !== "string" || value === "" || value === l10nId) {
      return "";
    }
    return boundString(value, LABEL_MAX_LENGTH);
  } catch {
    return "";
  }
};

export const isAllowedFluentResourceId = (value: string): boolean =>
  value.length > 0 &&
  value.length <= FLUENT_RESOURCE_ID_MAX_LENGTH &&
  !value.includes("..") &&
  FLUENT_RESOURCE_ID_PATTERN.test(value);

export const collectFluentResourceIds = (document: NativeRecord): string[] => {
  const collected: string[] = [];
  const seen = new Set<string>();
  const add = (value: string): void => {
    const id = value.trim();
    if (
      seen.has(id) ||
      !isAllowedFluentResourceId(id) ||
      collected.length >= FLUENT_RESOURCE_ID_LIMIT
    ) {
      return;
    }
    seen.add(id);
    collected.push(id);
  };
  for (const id of TOOLBAR_FLUENT_RESOURCE_IDS) {
    add(id);
  }
  if (!isFunction(document.querySelectorAll)) {
    return collected;
  }
  try {
    const links = Reflect.apply(document.querySelectorAll, document, [
      'link[rel="localization"]',
    ]);
    const length = Array.isArray(links)
      ? links.length
      : isNativeRecord(links) && typeof links.length === "number"
        ? links.length
        : 0;
    for (let index = 0; index < length; index += 1) {
      const link = readIndexedEntry(links, index);
      if (!isNativeNode(link)) {
        continue;
      }
      add(readAttribute(link, "href"));
    }
  } catch {
    // Pinned resource ids remain enough for known toolbar widgets.
  }
  return collected;
};

export const isUntranslatedLocalizationKey = (
  value: string,
  widgetId = "",
): boolean => {
  if (widgetId && (value === widgetId || value.startsWith(`${widgetId}.`))) {
    return true;
  }
  return LOCALIZATION_KEY_PATTERN.test(value);
};

export const readPresentationText = (
  value: string,
  maxLength: number,
  widgetId = "",
): string => {
  if (
    !value ||
    isUntranslatedLocalizationKey(value, widgetId) ||
    INCOMPLETE_BUNDLE_FORMAT_PATTERN.test(value)
  ) {
    return "";
  }
  return boundString(value, maxLength);
};

export const isNodeConnected = (node: NativeRecord): boolean =>
  node.isConnected === true;

export const readExtensionActionButton = (
  node: NativeRecord,
): NativeNode | null => {
  const button = querySelectorOn(
    node,
    ".unified-extensions-item-action-button",
  );
  return isNativeNode(button) ? button : null;
};

export const readExtensionIconUrl = (actionButton: NativeNode): string => {
  let styleText = "";
  const style = actionButton.style;
  if (isNativeRecord(style) && isFunction(style.getPropertyValue)) {
    try {
      const value = Reflect.apply(style.getPropertyValue, style, [
        "--webextension-toolbar-image",
      ]);
      if (typeof value === "string") {
        styleText = value;
      }
    } catch {
      styleText = "";
    }
  }
  if (!styleText) {
    styleText = readAttribute(actionButton, "style");
  }
  const url = extractCssUrl(styleText);
  return isAllowedPresentationIconUrl(url, "extension") ? url : "";
};

export const readExtensionBadge = (
  actionButton: NativeNode,
): Readonly<{ background: string; text: string; textColor: string }> => {
  const text = boundString(
    readAttribute(actionButton, "badge"),
    BADGE_MAX_LENGTH,
  );
  let background = "";
  let textColor = "";
  const badgeStyle = readAttribute(actionButton, "badgeStyle");
  const backgroundMatch = /background-color:\s*([^;]{1,64})/u.exec(badgeStyle);
  if (backgroundMatch) {
    background = readColor(backgroundMatch[1]);
  }
  const colorMatch = /(?:^|;)\s*color:\s*([^;]{1,64})/u.exec(badgeStyle);
  if (colorMatch) {
    textColor = readColor(colorMatch[1]);
  }
  return Object.freeze({ background, text, textColor });
};

export const readExtensionLabel = (node: NativeRecord): string => {
  const nameLabel = querySelectorOn(node, ".unified-extensions-item-name");
  if (isNativeRecord(nameLabel) && typeof nameLabel.textContent === "string") {
    const text = nameLabel.textContent.trim();
    if (text) {
      return boundString(text, LABEL_MAX_LENGTH);
    }
  }
  return "";
};

export const readNodeDisabled = (node: NativeNode): boolean =>
  node.disabled === true || readAttribute(node, "disabled") === "true";
