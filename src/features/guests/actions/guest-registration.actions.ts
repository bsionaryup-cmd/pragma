"use server";

import { revalidatePath } from "next/cache";
import { guestRegistrationSchema } from "@/features/guests/schemas/guest-registration.schema";
import type { GuestRegistrationValues } from "@/features/guests/schemas/guest-registration.schema";
import { requirePermission } from "@/lib/auth";
import {
  regenerateGuestRegistrationToken,
  revokeGuestRegistrationToken,
  submitGuestRegistration,
} from "@/services/guests/guest-registration.service";

export async function submitGuestRegistrationAction(
  values: GuestRegistrationValues,
) {
  const parsed = guestRegistrationSchema.parse(values);
  await submitGuestRegistration(parsed);

  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/panel");
  revalidatePath(`/guest-registration/${parsed.token}`);

  return { success: true as const };
}

export async function regenerateGuestRegistrationTokenAction(
  reservationId: string,
) {
  await requirePermission("reservations:write");
  const url = await regenerateGuestRegistrationToken(reservationId);
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/panel");
  return { success: true as const, url };
}

export async function revokeGuestRegistrationTokenAction(reservationId: string) {
  await requirePermission("reservations:write");
  await revokeGuestRegistrationToken(reservationId);
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/panel");
  return { success: true as const };
}
