import type { Locale } from "../../locale-context";
import type { SystemRule } from "./types";

export function dateLocale(locale: Locale) {
  return locale === "th" ? "th-TH" : locale === "ja" ? "ja-JP" : "en-GB";
}

export function formatWhen(iso: string | null, locale: Locale, empty: string) {
  if (!iso) return empty;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return empty;
  return date.toLocaleString(dateLocale(locale), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function statusName(rule: SystemRule, locale: Locale) {
  if (locale === "en") return rule.statusNameEn || rule.statusNameTh || rule.statusNameJa;
  if (locale === "ja") return rule.statusNameJa || rule.statusNameEn || rule.statusNameTh;
  return rule.statusNameTh || rule.statusNameEn || rule.statusNameJa;
}

export function maskUserId(value: string) {
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
