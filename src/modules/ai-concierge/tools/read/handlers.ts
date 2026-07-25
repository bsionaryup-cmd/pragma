import "server-only";

import { z } from "zod";
import { AccessCredentialStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { dateKeyToPrismaDate, prismaDateToKey } from "@/lib/dates";
import { formatAccessCode } from "@/lib/access-code";
import { parseOperationalContacts } from "@/lib/operational-contacts";
import { computeReservationPaymentBalance } from "@/lib/payments/reservation-payment-balance-calc";
import {
  mergePropertyScope,
  mergeReservationScope,
} from "@/lib/platform/tenant-data-scope";
import {
  assertPropertyInScope,
  assertReservationInScope,
  TenantAccessError,
} from "@/lib/platform/tenant-access";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { findOverlappingReservation } from "@/services/reservations/reservation-conflicts";
import { getActiveGuestRegistrationForReservation } from "@/services/guests/guest-registration.service";
import { decryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";
import type { ConciergeToolHandler } from "@/modules/ai-concierge/tools/registry";
import type { ConciergeToolResult } from "@/modules/ai-concierge/types/tool";
import {
  failResult,
  okResult,
  recordToolAudit,
  type ConciergeToolExecutionContext,
} from "@/modules/ai-concierge/tools/read/context";

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object"
    ? (input as Record<string, unknown>)
    : {};
}

async function assertConciergePropertyAllowed(
  ctx: ConciergeToolExecutionContext,
  propertyId: string,
) {
  const property = await assertPropertyInScope(ctx.scope, propertyId);
  const allowlist = ctx.allowedPropertyIds ?? [];
  if (allowlist.length > 0 && !allowlist.includes(propertyId)) {
    throw new TenantAccessError(
      "Propiedad no autorizada para AI Concierge",
    );
  }
  return property;
}

async function assertConciergeReservationAllowed(
  ctx: ConciergeToolExecutionContext,
  reservationId: string,
) {
  const reservation = await assertReservationInScope(
    ctx.scope,
    reservationId,
  );
  const allowlist = ctx.allowedPropertyIds ?? [];
  if (
    allowlist.length > 0 &&
    !allowlist.includes(reservation.propertyId)
  ) {
    throw new TenantAccessError(
      "Reserva fuera de las propiedades autorizadas para AI Concierge",
    );
  }
  return reservation;
}

function wrapHandler(
  ctx: ConciergeToolExecutionContext,
  toolName: string,
  run: (input: unknown) => Promise<ConciergeToolResult>,
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
        summary: result.ok
          ? `ok keys=${Object.keys((result.data as object) ?? {}).length}`
          : result.error,
      });
      return result;
    } catch (error) {
      const message =
        error instanceof TenantAccessError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Error en tool";
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

export function createReadToolHandlers(
  ctx: ConciergeToolExecutionContext,
): Record<string, ConciergeToolHandler> {
  return {
    search_reservations: wrapHandler(ctx, "search_reservations", async (input) => {
      const parsed = z
        .object({
          query: z.string().trim().min(1).max(120).optional(),
          propertyId: z.string().trim().min(1).optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .safeParse(asRecord(input));
      if (!parsed.success) {
        return failResult("Input inválido para search_reservations");
      }
      if (parsed.data.propertyId) {
        await assertConciergePropertyAllowed(ctx, parsed.data.propertyId);
      }
      const limit = parsed.data.limit ?? 20;
      const q = parsed.data.query?.toLowerCase();
      const rows = await db.reservation.findMany({
        where: withVisibleReservationsFilter(
          mergeReservationScope(ctx.scope, {
            ...(parsed.data.propertyId
              ? { propertyId: parsed.data.propertyId }
              : (ctx.allowedPropertyIds?.length ?? 0) > 0
                ? { propertyId: { in: ctx.allowedPropertyIds } }
                : {}),
            ...(q
              ? {
                  OR: [
                    { guestName: { contains: parsed.data.query!, mode: "insensitive" } },
                    { guestEmail: { contains: parsed.data.query!, mode: "insensitive" } },
                    { guestPhone: { contains: parsed.data.query! } },
                    { reservationCode: { contains: parsed.data.query!, mode: "insensitive" } },
                    { id: parsed.data.query },
                  ],
                }
              : {}),
          }),
        ),
        select: {
          id: true,
          guestName: true,
          guestEmail: true,
          checkIn: true,
          checkOut: true,
          status: true,
          platform: true,
          propertyId: true,
          reservationCode: true,
          property: { select: { name: true, unitNumber: true } },
        },
        orderBy: { checkIn: "desc" },
        take: limit,
      });
      return okResult({
        count: rows.length,
        reservations: rows.map((r) => ({
          id: r.id,
          guestName: r.guestName,
          guestEmail: r.guestEmail,
          checkIn: prismaDateToKey(r.checkIn),
          checkOut: prismaDateToKey(r.checkOut),
          status: r.status,
          platform: r.platform,
          propertyId: r.propertyId,
          reservationCode: r.reservationCode,
          propertyName: r.property.name,
          unitNumber: r.property.unitNumber,
        })),
      });
    }),

    get_reservation: wrapHandler(ctx, "get_reservation", async (input) => {
      const parsed = z
        .object({ reservationId: z.string().trim().min(1) })
        .safeParse(asRecord(input));
      if (!parsed.success) return failResult("reservationId requerido");
      await assertConciergeReservationAllowed(ctx, parsed.data.reservationId);
      const row = await db.reservation.findFirst({
        where: mergeReservationScope(ctx.scope, { id: parsed.data.reservationId }),
        select: {
          id: true,
          guestName: true,
          guestFirstName: true,
          guestLastName: true,
          guestEmail: true,
          guestPhone: true,
          adults: true,
          children: true,
          infants: true,
          checkIn: true,
          checkOut: true,
          status: true,
          platform: true,
          paymentStatus: true,
          totalAmount: true,
          currency: true,
          reservationCode: true,
          internalNotes: true,
          propertyId: true,
          property: {
            select: {
              id: true,
              name: true,
              unitNumber: true,
              address: true,
              city: true,
              checkInTime: true,
              checkOutTime: true,
            },
          },
        },
      });
      if (!row) return failResult("Reserva no encontrada", ["reservationId"]);
      return okResult({
        id: row.id,
        guestName: row.guestName,
        guestFirstName: row.guestFirstName,
        guestLastName: row.guestLastName,
        guestEmail: row.guestEmail,
        guestPhone: row.guestPhone,
        adults: row.adults,
        children: row.children,
        infants: row.infants,
        checkIn: prismaDateToKey(row.checkIn),
        checkOut: prismaDateToKey(row.checkOut),
        status: row.status,
        platform: row.platform,
        paymentStatus: row.paymentStatus,
        totalAmount: Number(row.totalAmount),
        currency: row.currency,
        reservationCode: row.reservationCode,
        internalNotes: row.internalNotes,
        property: row.property,
        reservationSummary: `${row.guestName} · ${prismaDateToKey(row.checkIn)} → ${prismaDateToKey(row.checkOut)} · ${row.property.name}`,
      });
    }),

    get_property_guest_info: wrapHandler(
      ctx,
      "get_property_guest_info",
      async (input) => {
        const parsed = z
          .object({ propertyId: z.string().trim().min(1) })
          .safeParse(asRecord(input));
        if (!parsed.success) return failResult("propertyId requerido");
        await assertConciergePropertyAllowed(ctx, parsed.data.propertyId);
        const property = await db.property.findFirst({
          where: mergePropertyScope(ctx.scope, { id: parsed.data.propertyId }),
          select: {
            id: true,
            name: true,
            unitNumber: true,
            address: true,
            city: true,
            neighborhood: true,
            checkInTime: true,
            checkOutTime: true,
            wifiName: true,
            wifiPassword: true,
            houseRules: true,
            accessInstructions: true,
            description: true,
            maxGuests: true,
            receptionWhatsapp: true,
          },
        });
        if (!property) return failResult("Propiedad no encontrada", ["propertyId"]);

        const missingFacts: string[] = [];
        if (!property.wifiName || !property.wifiPassword) missingFacts.push("wifi");
        if (!property.houseRules?.trim()) missingFacts.push("houseRules");
        if (!property.address?.trim()) missingFacts.push("address");

        const address = [property.address, property.city, property.neighborhood]
          .filter(Boolean)
          .join(", ");

        return okResult(
          {
            propertyId: property.id,
            name: property.name,
            unitNumber: property.unitNumber,
            address,
            checkInTime: property.checkInTime,
            checkOutTime: property.checkOutTime,
            wifiName: property.wifiName,
            wifiPassword: property.wifiPassword,
            houseRules: property.houseRules,
            accessInstructions: property.accessInstructions,
            description: property.description,
            maxGuests: property.maxGuests,
            receptionWhatsapp: property.receptionWhatsapp,
            parkingInfo: null as string | null,
            petsPolicy: null as string | null,
            laundryInfo: null as string | null,
            towelsInfo: null as string | null,
            restaurantsInfo: null as string | null,
          },
          missingFacts,
        );
      },
    ),

    get_guest_registration_status: wrapHandler(
      ctx,
      "get_guest_registration_status",
      async (input) => {
        const parsed = z
          .object({ reservationId: z.string().trim().min(1) })
          .safeParse(asRecord(input));
        if (!parsed.success) return failResult("reservationId requerido");
        await assertConciergeReservationAllowed(ctx, parsed.data.reservationId);
        const active = await getActiveGuestRegistrationForReservation(
          parsed.data.reservationId,
        );
        if (!active) {
          return okResult(
            {
              reservationId: parsed.data.reservationId,
              guestRegistrationStatus: "NONE",
              guestRegistrationUrl: null,
            },
            ["guestRegistrationUrl", "guestRegistrationStatus"],
          );
        }
        return okResult({
          reservationId: parsed.data.reservationId,
          guestRegistrationStatus: active.status,
          guestRegistrationUrl: active.url,
          expiresAt: active.expiresAt,
          usedAt: active.usedAt,
        });
      },
    ),

    get_access_status: wrapHandler(ctx, "get_access_status", async (input) => {
      const parsed = z
        .object({
          reservationId: z.string().trim().min(1),
          includeCode: z.boolean().optional(),
        })
        .safeParse(asRecord(input));
      if (!parsed.success) return failResult("reservationId requerido");
      await assertConciergeReservationAllowed(ctx, parsed.data.reservationId);
      const credential = await db.accessCredential.findFirst({
        where: {
          reservationId: parsed.data.reservationId,
          status: {
            in: [
              AccessCredentialStatus.PENDING,
              AccessCredentialStatus.GENERATED,
              AccessCredentialStatus.ACTIVE,
              AccessCredentialStatus.SENT,
              AccessCredentialStatus.SUSPENDED,
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          deliveryStatus: true,
          validFrom: true,
          validTo: true,
          codeEncrypted: true,
          ttlockCodeId: true,
        },
      });
      if (!credential) {
        return okResult(
          {
            reservationId: parsed.data.reservationId,
            hasCredential: false,
            accessCode: null,
          },
          ["accessCode", "accessValidFrom", "accessValidTo"],
        );
      }
      const includeCode = parsed.data.includeCode !== false;
      let accessCode: string | null = null;
      if (
        includeCode &&
        credential.ttlockCodeId &&
        credential.codeEncrypted
      ) {
        try {
          accessCode =
            formatAccessCode(decryptTTLockSecret(credential.codeEncrypted)) ??
            null;
        } catch {
          accessCode = null;
        }
      }
      const missingFacts: string[] = [];
      if (!accessCode) missingFacts.push("accessCode");
      return okResult(
        {
          reservationId: parsed.data.reservationId,
          hasCredential: true,
          credentialId: credential.id,
          status: credential.status,
          deliveryStatus: credential.deliveryStatus,
          accessCode,
          accessValidFrom: credential.validFrom?.toISOString() ?? null,
          accessValidTo: credential.validTo?.toISOString() ?? null,
        },
        missingFacts,
      );
    }),

    search_availability: wrapHandler(ctx, "search_availability", async (input) => {
      const parsed = z
        .object({
          propertyId: z.string().trim().min(1),
          checkIn: z.string().trim().min(8),
          checkOut: z.string().trim().min(8),
        })
        .safeParse(asRecord(input));
      if (!parsed.success) {
        return failResult("propertyId, checkIn y checkOut requeridos");
      }
      await assertConciergePropertyAllowed(ctx, parsed.data.propertyId);
      const checkIn = dateKeyToPrismaDate(parsed.data.checkIn);
      const checkOut = dateKeyToPrismaDate(parsed.data.checkOut);
      if (!(checkOut > checkIn)) {
        return failResult("checkOut debe ser posterior a checkIn");
      }
      const conflict = await findOverlappingReservation(
        parsed.data.propertyId,
        checkIn,
        checkOut,
      );
      const available = !conflict;
      return okResult({
        propertyId: parsed.data.propertyId,
        checkIn: parsed.data.checkIn,
        checkOut: parsed.data.checkOut,
        available,
        availabilitySummary: available
          ? `Disponible del ${parsed.data.checkIn} al ${parsed.data.checkOut}.`
          : `No disponible: conflicto con «${conflict?.guestName ?? "reserva"}» (${conflict ? prismaDateToKey(conflict.checkIn) : "?"} → ${conflict ? prismaDateToKey(conflict.checkOut) : "?"}).`,
        conflict: conflict
          ? {
              id: conflict.id,
              guestName: conflict.guestName,
              checkIn: prismaDateToKey(conflict.checkIn),
              checkOut: prismaDateToKey(conflict.checkOut),
              status: conflict.status,
            }
          : null,
      });
    }),

    get_calendar: wrapHandler(ctx, "get_calendar", async (input) => {
      const parsed = z
        .object({
          propertyId: z.string().trim().min(1).optional(),
          from: z.string().trim().min(8),
          to: z.string().trim().min(8),
        })
        .safeParse(asRecord(input));
      if (!parsed.success) return failResult("from y to (YYYY-MM-DD) requeridos");
      if (parsed.data.propertyId) {
        await assertConciergePropertyAllowed(ctx, parsed.data.propertyId);
      }
      const from = dateKeyToPrismaDate(parsed.data.from);
      const to = dateKeyToPrismaDate(parsed.data.to);
      const reservations = await db.reservation.findMany({
        where: withVisibleReservationsFilter(
          mergeReservationScope(ctx.scope, {
            ...(parsed.data.propertyId
              ? { propertyId: parsed.data.propertyId }
              : {}),
            status: { notIn: ["CANCELLED"] },
            checkIn: { lt: to },
            checkOut: { gt: from },
          }),
        ),
        select: {
          id: true,
          propertyId: true,
          guestName: true,
          checkIn: true,
          checkOut: true,
          status: true,
          platform: true,
          property: { select: { name: true, unitNumber: true } },
        },
        orderBy: { checkIn: "asc" },
        take: 200,
      });
      return okResult({
        from: parsed.data.from,
        to: parsed.data.to,
        propertyId: parsed.data.propertyId ?? null,
        count: reservations.length,
        reservations: reservations.map((r) => ({
          id: r.id,
          propertyId: r.propertyId,
          propertyName: r.property.name,
          unitNumber: r.property.unitNumber,
          guestName: r.guestName,
          checkIn: prismaDateToKey(r.checkIn),
          checkOut: prismaDateToKey(r.checkOut),
          status: r.status,
          platform: r.platform,
        })),
      });
    }),

    get_operational_contacts: wrapHandler(
      ctx,
      "get_operational_contacts",
      async (input) => {
        const parsed = z
          .object({ propertyId: z.string().trim().min(1) })
          .safeParse(asRecord(input));
        if (!parsed.success) return failResult("propertyId requerido");
        await assertConciergePropertyAllowed(ctx, parsed.data.propertyId);
        const property = await db.property.findFirst({
          where: mergePropertyScope(ctx.scope, { id: parsed.data.propertyId }),
          select: {
            id: true,
            operationalContacts: true,
            guestRegistrationContactKey: true,
            receptionWhatsapp: true,
          },
        });
        if (!property) return failResult("Propiedad no encontrada");
        const contacts = parseOperationalContacts(property.operationalContacts);
        return okResult({
          propertyId: property.id,
          guestRegistrationContactKey: property.guestRegistrationContactKey,
          receptionWhatsapp: property.receptionWhatsapp,
          contacts,
        });
      },
    ),

    get_payment_balance: wrapHandler(ctx, "get_payment_balance", async (input) => {
      const parsed = z
        .object({ reservationId: z.string().trim().min(1) })
        .safeParse(asRecord(input));
      if (!parsed.success) return failResult("reservationId requerido");
      await assertConciergeReservationAllowed(ctx, parsed.data.reservationId);
      const row = await db.reservation.findFirst({
        where: mergeReservationScope(ctx.scope, { id: parsed.data.reservationId }),
        select: {
          id: true,
          totalAmount: true,
          currency: true,
          guestName: true,
          propertyId: true,
        },
      });
      if (!row) return failResult("Reserva no encontrada");
      const [links, manualPayments] = await Promise.all([
        db.guestPaymentLink.findMany({
          where: {
            reservationId: row.id,
            status: { in: ["SENT", "PENDING", "PROCESSING", "PAID"] },
          },
          select: { amount: true, status: true },
        }),
        db.reservationPayment.findMany({
          where: { reservationId: row.id },
          select: { amount: true },
        }),
      ]);
      const totalAmount = Number(row.totalAmount);
      const computed = computeReservationPaymentBalance({
        totalAmount,
        links: links.map((l) => ({
          amount: Number(l.amount),
          status: l.status,
        })),
        manualPayments: manualPayments.map((p) => ({
          amount: Number(p.amount),
        })),
      });
      return okResult({
        reservationId: row.id,
        propertyId: row.propertyId,
        guestName: row.guestName,
        currency: row.currency,
        totalAmount,
        ...computed,
        balanceDue: computed.remainingBalance,
        paymentInstructions: null as string | null,
      });
    }),

    list_payment_links: wrapHandler(ctx, "list_payment_links", async (input) => {
      const parsed = z
        .object({ reservationId: z.string().trim().min(1) })
        .safeParse(asRecord(input));
      if (!parsed.success) return failResult("reservationId requerido");
      await assertConciergeReservationAllowed(ctx, parsed.data.reservationId);
      const links = await db.guestPaymentLink.findMany({
        where: { reservationId: parsed.data.reservationId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          status: true,
          category: true,
          amount: true,
          currency: true,
          description: true,
          createdAt: true,
        },
      });
      return okResult({
        reservationId: parsed.data.reservationId,
        count: links.length,
        links: links.map((l) => ({
          id: l.id,
          status: l.status,
          category: l.category,
          amount: Number(l.amount),
          currency: l.currency,
          description: l.description,
          createdAt: l.createdAt.toISOString(),
        })),
      });
    }),

    calculate_stay_quote: wrapHandler(ctx, "calculate_stay_quote", async (input) => {
      const parsed = z
        .object({
          propertyId: z.string().trim().min(1),
          checkIn: z.string().trim().min(8),
          checkOut: z.string().trim().min(8),
        })
        .safeParse(asRecord(input));
      if (!parsed.success) {
        return failResult("propertyId, checkIn y checkOut requeridos");
      }
      await assertConciergePropertyAllowed(ctx, parsed.data.propertyId);
      const property = await db.property.findFirst({
        where: mergePropertyScope(ctx.scope, { id: parsed.data.propertyId }),
        select: {
          id: true,
          name: true,
          baseRate: true,
          cleaningFee: true,
          currency: true,
        },
      });
      if (!property) return failResult("Propiedad no encontrada");
      const checkIn = dateKeyToPrismaDate(parsed.data.checkIn);
      const checkOut = dateKeyToPrismaDate(parsed.data.checkOut);
      const nights = Math.round(
        (checkOut.getTime() - checkIn.getTime()) / 86_400_000,
      );
      if (nights <= 0) return failResult("Rango de fechas inválido");
      const baseRate = Number(property.baseRate ?? 0);
      const cleaningFee = Number(property.cleaningFee ?? 0);
      if (!baseRate) {
        return okResult(
          {
            propertyId: property.id,
            quoteSummary: null,
            source: "base_rate_missing",
          },
          ["quoteSummary"],
        );
      }
      const stayTotal = baseRate * nights + cleaningFee;
      const currency = property.currency ?? "COP";
      const quoteSummary = `${property.name}: ${nights} noche(s) × ${baseRate} + limpieza ${cleaningFee} = ${stayTotal} ${currency} (tarifa base; no incluye PriceLabs dinámico en Fase 6).`;
      return okResult({
        propertyId: property.id,
        propertyName: property.name,
        checkIn: parsed.data.checkIn,
        checkOut: parsed.data.checkOut,
        nights,
        baseRate,
        cleaningFee,
        stayTotal,
        currency,
        quoteSummary,
        source: "property_base_rate",
      });
    }),
  };
}
