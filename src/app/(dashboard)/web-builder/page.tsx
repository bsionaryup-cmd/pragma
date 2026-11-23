import dynamic from "next/dynamic";
import { ModuleShellFill } from "@/components/layout/module-shell";
import { hasPermission, requirePermission } from "@/lib/auth";
import { loadWebBuilderHubAction } from "@/features/web-builder/actions/web-builder.actions";
import type { AppUserRole } from "@/types/auth";
import { notFound } from "next/navigation";

const WebBuilderHub = dynamic(
  () =>
    import("@/features/web-builder/components/web-builder-hub").then((m) => ({
      default: m.WebBuilderHub,
    })),
  { loading: () => <div className="p-8 text-sm text-muted-foreground">Cargando…</div> },
);

export default async function WebBuilderPage() {
  const auth = await requirePermission("website:read");
  const result = await loadWebBuilderHubAction();

  if (!result.ok) {
    notFound();
  }

  const canManage = hasPermission(auth.role as AppUserRole, "website:manage");

  return (
    <ModuleShellFill>
      <WebBuilderHub
        initialSite={result.data.site}
        initialMedia={result.data.media}
        canManage={canManage}
      />
    </ModuleShellFill>
  );
}