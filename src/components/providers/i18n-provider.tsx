"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { LOCALE_STORAGE_KEY } from "@/i18n/locale";
import type { Locale } from "@/i18n/types";
import { createTranslator, type TranslationKey } from "@/i18n/translate";
import type { Dictionary, TranslationParams } from "@/i18n/types";

type I18nContextValue = {
  locale: Locale;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  children: ReactNode;
  locale: Locale;
  dictionary: Dictionary;
};

export function I18nProvider({ children, locale, dictionary }: I18nProviderProps) {
  const router = useRouter();
  const t = useMemo(() => createTranslator(dictionary), [dictionary]);

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_STORAGE_KEY}=${next};path=/;max-age=31536000;SameSite=Lax`;
      router.refresh();
    },
    [router],
  );

  const value = useMemo(
    () => ({ locale, t, setLocale }),
    [locale, t, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
