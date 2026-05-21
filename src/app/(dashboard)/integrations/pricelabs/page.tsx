import { PriceLabsLoadError } from "@/features/integrations/pricelabs/components/pricelabs-load-error";
import { PriceLabsPanel } from "@/features/integrations/pricelabs/components/pricelabs-panel";
import { requirePermission } from "@/lib/auth";
import { isPriceLabsSchemaDriftError } from "@/services/integrations/pricelabs/pricelabs-prisma-guard";
import { getPriceLabsOverview } from "@/services/integrations/pricelabs.service";

export default async function PriceLabsIntegrationPage() {
  const user = await requirePermission("integrations:read");
  const canManage = user.role === "ADMIN";

  let overview: Awaited<ReturnType<typeof getPriceLabsOverview>> | null = null;
  let loadError: string | null = null;

  try {
    overview = await getPriceLabsOverview(canManage);
  } catch (error) {
    loadError = isPriceLabsSchemaDriftError(error)
      ? error instanceof Error
        ? error.message
        : "Esquema PriceLabs desincronizado"
      : error instanceof Error
        ? error.message
        : "No se pudo cargar la integración PriceLabs";
  }

  if (loadError) {
    return <PriceLabsLoadError message={loadError} />;
  }

  return <PriceLabsPanel overview={overview!} />;
}
