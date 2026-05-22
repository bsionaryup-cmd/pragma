import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { hasPermission, requireDbUser } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";
import { getServerLocale } from "@/i18n/locale.server";
import { dashboardMetadata } from "@/lib/seo";
import { getCommandCenterData } from "@/services/dashboard/command-center.service";
import { db } from "@/lib/db";

const CommandCenterView = dynamic(
  () =>
    import("@/components/dashboard/command-center-view").then((m) => ({
      default: m.CommandCenterView,
    })),
);

export const metadata: Metadata = dashboardMetadata;

export default async function PanelControlPage() {
  const locale = await getServerLocale();
  const [user, data, propertyCount] = await Promise.all([
    requireDbUser(),
    getCommandCenterData(locale),
    db.property.count(),
  ]);
  const canCreateProperties = hasPermission(
    user.role as AppUserRole,
    "properties:write",
  );
  const canViewFinancials = hasPermission(
    user.role as AppUserRole,
    "finance:revenue:read",
  );

  return (
    <CommandCenterView
      firstName={user.firstName}
      data={data}
      showEmptyBanner={propertyCount === 0}
      canCreateProperties={canCreateProperties}
      canViewFinancials={canViewFinancials}
    />
  );
}
