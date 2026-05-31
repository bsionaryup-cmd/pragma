"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import type { OrganizationPaymentMethod } from "@/lib/payments/organization-payment-methods-types";
import { saveOrganizationPaymentMethods } from "@/services/payments/organization-payment-methods.service";

const methodSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  type: z.enum(["payment_link", "cash", "bank_transfer", "other"]),
  label: z.string().max(80).optional(),
  account_holder: z.string().max(80).optional(),
});

const saveSchema = z.object({
  methods: z.array(methodSchema),
});

export async function getPaymentMethodsSettingsAction() {
  await requirePermission("finance:write");
  const { getOrganizationPaymentMethods } = await import(
    "@/services/payments/organization-payment-methods.service"
  );
  const methods = await getOrganizationPaymentMethods();
  return { success: true as const, methods };
}

export async function savePaymentMethodsSettingsAction(raw: {
  methods: OrganizationPaymentMethod[];
}) {
  await requirePermission("finance:write");
  const parsed = saveSchema.parse(raw);

  try {
    const methods = await saveOrganizationPaymentMethods(parsed.methods);
    revalidatePath("/settings");
    revalidatePath("/reservations");
    return { success: true as const, methods };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "No se pudo guardar",
    };
  }
}
