import Link from "next/link";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { requireDbUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/get-dictionary";
import { getServerLocale } from "@/i18n/locale.server";
import { createTranslator } from "@/i18n/translate";
import { getSecondaryRouteLinksForRole } from "@/lib/navigation";
import type { AppUserRole } from "@/types/auth";

export default async function SettingsPage() {
  const user = await requireDbUser();
  const role = user.role as AppUserRole;
  const locale = await getServerLocale();
  const dictionary = await getDictionary(locale);
  const t = createTranslator(dictionary);
  const secondaryLinks = getSecondaryRouteLinksForRole(role);

  return (
    <ModuleShellFlow className="bg-background">
    <main className="flex w-full flex-col items-center justify-center gap-6 p-8 pb-16 text-center">
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {t("settings.title")}
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t("settings.comingSoon")}
        </p>
      </div>

      {secondaryLinks.length > 0 ? (
        <nav
          className="flex flex-wrap justify-center gap-3"
          aria-label={t("settings.managementNav")}
        >
          {secondaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>
      ) : null}
    </main>
    </ModuleShellFlow>
  );
}
