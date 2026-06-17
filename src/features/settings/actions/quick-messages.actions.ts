"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import {
  quickMessageTemplatesToFormFields,
} from "@/lib/reservations/quick-message-templates";
import {
  getOrganizationQuickMessageSettings,
  saveOrganizationQuickMessageSettings,
  type QuickMessageSettingsForm,
} from "@/services/settings/organization-quick-messages.service";

const saveSchema = z.object({
  quickMessageWELCOME: z.string().optional(),
  quickMessageREGISTRATION: z.string().optional(),
  quickMessageACCESS: z.string().optional(),
  quickMessageFOLLOW_UP: z.string().optional(),
  quickMessageHOUSE_RULES: z.string().optional(),
  quickMessageCHECKOUT: z.string().optional(),
  quickMessageREVIEW: z.string().optional(),
});

export async function getQuickMessagesSettingsAction() {
  await requirePermission("properties:write");
  const fields = await getOrganizationQuickMessageSettings();
  return { success: true as const, fields };
}

export async function saveQuickMessagesSettingsAction(
  raw: z.infer<typeof saveSchema>,
) {
  await requirePermission("properties:write");
  const parsed = saveSchema.parse(raw);

  try {
    const fields = await saveOrganizationQuickMessageSettings({
      ...quickMessageTemplatesToFormFields({}),
      ...parsed,
    } as QuickMessageSettingsForm);
    revalidatePath("/settings");
    revalidatePath("/reservations");
    revalidatePath("/novedades");
    revalidatePath("/calendar");
    return { success: true as const, fields };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "No se pudo guardar",
    };
  }
}
