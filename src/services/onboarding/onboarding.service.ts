import { db } from "@/lib/db";
import { isValidPhoneNumber } from "@/lib/phone/phone-number";
import { clampPropertyCount } from "@/modules/billing/domain/plan-catalog";
import { parseBillingAccountMetadata } from "@/modules/billing/domain/subscription-property-count";
import { ensureBillingAccount } from "@/services/billing/billing.service";

export type OnboardingProfileInput = {
  companyName: string;
  phone: string;
  propertyCount: number;
};

export function userNeedsOnboarding(
  user: { role: string; onboardingCompletedAt: Date | null },
): boolean {
  return user.role === "ADMIN" && !user.onboardingCompletedAt;
}

export async function completeOnboarding(
  userId: string,
  input: OnboardingProfileInput,
): Promise<{ ok: boolean; message: string }> {
  const companyName = input.companyName.trim();
  const phone = input.phone.trim();

  if (companyName.length < 2) {
    return { ok: false, message: "Indica el nombre de tu empresa o negocio" };
  }
  if (!isValidPhoneNumber(phone)) {
    return {
      ok: false,
      message: "Indica un teléfono válido con código de país",
    };
  }
  if (!Number.isFinite(input.propertyCount) || input.propertyCount < 1) {
    return { ok: false, message: "Indica cuántas propiedades administras (mínimo 1)" };
  }

  const user = await db.user.update({
    where: { id: userId },
    data: {
      companyName,
      phone,
      propertyCount: Math.min(Math.round(input.propertyCount), 9999),
      onboardingCompletedAt: new Date(),
    },
  });

  if (user.organizationId) {
    await db.organization.update({
      where: { id: user.organizationId },
      data: { name: companyName },
    });
    const billingAccount = await ensureBillingAccount(user.organizationId);
    if (billingAccount) {
      const propertySlots = clampPropertyCount(input.propertyCount);
      await db.billingAccount.update({
        where: { id: billingAccount.id },
        data: {
          metadata: {
            ...parseBillingAccountMetadata(billingAccount.metadata),
            propertySlots,
          },
        },
      });
    }
  } else {
    await ensureBillingAccount();
  }

  return { ok: true, message: "Configuración inicial completada" };
}
