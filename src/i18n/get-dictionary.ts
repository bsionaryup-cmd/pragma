import type { Dictionary, Locale } from "@/i18n/types";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  es: () => import("@/i18n/dictionaries/es").then((m) => m.es),
  en: () => import("@/i18n/dictionaries/en").then((m) => m.en),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
