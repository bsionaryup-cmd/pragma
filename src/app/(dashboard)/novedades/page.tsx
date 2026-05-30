import type { Metadata } from "next";
import { NovedadesFeed } from "@/features/novedades/components/novedades-feed";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { listReservationEventsForTenant } from "@/services/reservation-events/reservation-events-list.service";

export const metadata: Metadata = {
  title: "Novedades",
  robots: { index: false, follow: false },
};

export default async function NovedadesPage() {
  await requirePermission("reservations:read");
  const rows = await listReservationEventsForTenant();

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 pb-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Observabilidad"
          title="Novedades"
          description="Eventos informativos detectados en correos Airbnb (automático vía Resend o reenvío). Solo lectura — no modifican reservas, calendario ni disponibilidad."
        />
        <NovedadesFeed rows={rows} />
      </div>
    </ModuleShellFlow>
  );
}
