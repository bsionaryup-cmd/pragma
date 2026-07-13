import Link from "next/link";
import { cn } from "@/lib/utils";

export type RetailAdminSection = "dashboard" | "usuarios";

const SECTIONS: Array<{ id: RetailAdminSection; label: string; href: string }> = [
  { id: "dashboard", label: "Dashboard", href: "/owner-dashboard/intiendas" },
  { id: "usuarios", label: "Usuarios", href: "/owner-dashboard/intiendas/usuarios" },
];

export function RetailAdminSectionShell({
  activeSection,
  sectionTitle,
  children,
}: {
  activeSection: RetailAdminSection;
  sectionTitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-pragma-electric">
          PRAGMA INTIENDAS
        </p>
        <h1 className="font-heading mt-1 text-2xl font-semibold">Administración de producto</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dashboard y gestión de usuarios del producto INTIENDAS.
        </p>
        <Link
          href="/owner-dashboard"
          className="mt-4 inline-block text-sm text-pragma-electric hover:underline"
        >
          ← Panel de propietario
        </Link>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.id}
            href={section.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              section.id === activeSection
                ? "bg-pragma-electric/15 text-pragma-electric"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <h2 className="font-heading text-lg font-semibold">{sectionTitle}</h2>
      {children}
    </div>
  );
}
