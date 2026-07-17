import "server-only";

import { z } from "zod";
import { BookingPlatform, TaskType } from "@prisma/client";
import { db } from "@/lib/db";
import { dateKeyToPrismaDate } from "@/lib/dates";
import {
  assertPropertyInScope,
  assertReservationInScope,
  TenantAccessError,
} from "@/lib/platform/tenant-access";
import { findOverlappingReservation } from "@/services/reservations/reservation-conflicts";
import { ensureGuestRegistrationForReservation } from "@/services/guests/guest-registration.service";
import { sendGuestRegistrationEmailForReservation } from "@/services/guests/guest-registration-email.service";
import { notifyAccessCodeEmailForCredential } from "@/services/integrations/ttlock/ttlock-access-code-email.service";
import { deriveReservationStatusFromDates } from "@/services/reservations/reservation-status";
import type { ConciergeToolHandler } from "@/modules/ai-concierge/tools/registry";
import {
  failResult,
  okResult,
  recordToolAudit,
  type ConciergeToolExecutionContext,
} from "@/modules/ai-concierge/tools/read/context";
import { PLANNED_WRITE_TOOLS } from "@/modules/ai-concierge/tools/write/catalog";

export { PLANNED_WRITE_TOOLS };

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object"
    ? (input as Record<string, unknown>)
    : {};
}

function wrap(
  ctx: ConciergeToolExecutionContext,
  toolName: string,
  run: (input: unknown) => Promise<ReturnType<typeof okResult>>,
): ConciergeToolHandler {
  return async (input) => {
    try {
      const result = await run(input);
      recordToolAudit({
        at: new Date().toISOString(),
        toolName,
        organizationId: ctx.scope.organizationId,
        userId: ctx.scope.userId,
        runId: ctx.runId,
        conversationId: ctx.conversationId,
        ok: result.ok,
        error: result.error,
        summary: result.ok ? "write-ok" : result.error,
      });
      return result;
    } catch (error) {
      const message =
        error instanceof TenantAccessError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Error write tool";
      recordToolAudit({
        at: new Date().toISOString(),
        toolName,
        organizationId: ctx.scope.organizationId,
        userId: ctx.scope.userId,
        runId: ctx.runId,
        conversationId: ctx.conversationId,
        ok: false,
        error: message,
      });
      return failResult(message);
    }
  };
}

export function createWriteToolHandlers(
  ctx: ConciergeToolExecutionContext,
): Record<string, ConciergeToolHandler> {
  return {
    register_arrival_time: wrap(ctx, "register_arrival_time", async (input) => {
      const parsed = z
        .object({
          reservationId: z.string().trim().min(1),
          arrivalTime: z.string().trim().min(1).max(80),
        })
        .safeParse(asRecord(input));
      if (!parsed.success) return failResult("reservationId y arrivalTime requeridos");
      await assertReservationInScope(ctx.scope, parsed.data.reservationId);
      const note = `[AI Concierge] Hora de llegada estimada: ${parsed.data.arrivalTime}`;
      const row = await db.reservation.findUnique({
        where: { id: parsed.data.reservationId },
        select: { internalNotes: true },
      });
      const nextNotes = [row?.internalNotes?.trim(), note].filter(Boolean).join("\n");
      await db.reservation.update({
        where: { id: parsed.data.reservationId },
        data: { internalNotes: nextNotes },
      });
      return okResult({
        reservationId: parsed.data.reservationId,
        arrivalTime: parsed.data.arrivalTime,
        recorded: true,
      });
    }),

    create_operational_task: wrap(ctx, "create_operational_task", async (input) => {
      const parsed = z
        .object({
          title: z.string().trim().min(1).max(200),
          description: z.string().trim().max(2000).optional(),
          reservationId: z.string().trim().min(1).optional(),
          propertyId: z.string().trim().min(1).optional(),
        })
        .safeParse(asRecord(input));
      if (!parsed.success) return failResult("title requerido");
      if (parsed.data.reservationId) {
        await assertReservationInScope(ctx.scope, parsed.data.reservationId);
      }
      if (parsed.data.propertyId) {
        await assertPropertyInScope(ctx.scope, parsed.data.propertyId);
      }
      const task = await db.task.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          type: TaskType.MAINTENANCE,
          status: "PENDING",
          assigneeId: ctx.scope.userId,
          reservationId: parsed.data.reservationId ?? null,
          propertyId: parsed.data.propertyId ?? null,
        },
        select: { id: true, title: true, status: true },
      });
      return okResult({ task });
    }),

    send_guest_registration_invite: wrap(
      ctx,
      "send_guest_registration_invite",
      async (input) => {
        const parsed = z
          .object({
            reservationId: z.string().trim().min(1),
            force: z.boolean().optional(),
          })
          .safeParse(asRecord(input));
        if (!parsed.success) return failResult("reservationId requerido");
        await assertReservationInScope(ctx.scope, parsed.data.reservationId);
        await ensureGuestRegistrationForReservation(parsed.data.reservationId);
        const result = await sendGuestRegistrationEmailForReservation(
          parsed.data.reservationId,
          {
            force: parsed.data.force === true,
            triggeredBy: parsed.data.force ? "manual" : "auto",
            userId: ctx.scope.userId,
          },
        );
        return result.ok
          ? okResult(result)
          : failResult(result.message ?? "No se pudo enviar GR");
      },
    ),

    resend_access_code_email: wrap(ctx, "resend_access_code_email", async (input) => {
      const parsed = z
        .object({
          reservationId: z.string().trim().min(1),
          force: z.boolean().optional(),
        })
        .safeParse(asRecord(input));
      if (!parsed.success) return failResult("reservationId requerido");
      await assertReservationInScope(ctx.scope, parsed.data.reservationId);
      const credential = await db.accessCredential.findFirst({
        where: { reservationId: parsed.data.reservationId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (!credential) return failResult("No hay credencial de acceso");
      const result = await notifyAccessCodeEmailForCredential(credential.id);
      return result.ok
        ? okResult(result)
        : failResult(result.message ?? "No se pudo reenviar código");
    }),

    create_direct_reservation: wrap(ctx, "create_direct_reservation", async (input) => {
      const parsed = z
        .object({
          propertyId: z.string().trim().min(1),
          checkIn: z.string().trim().min(8),
          checkOut: z.string().trim().min(8),
          guestFirstName: z.string().trim().min(1).max(80),
          guestLastName: z.string().trim().max(80).optional(),
          guestEmail: z.string().trim().email().optional(),
          guestPhone: z.string().trim().max(40).optional(),
          adults: z.number().int().min(1).max(20).optional(),
          totalAmount: z.number().min(0),
        })
        .safeParse(asRecord(input));
      if (!parsed.success) return failResult("Datos de reserva Direct incompletos");
      await assertPropertyInScope(ctx.scope, parsed.data.propertyId);
      const property = await db.property.findUnique({
        where: { id: parsed.data.propertyId },
        select: {
          id: true,
          maxGuests: true,
          checkInTime: true,
          checkOutTime: true,
          ownerId: true,
          name: true,
        },
      });
      if (!property) return failResult("Propiedad no encontrada");
      const adults = parsed.data.adults ?? 1;
      if (adults > property.maxGuests) {
        return failResult(`Máximo ${property.maxGuests} huéspedes`);
      }
      const checkIn = dateKeyToPrismaDate(parsed.data.checkIn);
      const checkOut = dateKeyToPrismaDate(parsed.data.checkOut);
      const conflict = await findOverlappingReservation(
        parsed.data.propertyId,
        checkIn,
        checkOut,
      );
      if (conflict) {
        return failResult("Fechas no disponibles");
      }
      const guestName = [parsed.data.guestFirstName, parsed.data.guestLastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const status = deriveReservationStatusFromDates(checkIn, checkOut, {
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
      });
      const created = await db.reservation.create({
        data: {
          propertyId: property.id,
          guestName,
          guestFirstName: parsed.data.guestFirstName,
          guestLastName: parsed.data.guestLastName ?? null,
          guestEmail: parsed.data.guestEmail ?? null,
          guestPhone: parsed.data.guestPhone ?? null,
          adults,
          children: 0,
          infants: 0,
          checkIn,
          checkOut,
          platform: BookingPlatform.DIRECT,
          status,
          paymentStatus: parsed.data.totalAmount > 0 ? "PENDING" : "PAID",
          totalAmount: parsed.data.totalAmount,
          internalNotes: "[AI Concierge] Reserva creada por flujo comercial",
        },
        select: { id: true, guestName: true, totalAmount: true, currency: true },
      });
      await ensureGuestRegistrationForReservation(created.id);
      if (parsed.data.guestEmail) {
        await sendGuestRegistrationEmailForReservation(created.id, {
          triggeredBy: "auto",
        }).catch(() => undefined);
      }
      return okResult({
        reservationId: created.id,
        guestName: created.guestName,
        totalAmount: Number(created.totalAmount),
        currency: created.currency,
        propertyName: property.name,
      });
    }),
  };
}
