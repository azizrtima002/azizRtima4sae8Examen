import type { Locale } from "../taxonomy";
import ar from "./ar";
import fr, { type Dictionary } from "./fr";

export type { Dictionary };
export const LOCALES: Locale[] = ["fr", "ar"];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "lang";

const dictionaries: Record<Locale, Dictionary> = { fr, ar };

export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];
export const isLocale = (value: unknown): value is Locale => value === "fr" || value === "ar";
export const directionOf = (locale: Locale) => (locale === "ar" ? "rtl" : "ltr");

/** Replace `{name}` placeholders: format("{count} offres", { count: 3 }). */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
