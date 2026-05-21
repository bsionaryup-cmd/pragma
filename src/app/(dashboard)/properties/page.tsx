import { ModuleShellFill } from "@/components/layout/module-shell";
import { PropertiesHub } from "@/features/properties/components/properties-hub";
import { hasPermission, requirePermission } from "@/lib/auth";
import { listPropertiesForGrid } from "@/services/properties/property.service";
import type { AppUserRole } from "@/types/auth";

type PropertiesPageProps = {
  searchParams: Promise<{ create?: string; property?: string }>;
};

export default async function PropertiesPage({
  searchParams,
}: PropertiesPageProps) {
  const auth = await requirePermission("properties:read");
  const params = await searchParams;
  const canWrite = hasPermission(auth.role as AppUserRole, "properties:write");

  const properties = await listPropertiesForGrid(auth.dbUserId);

  const propertyId = params.property ?? null;
  const validPropertyId =
    propertyId && properties.some((p) => p.id === propertyId)
      ? propertyId
      : null;

  return (
    <ModuleShellFill>
      <PropertiesHub
        initialProperties={properties}
        canWrite={canWrite}
        openCreateOnMount={params.create === "true" && canWrite}
        initialPropertyId={validPropertyId}
      />
    </ModuleShellFill>
  );
}
