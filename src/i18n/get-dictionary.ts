import { cache } from "react";
import type { Dictionary, Locale } from "@/i18n/types";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  es: () => import("@/i18n/dictionaries/es").then((m) => m.es),
  en: () => import("@/i18n/dictionaries/en").then((m) => m.en),
};

export const getDictionary = cache(async (locale: Locale): Promise<Dictionary> => {
  return dictionaries[locale]();
});
