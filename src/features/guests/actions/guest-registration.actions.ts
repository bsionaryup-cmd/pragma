"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { guestRegistrationSchema } from "@/features/guests/schemas/guest-registration.schema";
import type { GuestRegistrationValues } from "@/features/guests/schemas/guest-registration.schema";
import { requireAnyPermission } from "@/lib/auth";
import { TenantAccessError } from "@/lib/platform/tenant-access";
import {
  generateGuestRegistrationLink,
  GuestRegistrationError,
  regenerateGuestRegistrationToken,
  revokeGuestRegistrationToken,
  submitGuestRegistration,
} from "@/services/guests/guest-registration.service";

function revalidateGuestRegistrationPaths() {
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/panel");
  revalidatePath("/inbox");
}

function toGuestRegistrationActionError(error: unknown): string {
  if (error instanceof GuestRegistrationError) return error.message;
  if (error instanceof TenantAccessError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "No se pudo procesar el link de registro";
}

async function requireGuestRegistrationPermission() {
  await requireAnyPermission("reservations:write", "properties:write");
}

export async function submitGuestRegistrationAction(
  values: GuestRegistrationValues,
) {
  const parsed = guestRegistrationSchema.parse(values);
  await submitGuestRegistration(parsed);

  revalidateGuestRegistrationPaths();
  revalidatePath(`/guest-registration/${parsed.token}`);

  return { success: true as const };
}

export async function generateGuestRegistrationLinkAction(
  reservationId: string,
) {
  try {
    await requireGuestRegistrationPermission();
    const url = await generateGuestRegistrationLink(reservationId);
    revalidateGuestRegistrationPaths();
    return { success: true as const, url };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      success: false as const,
      error: toGuestRegistrationActionError(error),
    };
  }
}

export async function regenerateGuestRegistrationTokenAction(
  reservationId: string,
) {
  try {
    await requireGuestRegistrationPermission();
    const url = await regenerateGuestRegistrationToken(reservationId);
    revalidateGuestRegistrationPaths();
    return { success: true as const, url };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      success: false as const,
      error: toGuestRegistrationActionError(error),
    };
  }
}

export async function revokeGuestRegistrationTokenAction(reservationId: string) {
  try {
    await requireGuestRegistrationPermission();
    await revokeGuestRegistrationToken(reservationId);
    revalidateGuestRegistrationPaths();
    return { success: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      success: false as const,
      error: toGuestRegistrationActionError(error),
    };
  }
}
