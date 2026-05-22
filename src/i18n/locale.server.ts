import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { LOCALE_STORAGE_KEY, resolveLocale } from "@/i18n/locale";
import type { Locale } from "@/i18n/types";

export const getServerLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_STORAGE_KEY)?.value);
});
