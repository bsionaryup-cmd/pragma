import { PriceLabsLoadError } from "@/features/integrations/pricelabs/components/pricelabs-load-error";
import { PriceLabsPanel } from "@/features/integrations/pricelabs/components/pricelabs-panel";
import { requirePermission } from "@/lib/auth";
import { isPriceLabsSchemaDriftError } from "@/services/integrations/pricelabs/pricelabs-prisma-guard";
import { getPriceLabsOverview } from "@/services/integrations/pricelabs.service";

export default async function PriceLabsIntegrationPage() {
  const user = await requirePermission("integrations:read");
  const canManage = user.role === "ADMIN";

  try {
    const overview = await getPriceLabsOverview(canManage);
    return <PriceLabsPanel overview={overview} />;
  } catch (error) {
    const message = isPriceLabsSchemaDriftError(error)
      ? error instanceof Error
        ? error.message
        : "Esquema PriceLabs desincronizado"
      : error instanceof Error
        ? error.message
        : "No se pudo cargar la integración PriceLabs";

    return <PriceLabsLoadError message={message} />;
  }
}
