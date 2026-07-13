import Link from "next/link";
import { cn } from "@/lib/utils";

export type QrMobilitySectionId =
  | "dashboard"
  | "aliados"
  | "servicios"
  | "reservas"
  | "conductores"
  | "comisiones"
  | "configuracion";

const ACTIVE_SECTIONS: { id: QrMobilitySectionId; label: string; href: string }[] = [
  { id: "dashboard", label: "Dashboard", href: "/owner-dashboard/qr-mobility" },
  { id: "aliados", label: "Aliados", href: "/owner-dashboard/qr-mobility/aliados" },
  { id: "servicios", label: "Servicios", href: "/owner-dashboard/qr-mobility/servicios" },
];

const FUTURE_SECTIONS: { id: QrMobilitySectionId; label: string }[] = [
  { id: "reservas", label: "Reservas" },
  { id: "conductores", label: "Conductores" },
  { id: "comisiones", label: "Comisiones" },
  { id: "configuracion", label: "Configuración" },
];

type QrMobilitySectionShellProps = {
  activeSection: QrMobilitySectionId;
  sectionTitle: string;
  children: React.ReactNode;
};

export function QrMobilitySectionShell({
  activeSection,
  sectionTitle,
  children,
}: QrMobilitySectionShellProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-pragma-electric">
          PRAGMA Mobility
        </p>
        <h1 className="font-heading mt-1 text-2xl font-semibold">QR Mobility</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gestión de aliados, servicios y códigos QR — módulo aislado del PMS
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href="/owner-dashboard" className="text-pragma-electric hover:underline">
            ← Panel de propietario
          </Link>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {ACTIVE_SECTIONS.map((section) => {
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
        {FUTURE_SECTIONS.map((section) => (
          <span
            key={section.id}
            className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground/50"
            title="Disponible en fases futuras"
          >
            {section.label}
          </span>
        ))}
      </nav>

      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">{sectionTitle}</h2>
        {children}
      </div>
    </div>
  );
}
