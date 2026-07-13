import { redirect } from "next/navigation";
import { QrMobilityDashboardView } from "@/components/qr-mobility/qr-mobility-dashboard-view";
import { QrMobilitySectionShell } from "@/components/qr-mobility/qr-mobility-section-shell";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { getMobilityDashboardStats } from "@/modules/qr-mobility/services/mobility-dashboard.service";

export const dynamic = "force-dynamic";

export default async function QrMobilityDashboardPage() {
  try {
    await requirePlatformOwnerUser();
  } catch (error) {
    if (error instanceof PlatformOwnerForbiddenError) {
      redirect("/unauthorized");
    }
    throw error;
  }

  const stats = await getMobilityDashboardStats();

  return (
    <QrMobilitySectionShell activeSection="dashboard" sectionTitle="Resumen">
      <QrMobilityDashboardView stats={stats} />
    </QrMobilitySectionShell>
  );
}
