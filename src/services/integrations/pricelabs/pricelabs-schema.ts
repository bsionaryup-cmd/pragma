import { db } from "@/lib/db";
import { isOrganizationIntegrationSchemaReady } from "@/services/integrations/organization-integration.service";
import { isPriceLabsSchemaDriftError } from "@/services/integrations/pricelabs/pricelabs-prisma-guard";

/** Probes whether PriceLabs / org integration tables exist. */
export async function isPriceLabsSchemaReady(): Promise<boolean> {
  if (await isOrganizationIntegrationSchemaReady()) return true;
  try {
    await db.priceLabsIntegration.findFirst({ select: { id: true } });
    return true;
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return false;
    throw error;
  }
}

/** Probes property_pricelabs relation table. */
export async function isPropertyPriceLabsSchemaReady(): Promise<boolean> {
  try {
    await db.propertyPriceLabs.findFirst({
      select: { propertyId: true },
    });
    return true;
  } catch (error) {
    if (isPriceLabsSchemaDriftError(error)) return false;
    throw error;
  }
}
