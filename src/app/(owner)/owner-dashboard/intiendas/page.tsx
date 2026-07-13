import { redirect } from "next/navigation";
import { RetailAdminDashboardView } from "@/components/retail-admin/retail-admin-dashboard-view";
import { RetailAdminSectionShell } from "@/components/retail-admin/retail-admin-section-shell";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { getRetailAdminDashboardStats } from "@/modules/retail-admin/services/retail-admin-dashboard.service";

export const dynamic = "force-dynamic";

export default async function RetailAdminDashboardPage() {
  try {
    await requirePlatformOwnerUser();
  } catch (error) {
    if (error instanceof PlatformOwnerForbiddenError) redirect("/unauthorized");
    throw error;
  }
  const stats = await getRetailAdminDashboardStats();
  return <RetailAdminSectionShell activeSection="dashboard" sectionTitle="Resumen"><RetailAdminDashboardView stats={stats} /></RetailAdminSectionShell>;
}
