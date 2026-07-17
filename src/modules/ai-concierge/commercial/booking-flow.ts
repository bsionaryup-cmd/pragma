import "server-only";

import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { createConciergeToolRegistry } from "@/modules/ai-concierge/tools/create-registry";

/**
 * F11 — flujo comercial: disponibilidad → cotización → reserva Direct → GR.
 */
export async function runCommercialBookingFlow(input: {
  scope: TenantDataScope;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guestFirstName: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhone?: string;
  adults?: number;
}): Promise<{
  ok: boolean;
  steps: Array<{ step: string; ok: boolean; detail?: unknown; error?: string }>;
  reservationId?: string;
  quoteSummary?: string;
}> {
  const reg = createConciergeToolRegistry(
    { scope: input.scope },
    { includeWrite: true },
  );

  const steps: Array<{
    step: string;
    ok: boolean;
    detail?: unknown;
    error?: string;
  }> = [];

  const availability = await reg.invoke({
    toolName: "search_availability",
    args: {
      propertyId: input.propertyId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
    },
    currentPhase: 11,
  });
  steps.push({
    step: "availability",
    ok: availability.result?.ok === true,
    detail: availability.result?.data,
    error: availability.result?.error,
  });
  if (!availability.result?.ok) return { ok: false, steps };

  const available = Boolean(
    (availability.result.data as { available?: boolean })?.available,
  );
  if (!available) {
    steps.push({ step: "availability_gate", ok: false, error: "No disponible" });
    return { ok: false, steps };
  }

  const quote = await reg.invoke({
    toolName: "calculate_stay_quote",
    args: {
      propertyId: input.propertyId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
    },
    currentPhase: 11,
  });
  steps.push({
    step: "quote",
    ok: quote.result?.ok === true,
    detail: quote.result?.data,
    error: quote.result?.error,
  });
  if (!quote.result?.ok) return { ok: false, steps };

  const stayTotal = Number(
    (quote.result.data as { stayTotal?: number })?.stayTotal ?? 0,
  );
  const quoteSummary = String(
    (quote.result.data as { quoteSummary?: string })?.quoteSummary ?? "",
  );

  const created = await reg.invoke({
    toolName: "create_direct_reservation",
    args: {
      propertyId: input.propertyId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guestFirstName: input.guestFirstName,
      guestLastName: input.guestLastName,
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone,
      adults: input.adults ?? 1,
      totalAmount: stayTotal,
    },
    currentPhase: 11,
  });
  steps.push({
    step: "create_reservation",
    ok: created.result?.ok === true,
    detail: created.result?.data,
    error: created.result?.error,
  });
  if (!created.result?.ok) return { ok: false, steps, quoteSummary };

  const reservationId = String(
    (created.result.data as { reservationId?: string })?.reservationId ?? "",
  );

  if (input.guestEmail && reservationId) {
    const gr = await reg.invoke({
      toolName: "send_guest_registration_invite",
      args: { reservationId },
      currentPhase: 11,
    });
    steps.push({
      step: "guest_registration_invite",
      ok: gr.result?.ok === true,
      detail: gr.result,
      error: gr.result?.error,
    });
  }

  return { ok: true, steps, reservationId, quoteSummary };
}
