import { db } from "@/lib/db";
import { isPriceLabsSchemaDriftError } from "@/services/integrations/pricelabs/pricelabs-prisma-guard";

/** Probes whether PriceLabs tables exist (no throw on missing schema). */
export async function isPriceLabsSchemaReady(): Promise<boolean> {
  try {
    await db.priceLabsIntegration.findFirst({
      select: { id: true },
    });
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
