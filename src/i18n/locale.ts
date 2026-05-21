import type { Locale } from "@/i18n/types";

export const LOCALE_STORAGE_KEY = "pragma-locale";

const SUPPORTED: Locale[] = ["es", "en"];

export function isLocale(value: string | undefined): value is Locale {
  return value === "es" || value === "en";
}

export function resolveLocale(cookieValue: string | undefined): Locale {
  return isLocale(cookieValue) ? cookieValue : "es";
}

export { SUPPORTED };
