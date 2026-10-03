import type { Locale } from "./taxonomy";

const intlLocale = (locale: Locale) => (locale === "ar" ? "ar-TN" : "fr-FR");

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "il y a 3 heures" / "منذ 3 ساعات". */
export function relativeTime(date: Date | string, locale: Locale, now: Date = new Date()): string {
  const seconds = Math.round((new Date(date).getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, "minute");
}

export function formatDate(date: Date | string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(date),
  );
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** YYYY-MM-DD of a DATE column (stored at UTC midnight). */
export function toDateInput(date: Date | string | null | undefined): string {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}
