import type { Metadata } from "next";
import { CommandCenterView } from "@/components/dashboard/command-center-view";
import { hasPermission, requireDbUser } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";
import { getServerLocale } from "@/i18n/locale.server";
import { dashboardMetadata } from "@/lib/seo";
import { getCommandCenterData } from "@/services/dashboard/command-center.service";
import { db } from "@/lib/db";

export const metadata: Metadata = dashboardMetadata;

export default async function PanelControlPage() {
  const user = await requireDbUser();
  const locale = await getServerLocale();
  const canCreateProperties = hasPermission(
    user.role as AppUserRole,
    "properties:write",
  );

  const [data, propertyCount] = await Promise.all([
    getCommandCenterData(locale),
    db.property.count(),
  ]);

  return (
    <CommandCenterView
      firstName={user.firstName}
      data={data}
      showEmptyBanner={propertyCount === 0}
      canCreateProperties={canCreateProperties}
    />
  );
}
