import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getServerLocale } from "@/i18n/locale.server";
import { dashboardMetadata } from "@/lib/seo";
import { getCommandCenterData } from "@/services/dashboard/command-center.service";
import { getActiveSystemAnnouncements } from "@/lib/system-announcements";
import { getEffectiveOrganizationIdForUser } from "@/lib/platform/tenant-context";
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
  const auth = await requirePermission("dashboard:read");
  const organizationId = await getEffectiveOrganizationIdForUser(auth.dbUserId);
  const propertyScope = organizationId
    ? { organizationId }
    : { ownerId: auth.dbUserId };

  const [data, propertyCount] = await Promise.all([
    getCommandCenterData(locale),
    db.property.count({ where: propertyScope }),
  ]);
  const novedades = getActiveSystemAnnouncements(locale);

  const canCreateProperties = hasPermission(auth.role, "properties:write");
  return (
    <CommandCenterView
      firstName={auth.firstName}
      data={data}
      showEmptyBanner={propertyCount === 0}
      canCreateProperties={canCreateProperties}
      novedades={novedades}
    />
  );
}
