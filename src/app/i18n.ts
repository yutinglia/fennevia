import { defaultFenneviaLocale, type FenneviaLocale } from "./locale-state.ts";
import { en } from "./messages/en.ts";
import { zhHant } from "./messages/zh-Hant.ts";

export type MessageKey = keyof typeof en;
export type MessageCatalog = { readonly [K in MessageKey]: string };
export type MessageVars = Readonly<Record<string, number | string>>;

const catalogs: Readonly<Record<FenneviaLocale, MessageCatalog>> =
  Object.freeze({
    en,
    "zh-Hant": zhHant,
  });

export function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) {
    return template;
  }
  return template.replace(
    /\{([A-Za-z][A-Za-z0-9]*)\}/gu,
    (match, name: string) => {
      const value = vars[name];
      return value === undefined ? match : String(value);
    },
  );
}

export function translate(
  locale: FenneviaLocale,
  key: MessageKey,
  vars?: MessageVars,
): string {
  const catalog = catalogs[locale] ?? catalogs[defaultFenneviaLocale];
  const template = catalog[key] ?? catalogs[defaultFenneviaLocale][key] ?? key;
  return interpolate(template, vars);
}

export function listMessageKeys(): readonly MessageKey[] {
  return Object.freeze(Object.keys(en) as MessageKey[]);
}

export function getCatalog(locale: FenneviaLocale): MessageCatalog {
  return catalogs[locale] ?? catalogs[defaultFenneviaLocale];
}

export function countLabel(
  locale: FenneviaLocale,
  count: number,
  overflow: boolean,
  oneKey: MessageKey,
  otherKey: MessageKey,
): string {
  const display = `${count}${overflow && count === 999 ? "+" : ""}`;
  return translate(locale, count === 1 ? oneKey : otherKey, { count: display });
}
