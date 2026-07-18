"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  completeGuestRegistrationSchema,
  guestRegistrationSchema,
  guestStepSchema,
} from "@/features/guests/schemas/guest-registration.schema";
import type {
  CompleteGuestRegistrationValues,
  GuestRegistrationValues,
  GuestStepValues,
} from "@/features/guests/schemas/guest-registration.schema";
import { requireAnyPermission } from "@/lib/auth";
import { TenantAccessError } from "@/lib/platform/tenant-access";
import {
  completeGuestRegistration,
  generateGuestRegistrationLink,
  GuestRegistrationError,
  registerGuestStep,
  regenerateGuestRegistrationToken,
  revokeGuestRegistrationToken,
  submitGuestRegistration,
} from "@/services/guests/guest-registration.service";
import { sendGuestRegistrationEmailForReservation } from "@/services/guests/guest-registration-email.service";
import { resendAdminGuestRegistrationNotification } from "@/services/guests/guest-registration-admin-notification.service";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import { requireTenantContext } from "@/lib/platform/tenant-context";

function revalidateGuestRegistrationPaths() {
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/panel");
  revalidatePath("/inbox");
  revalidatePath("/smart-access");
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

async function readGuestRegistrationRequestMeta() {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() ??
    headerStore.get("cf-connecting-ip") ??
    headerStore.get("x-real-ip");
  const userAgent = headerStore.get("user-agent");
  return {
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  };
}

export async function submitGuestRegistrationAction(
  values: GuestRegistrationValues,
) {
  try {
    const parsed = guestRegistrationSchema.parse(values);
    const requestMeta = await readGuestRegistrationRequestMeta();
    await submitGuestRegistration(parsed, requestMeta);
    revalidateGuestRegistrationPaths();
    revalidatePath(`/guest-registration/${parsed.token}`);
    return { success: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      success: false as const,
      error: toGuestRegistrationActionError(error),
    };
  }
}

export async function registerGuestStepAction(values: GuestStepValues) {
  try {
    const parsed = guestStepSchema.parse(values);
    const reservation = await registerGuestStep(parsed);
    revalidateGuestRegistrationPaths();
    revalidatePath(`/guest-registration/${parsed.token}`);
    return { success: true as const, reservation };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      success: false as const,
      error: toGuestRegistrationActionError(error),
    };
  }
}

export async function completeGuestRegistrationAction(
  values: CompleteGuestRegistrationValues,
) {
  try {
    const parsed = completeGuestRegistrationSchema.parse(values);
    const requestMeta = await readGuestRegistrationRequestMeta();
    const reservation = await completeGuestRegistration(parsed, requestMeta);
    revalidateGuestRegistrationPaths();
    revalidatePath(`/guest-registration/${parsed.token}`);
    return { success: true as const, reservation };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      success: false as const,
      error: toGuestRegistrationActionError(error),
    };
  }
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

export async function resendGuestRegistrationEmailAction(reservationId: string) {
  try {
    await requireGuestRegistrationPermission();
    const tenant = await requireTenantContext();
    const result = await sendGuestRegistrationEmailForReservation(reservationId, {
      force: true,
      triggeredBy: "manual",
      userId: tenant.userId,
    });
    if (!result.ok) {
      return { success: false as const, error: result.message };
    }
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

export async function resendGuestRegistrationAdminNotificationAction(
  reservationId: string,
) {
  try {
    await requireGuestRegistrationPermission();
    const [scope, tenant] = await Promise.all([
      requireTenantDataScope(),
      requireTenantContext(),
    ]);
    await assertReservationInScope(scope, reservationId);

    const result = await resendAdminGuestRegistrationNotification(
      reservationId,
      tenant.userId,
    );
    revalidateGuestRegistrationPaths();
    revalidatePath("/reservations");

    if (!result.ok) {
      return { success: false as const, error: result.message };
    }
    return { success: true as const, message: result.message };
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
