import { redirect } from "next/navigation";
import { MobilityServicesView } from "@/components/qr-mobility/mobility-services-view";
import { QrMobilitySectionShell } from "@/components/qr-mobility/qr-mobility-section-shell";
import { serializeMobilityServiceForClient } from "@/features/qr-mobility/types/service";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { listMobilityServices } from "@/modules/qr-mobility/services/mobility-service.service";

export const dynamic = "force-dynamic";

type QrMobilityServiciosPageProps = {
  searchParams: Promise<{ inactive?: string }>;
};

export default async function QrMobilityServiciosPage({
  searchParams,
}: QrMobilityServiciosPageProps) {
  try {
    await requirePlatformOwnerUser();
  } catch (error) {
    if (error instanceof PlatformOwnerForbiddenError) {
      redirect("/unauthorized");
    }
    throw error;
  }

  const params = await searchParams;
  const includeInactive = params.inactive === "1";
  const services = await listMobilityServices({ includeInactive });

  return (
    <QrMobilitySectionShell activeSection="servicios" sectionTitle="Servicios">
      <MobilityServicesView
        initialServices={services.map(serializeMobilityServiceForClient)}
        includeInactive={includeInactive}
      />
    </QrMobilitySectionShell>
  );
}
