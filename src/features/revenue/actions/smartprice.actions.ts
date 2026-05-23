"use server";

import { revalidatePath } from "next/cache";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import { requirePermission } from "@/lib/auth";
import { savePropertyPriceBoundsFromPanel } from "@/services/integrations/pricelabs.service";

export async function savePropertyPriceBoundsAction(input: {
  propertyId: string;
  baseRate?: string;
  minRate?: string;
  maxRate?: string;
}) {
  await requirePermission("finance:write");
  await assertBillingUnlocked();

  try {
    const result = await savePropertyPriceBoundsFromPanel(input);
    revalidatePath("/revenue");
    revalidatePath("/calendar");
    return result;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudo guardar",
    };
  }
}
