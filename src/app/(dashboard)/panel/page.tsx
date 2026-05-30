import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getServerLocale } from "@/i18n/locale.server";
import { dashboardMetadata } from "@/lib/seo";
import { getCommandCenterData } from "@/services/dashboard/command-center.service";
import { getActiveSystemAnnouncements } from "@/lib/system-announcements";
import PanelLoading from "./loading";

const CommandCenterView = dynamic(
  () =>
    import("@/components/dashboard/command-center-view").then((m) => ({
      default: m.CommandCenterView,
    })),
  { loading: () => <PanelLoading /> },
);

export const metadata: Metadata = dashboardMetadata;

export default async function PanelControlPage() {
  const localePromise = getServerLocale();
  const [locale, auth, data] = await Promise.all([
    localePromise,
    requirePermission("dashboard:read"),
    localePromise.then((resolvedLocale) => getCommandCenterData(resolvedLocale)),
  ]);
  const novedades = getActiveSystemAnnouncements(locale);

  const canCreateProperties = hasPermission(auth.role, "properties:write");
  return (
    <CommandCenterView
      firstName={auth.firstName}
      data={data}
      showEmptyBanner={data.totalPropertyCount === 0}
      canCreateProperties={canCreateProperties}
      novedades={novedades}
    />
  );
}
