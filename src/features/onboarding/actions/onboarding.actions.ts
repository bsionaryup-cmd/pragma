"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  completeOnboarding,
  type OnboardingProfileInput,
} from "@/services/onboarding/onboarding.service";

export async function completeOnboardingAction(input: OnboardingProfileInput) {
  const user = await requirePermission("billing:manage");
  const result = await completeOnboarding(user.dbUserId, input);
  revalidatePath("/onboarding");
  revalidatePath("/panel");
  return result;
}
