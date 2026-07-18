"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AirbnbUniversalAccessActionState } from "@/app/guest-registration/universal-access-state";
import {
  buildAirbnbUniversalAccessRateLimitKey,
  checkAirbnbUniversalAccessRateLimit,
  checkAirbnbUniversalAccessRateLimits,
  resolveAirbnbUniversalGuestRegistration,
} from "@/services/guests/airbnb-universal-guest-registration.service";

const accessSchema = z.object({
  reservationCode: z
    .string()
    .trim()
    .min(6)
    .max(20)
    .regex(/^[a-z0-9-]+$/i),
});

const INVALID_MESSAGE =
  "No pudimos validar el código de la reserva. Revisa el código e intenta nuevamente.";
const MIN_RESPONSE_MS = 600;

async function waitForUniformResponse(startedAt: number): Promise<void> {
  const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

export async function accessAirbnbGuestRegistrationAction(
  _previousState: AirbnbUniversalAccessActionState,
  formData: FormData,
): Promise<AirbnbUniversalAccessActionState> {
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

  const ipKey = `ip:${buildAirbnbUniversalAccessRateLimitKey(clientAddress)}`;
  const codeKey = parsed.success
    ? `code:${buildAirbnbUniversalAccessRateLimitKey(
        parsed.data.reservationCode.toUpperCase(),
      )}`
    : null;
  const accessAllowed = codeKey
    ? checkAirbnbUniversalAccessRateLimits(ipKey, codeKey)
    : checkAirbnbUniversalAccessRateLimit(ipKey);

  if (!accessAllowed) {
    console.warn("[airbnb-universal-access] rate_limited", {
      ipKey: ipKey.slice(0, 15),
      codeKey: codeKey?.slice(0, 17) ?? null,
    });
    await waitForUniformResponse(startedAt);
    return { error: INVALID_MESSAGE };
  }

  if (!parsed.success) {
    await waitForUniformResponse(startedAt);
    return { error: INVALID_MESSAGE };
  }

  const result = await resolveAirbnbUniversalGuestRegistration(parsed.data);
  await waitForUniformResponse(startedAt);
  if (!result.ok) return { error: INVALID_MESSAGE };

  redirect(result.url);
}
