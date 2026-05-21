"use client";

import { useI18n } from "@/components/providers/i18n-provider";
import type { Locale } from "@/i18n/types";
import { cn } from "@/lib/utils";

const options: Locale[] = ["es", "en"];

export function LanguageSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setLocale(locale === "es" ? "en" : "es")}
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold uppercase text-pragma-mid-gray transition-colors hover:bg-pragma-light-blue hover:text-pragma-electric"
        title={t("language.label")}
        aria-label={t("language.label")}
      >
        {locale}
      </button>
    );
  }

  return (
    <div className="px-1">
      <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-pragma-mid-gray">
        {t("language.label")}
      </p>
      <div className="flex gap-1 rounded-xl border border-sidebar-border bg-pragma-soft-gray/80 p-1">
        {options.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            className={cn(
              "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
              locale === code
                ? "bg-white text-pragma-electric shadow-pragma-soft"
                : "text-pragma-mid-gray hover:text-pragma-black",
            )}
          >
            {t(code === "es" ? "language.es" : "language.en")}
          </button>
        ))}
      </div>
    </div>
  );
}
