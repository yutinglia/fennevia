// SPDX-License-Identifier: MPL-2.0
import type { FenneviaLocale } from "../app/locale-state.ts";
import type { UrlbarSuggestionResultSource } from "../app/urlbar-suggestions-state.ts";
import { translate, type MessageKey } from "../app/i18n.ts";

const sourceMessageKeys: Readonly<
  Record<UrlbarSuggestionResultSource, MessageKey>
> = Object.freeze({
  actions: "suggestions.source.actions",
  addon: "suggestions.source.addon",
  bookmarks: "suggestions.source.bookmarks",
  history: "suggestions.source.history",
  "other-local": "suggestions.source.other-local",
  "other-network": "suggestions.source.other-network",
  search: "suggestions.source.search",
  tabs: "suggestions.source.tabs",
  unknown: "suggestions.source.unknown",
});

export const getUrlbarSuggestionSourceLabel = (
  source: UrlbarSuggestionResultSource,
  locale: FenneviaLocale,
): string => translate(locale, sourceMessageKeys[source]);
