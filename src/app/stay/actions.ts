"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  buildStayPortalAccessRateLimitKey,
  checkStayPortalAccessRateLimit,
  checkStayPortalAccessRateLimits,
  resolveStayPortalByReservationCode,
} from "@/services/guests/stay-portal.service";

export type StayPortalAccessActionState = {
  error?: string;
  reason?:
    | "not_found"
    | "rate_limited"
    | "registration_pending"
    | "ended"
    | "ambiguous";
  registrationUrl?: string;
};

const accessSchema = z.object({
  reservationCode: z
    .string()
    .trim()
    .min(6)
    .max(20)
    .regex(/^[a-z0-9-]+$/i),
});

const MIN_RESPONSE_MS = 600;

async function waitForUniformResponse(startedAt: number): Promise<void> {
  const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

function messageForReason(
  reason: NonNullable<StayPortalAccessActionState["reason"]>,
): string {
  switch (reason) {
    case "registration_pending":
      return "Debes completar primero el registro de huéspedes.";
    case "ended":
      return "Esta reserva ya finalizó.";
    case "rate_limited":
      return "Demasiados intentos. Espera unos minutos e intenta de nuevo.";
    case "ambiguous":
    case "not_found":
    default:
      return "No encontramos una reserva con ese código. Revisa el código e intenta de nuevo.";
  }
}

export async function accessStayPortalAction(
  _previousState: StayPortalAccessActionState,
  formData: FormData,
): Promise<StayPortalAccessActionState> {
  const startedAt = Date.now();
  const requestHeaders = await headers();
  const clientAddress =
    requestHeaders.get("cf-connecting-ip") ??
    requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    "unknown";
  const parsed = accessSchema.safeParse({
    reservationCode: formData.get("reservationCode"),
  });

  const ipKey = `ip:${buildStayPortalAccessRateLimitKey(clientAddress)}`;
  const codeKey = parsed.success
    ? `code:${buildStayPortalAccessRateLimitKey(
        parsed.data.reservationCode.toUpperCase(),
      )}`
    : null;
  const accessAllowed = codeKey
    ? checkStayPortalAccessRateLimits(ipKey, codeKey)
    : checkStayPortalAccessRateLimit(ipKey);

  if (!accessAllowed) {
    await waitForUniformResponse(startedAt);
    return {
      reason: "rate_limited",
      error: messageForReason("rate_limited"),
    };
  }

  if (!parsed.success) {
    await waitForUniformResponse(startedAt);
    return {
      reason: "not_found",
      error: messageForReason("not_found"),
    };
  }

  const result = await resolveStayPortalByReservationCode(parsed.data);
  await waitForUniformResponse(startedAt);

  if (!result.ok) {
    return {
      reason: result.reason,
      error: messageForReason(result.reason),
      registrationUrl: result.registrationUrl,
    };
  }

  redirect(result.url);
}
