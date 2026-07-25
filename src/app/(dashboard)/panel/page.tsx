import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { getServerLocale } from "@/i18n/locale.server";
import { dashboardMetadata } from "@/lib/seo";
import { getOperationsCenterSnapshot } from "@/services/dashboard/operations-center.compose";
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
  const locale = await getServerLocale();
  const auth = await requirePermission("dashboard:read");
  const canReadFinance = hasPermission(auth.role, "finance:read");
  const canReadAccess = hasPermission(auth.role, "access:read");

  let snapshot;
  let novedades;
  try {
    [snapshot, novedades] = await Promise.all([
      getOperationsCenterSnapshot({
        locale,
        canReadFinance,
        canReadAccess,
      }),
      Promise.resolve(getActiveSystemAnnouncements(locale)),
    ]);
  } catch (error) {
    const err = error as { message?: string; code?: string; meta?: unknown; stack?: string };
    console.error("[panel] snapshot failed", {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
    });
    // Temporary diagnostic surface for login-restore root-cause (remove after fix).
    return (
      <div className="mx-auto max-w-2xl p-6 text-sm">
        <h1 className="text-lg font-semibold">Panel diagnostic</h1>
        <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded border p-3 text-xs">
          {JSON.stringify(
            {
              message: err?.message ?? String(error),
              code: err?.code ?? null,
              meta: err?.meta ?? null,
            },
            null,
            2,
          )}
        </pre>
      </div>
    );
  }

  const canCreateProperties = hasPermission(auth.role, "properties:write");

  return (
    <CommandCenterView
      firstName={auth.firstName}
      snapshot={snapshot}
      showEmptyBanner={snapshot.commandCenter.totalPropertyCount === 0}
      canCreateProperties={canCreateProperties}
      novedades={novedades}
    />
  );
}
