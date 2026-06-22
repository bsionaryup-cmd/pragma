import Link from "next/link";
import { cn } from "@/lib/utils";

export type SalesConsoleSectionId =
  | "quotes"
  | "prospects"
  | "pipeline"
  | "research"
  | "campaigns"
  | "analytics";

const VISIBLE_SECTIONS: { id: SalesConsoleSectionId; label: string; href: string }[] = [
  { id: "quotes", label: "Cotizaciones", href: "/owner-dashboard/sales" },
  { id: "prospects", label: "Prospectos", href: "/owner-dashboard/sales/prospects" },
  { id: "pipeline", label: "Pipeline", href: "/owner-dashboard/sales/pipeline" },
];

type SalesConsoleSectionShellProps = {
  activeSection: SalesConsoleSectionId;
  sectionTitle: string;
  children: React.ReactNode;
};

export function SalesConsoleSectionShell({
  activeSection,
  sectionTitle,
  children,
}: SalesConsoleSectionShellProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-pragma-electric">
          Operaciones PRAGMA
        </p>
        <h1 className="font-heading mt-1 text-2xl font-semibold">Consola de ventas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cotizaciones SaaS · separado de Payment Links de huéspedes
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href="/owner-dashboard" className="text-pragma-electric hover:underline">
            ← Panel de propietario
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href="/owner-dashboard/support"
            className="text-muted-foreground hover:text-foreground"
          >
            Centro de soporte
          </Link>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {VISIBLE_SECTIONS.map((section) => {
          const isActive = section.id === activeSection;
          return (
            <Link
              key={section.id}
              href={section.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-pragma-electric/15 text-pragma-electric"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {section.label}
            </Link>
          );
        })}
      </nav>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">{sectionTitle}</h2>
        {children}
      </div>
    </div>
  );
}
