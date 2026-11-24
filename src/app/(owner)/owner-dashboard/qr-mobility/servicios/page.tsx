import { redirect } from "next/navigation";
import { MobilityServicesView } from "@/components/qr-mobility/mobility-services-view";
import { QrMobilitySectionShell } from "@/components/qr-mobility/qr-mobility-section-shell";
import { serializeMobilityServiceForClient } from "@/features/qr-mobility/types/service";
import {
  PlatformOwnerForbiddenError,
  PlatformOwnerUnauthorizedError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { OWNER_LOGIN_PATH } from "@/lib/platform/constants";
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
    if (error instanceof PlatformOwnerUnauthorizedError) {
      redirect(OWNER_LOGIN_PATH);
    }
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
