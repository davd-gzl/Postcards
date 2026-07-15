// Tiny, zero-dependency i18n core. No libraries: just a typed message lookup
// with {param} interpolation and a safe fallback chain (active locale → English
// → the key itself). Formatting stays on the built-in Intl (see format.ts).
//
// The English catalog (en.ts) is the source of truth and defines the key set;
// fr.ts and ko.ts are typed as Messages so TypeScript enforces exact key parity
// at compile time (a missing or extra key fails the build).

import { en, type MessageKey, type Messages } from "./en";
import { fr } from "./fr";
import { ko } from "./ko";

export type { MessageKey, Messages };

/** The UI languages Postcards ships. English is the source-of-truth fallback. */
export type Locale = "en" | "fr" | "ko";
export const LOCALES: readonly Locale[] = ["en", "fr", "ko"] as const;

/** Native, self-describing label for each locale (shown in the switcher). */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ko: "한국어",
};

// Widen to plain string maps for lookup: a Messages value type is keyed by the
// exact MessageKey union, but translate() takes an arbitrary string so it can
// fall back safely on a key that isn't in the catalog.
const CATALOGS: Record<Locale, Record<string, string>> = { en, fr, ko };

export type TParams = Record<string, string | number>;

/** Replace `{name}` placeholders; an unknown placeholder is left verbatim. */
function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
  );
}

/**
 * Look up `key` in `locale`, falling back to English and then to the key text,
 * then interpolate `{param}` placeholders. Never throws and never returns
 * undefined — a missing translation degrades gracefully instead of blanking UI.
 */
export function translate(locale: Locale, key: string, params?: TParams): string {
  const fromLocale = CATALOGS[locale]?.[key];
  const template = fromLocale ?? en[key as MessageKey] ?? key;
  return interpolate(template, params);
}

/** True for a value that is one of the supported UI locales. */
export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "fr" || value === "ko";
}

/**
 * Best UI locale for a first run: honour the device languages when one is a
 * language we ship (fr/ko), otherwise English. Region subtags are ignored
 * ("fr-CA" → "fr"). Safe under non-DOM/test environments.
 */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const langs =
    navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
  for (const tag of langs) {
    const base = tag?.toLowerCase().split("-")[0];
    if (base === "fr" || base === "ko") return base;
  }
  return "en";
}

/**
 * Reflect the active locale onto <html lang> for assistive tech and correct
 * text handling — the language mirror of applyThemeAttr's data-theme. Guarded
 * so it's a no-op under SSR / jsdom-less environments.
 */
export function applyLangAttr(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}
