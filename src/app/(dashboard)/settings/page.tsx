import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { getSecondaryRouteLinksForRole } from "@/lib/navigation";
import type { AppUserRole } from "@/types/auth";

export default async function SettingsPage() {
  const user = await requireDbUser();
  const role = user.role as AppUserRole;
  const secondaryLinks = getSecondaryRouteLinksForRole(role);

  return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ajustes</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Este módulo se conectará próximamente.
          </p>
        </div>

        {secondaryLinks.length > 0 ? (
          <nav
            className="flex flex-wrap justify-center gap-3"
            aria-label="Accesos de gestión"
          >
            {secondaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {link.title}
              </Link>
            ))}
          </nav>
        ) : null}
      </main>
  );
}
