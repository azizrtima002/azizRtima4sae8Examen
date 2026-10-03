import "server-only";
import { cookies } from "next/headers";
import type { Locale } from "../taxonomy";
import { DEFAULT_LOCALE, getDictionary, isLocale, LOCALE_COOKIE } from ".";

export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getI18n() {
  const locale = getLocale();
  return { locale, t: getDictionary(locale) };
}
