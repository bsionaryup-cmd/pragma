import { redirect } from "next/navigation";
import { MobilityAlliesView } from "@/components/qr-mobility/mobility-allies-view";
import { QrMobilitySectionShell } from "@/components/qr-mobility/qr-mobility-section-shell";
import { serializeMobilityAllyForClient } from "@/features/qr-mobility/types/ally";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { listMobilityAllies } from "@/modules/qr-mobility/services/mobility-ally.service";

export const dynamic = "force-dynamic";

type QrMobilityAliadosPageProps = {
  searchParams: Promise<{ inactive?: string }>;
};

export default async function QrMobilityAliadosPage({ searchParams }: QrMobilityAliadosPageProps) {
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
  const allies = await listMobilityAllies({ includeInactive });

  return (
    <QrMobilitySectionShell activeSection="aliados" sectionTitle="Aliados">
      <MobilityAlliesView
        initialAllies={allies.map(serializeMobilityAllyForClient)}
        includeInactive={includeInactive}
      />
    </QrMobilitySectionShell>
  );
}
