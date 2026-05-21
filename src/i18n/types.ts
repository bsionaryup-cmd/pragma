import type { es } from "@/i18n/dictionaries/es";

export type Locale = "es" | "en";

type Stringify<T> = T extends string
  ? string
  : T extends object
    ? { [K in keyof T]: Stringify<T[K]> }
    : string;

export type Dictionary = Stringify<typeof es>;

export type TranslationParams = Record<string, string | number>;
