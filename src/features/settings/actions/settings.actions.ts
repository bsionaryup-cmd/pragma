"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isLocale } from "@/i18n/locale";

export async function saveUserPreferencesAction(input: {
  locale?: string;
  theme?: string;
}) {
  const user = await requireDbUser();
  const locale = input.locale && isLocale(input.locale) ? input.locale : undefined;
  const theme = input.theme?.trim();

  await db.user.update({
    where: { id: user.id },
    data: {
      ...(locale ? { locale } : {}),
      ...(theme && ["light", "dark", "system"].includes(theme) ? { theme } : {}),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function syncThemePreferenceAction(theme: string) {
  const user = await requireDbUser();
  if (!["light", "dark", "system"].includes(theme)) return;
  await db.user.update({
    where: { id: user.id },
    data: { theme },
  });
}
