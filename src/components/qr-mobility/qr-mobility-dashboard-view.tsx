import Link from "next/link";
import { Car, QrCode, Users, Wrench } from "lucide-react";
import type { MobilityDashboardStats } from "@/modules/qr-mobility/services/mobility-dashboard.service";
import { KpiCard } from "@/components/ui/kpi-card";

type QrMobilityDashboardViewProps = {
  stats: MobilityDashboardStats;
};

export function QrMobilityDashboardView({ stats }: QrMobilityDashboardViewProps) {
  return (
    <div className="mt-6 space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Aliados"
          value={String(stats.totalAllies)}
          detail="Aliados activos registrados"
          icon={Users}
        />
        <KpiCard
          label="Total Servicios"
          value={String(stats.totalServices)}
          detail="Servicios de movilidad configurados"
          icon={Wrench}
        />
        <KpiCard
          label="Total QR"
          value={String(stats.totalQr)}
          detail="Códigos QR generados para aliados"
          icon={QrCode}
        />
        <KpiCard
          label="Total Reservas"
          value={String(stats.totalReservations)}
          detail="Placeholder — Fase 1"
          icon={Car}
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-pragma-soft">
        <h3 className="font-heading text-base font-semibold">Accesos rápidos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestiona aliados y servicios de movilidad desde el Owner Dashboard.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/owner-dashboard/qr-mobility/aliados"
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-pragma-electric/40 hover:text-pragma-electric"
          >
            Gestionar aliados
          </Link>
          <Link
            href="/owner-dashboard/qr-mobility/servicios"
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-pragma-electric/40 hover:text-pragma-electric"
          >
            Gestionar servicios
          </Link>
        </div>
      </section>
    </div>
  );
}
