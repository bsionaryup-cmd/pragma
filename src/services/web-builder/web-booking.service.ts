import "server-only";

import {
  BookingPlatform,
  PaymentStatus,
  PropertyStatus,
  ReservationStatus,
  UserRole,
  WebSiteStatus,
} from "@prisma/client";
import { dateKeyToPrismaDate, prismaDateToKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { normalizeSiteSlug } from "@/lib/web-builder/reserved-slugs";
import { touchPropertyIcalExport } from "@/services/airbnb/airbnb-export-push.service";
import { emitBookingConfirmed } from "@/modules/integrations/ttlock/ttlock.events";
import {
  findOverlappingReservation,
  ReservationConflictError,
} from "@/services/reservations/reservation-conflicts";
import { deriveReservationStatusFromDates } from "@/services/reservations/reservation-status";
import { activateReservationPaymentHold } from "@/services/reservations/reservation-hold.service";
import {
  loadWebBookingPaymentHoldForReservation,
  resolveWebBookingPaymentHold,
  type WebBookingPaymentHold,
} from "@/services/web-builder/web-booking-payment.service";
import {
  ensureGuestRegistrationForReservation,
  isGuestRegistrationEligiblePlatform,
  isGuestRegistrationEligibleStatus,
} from "@/services/guests/guest-registration.service";
import { generateWebDirectReservationCode } from "@/lib/web-builder/web-reservation-code";

export type SearchWebAvailabilityInput = {
  slug: string;
  checkIn: string;
  checkOut: string;
  guests: number;
};

export type CreateWebDirectReservationInput = {
  slug: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  infants: number;
  guestFirstName: string;
  guestLastName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  totalAmount: number;
  policiesAccepted: true;
  idempotencyKey?: string;
};

function buildGuestName(firstName: string, lastName?: string | null): string {
  const first = firstName.trim();
  const last = lastName?.trim();
  return last ? `${first} ${last}` : first;
}

function countNights(checkIn: Date, checkOut: Date): number {
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
  return nights > 0 ? nights : 0;
}

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

function quoteStay(
  nights: number,
  baseRate: number,
  cleaningFee: number,
  currency: string,
) {
  const lodging = nights * baseRate;
  const total = lodging + cleaningFee;
  return {
    nights,
    baseRate,
    cleaningFee,
    lodgingSubtotal: lodging,
    total,
    currency,
  };
}

async function resolveOrgReservationActorId(organizationId: string): Promise<string> {
  const owner = await db.user.findFirst({
    where: { organizationId, isAccountOwner: true, deletedAt: null },
    select: { id: true },
  });
  if (owner) return owner.id;

  const admin = await db.user.findFirst({
    where: { organizationId, role: UserRole.ADMIN, deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    throw new Error("No hay usuario administrador para procesar la reserva");
  }
  return admin.id;
}

async function loadPublishedBookingSite(slug: string) {
  const normalized = normalizeSiteSlug(slug);
  if (!normalized) return null;

  return db.tenantWebSite.findFirst({
    where: {
      slug: normalized,
      status: WebSiteStatus.PUBLISHED,
      bookingEnabled: true,
    },
    select: {
      id: true,
      slug: true,
      organizationId: true,
      currency: true,
      propertyLinks: {
        where: {
          isPublished: true,
          property: { status: PropertyStatus.ACTIVE },
        },
        select: {
          id: true,
          property: {
            select: {
              id: true,
              name: true,
              unitNumber: true,
              maxGuests: true,
              baseRate: true,
              cleaningFee: true,
              currency: true,
              checkInTime: true,
              checkOutTime: true,
              ownerId: true,
            },
          },
        },
      },
    },
  });
}

export async function searchWebAvailability(input: SearchWebAvailabilityInput) {
  const site = await loadPublishedBookingSite(input.slug);
  if (!site) {
    return { available: [] as const, reason: "site_not_found" as const };
  }

  const checkIn = dateKeyToPrismaDate(input.checkIn);
  const checkOut = dateKeyToPrismaDate(input.checkOut);
  if (checkOut <= checkIn) {
    throw new Error("La fecha de salida debe ser posterior al check-in");
  }

  const guests = Math.max(1, Math.floor(input.guests));
  const nights = countNights(checkIn, checkOut);

  const results: Array<{
    propertyId: string;
    name: string;
    unitNumber: string | null;
    maxGuests: number;
    quote: ReturnType<typeof quoteStay>;
  }> = [];

  for (const link of site.propertyLinks) {
    const property = link.property;
    if (property.maxGuests < guests) continue;

    const overlap = await findOverlappingReservation(property.id, checkIn, checkOut);
    if (overlap) continue;

    const baseRate = decimalToNumber(property.baseRate);
    const cleaningFee = decimalToNumber(property.cleaningFee);
    const currency = property.currency || site.currency;

    results.push({
      propertyId: property.id,
      name: property.name,
      unitNumber: property.unitNumber,
      maxGuests: property.maxGuests,
      quote: quoteStay(nights, baseRate, cleaningFee, currency),
    });
  }

  return {
    available: results,
    siteSlug: site.slug,
    checkIn: prismaDateToKey(checkIn),
    checkOut: prismaDateToKey(checkOut),
    guests,
  };
}

export async function createWebDirectReservation(input: CreateWebDirectReservationInput) {
  const site = await loadPublishedBookingSite(input.slug);
  if (!site) {
    throw new Error("Reservas web no disponibles para este sitio");
  }

  const link = site.propertyLinks.find((row) => row.property.id === input.propertyId);
  if (!link) {
    throw new Error("Propiedad no publicada en este sitio");
  }

  const property = link.property;
  // Defense in depth: linked property must belong to the site organization.
  const propertyOrg = await db.property.findFirst({
    where: { id: property.id, organizationId: site.organizationId },
    select: { id: true },
  });
  if (!propertyOrg) {
    throw new Error("Propiedad no pertenece a este tenant");
  }
  const guestTotal = input.adults + input.children + input.infants;
  if (guestTotal > property.maxGuests) {
    throw new Error(
      `Máximo ${property.maxGuests} huésped${property.maxGuests === 1 ? "" : "es"} en esta unidad`,
    );
  }

  const checkIn = dateKeyToPrismaDate(input.checkIn);
  const checkOut = dateKeyToPrismaDate(input.checkOut);
  if (checkOut <= checkIn) {
    throw new Error("La fecha de salida debe ser posterior al check-in");
  }

  if (input.policiesAccepted !== true) {
    throw new Error("Debes aceptar las políticas para continuar");
  }

  const guestName = buildGuestName(input.guestFirstName, input.guestLastName);
  const status = deriveReservationStatusFromDates(checkIn, checkOut, {
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
  });

  // Never trust client totals — underpaying (or totalAmount: 0) would mark PAID.
  const nights = countNights(checkIn, checkOut);
  const baseRate = decimalToNumber(property.baseRate);
  const cleaningFee = decimalToNumber(property.cleaningFee);
  const quote = quoteStay(nights, baseRate, cleaningFee, property.currency || site.currency);
  const totalAmount = Math.max(0, quote.total);
  if (
    Number.isFinite(input.totalAmount) &&
    Math.abs(input.totalAmount - totalAmount) > 1
  ) {
    throw new Error(
      "El total enviado no coincide con la tarifa actual. Actualiza la cotización e intenta de nuevo.",
    );
  }
  const paymentStatus: PaymentStatus =
    totalAmount > 0 ? PaymentStatus.PENDING : PaymentStatus.PAID;
  const idem = input.idempotencyKey?.trim() || null;
  const internalNotes = [
    `[WEB_BUILDER] origen=web_directa slug=${site.slug} propertyId=${property.id}`,
    idem ? `idempotency=${idem}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (idem) {
    const existing = await db.reservation.findFirst({
      where: {
        propertyId: property.id,
        platform: BookingPlatform.DIRECT,
        internalNotes: { contains: `idempotency=${idem}` },
      },
      select: { id: true, status: true, paymentStatus: true },
    });
    if (existing) {
      const existingRow = await db.reservation.findUnique({
        where: { id: existing.id },
        select: { totalAmount: true, reservationCode: true },
      });
      const replayTotal = decimalToNumber(existingRow?.totalAmount);
      const paymentHold = await loadWebBookingPaymentHoldForReservation({
        organizationId: site.organizationId,
        reservationId: existing.id,
        totalAmount: replayTotal,
      });
      // Reuse existing registration link; never email/WhatsApp for web bookings.
      const guestRegistrationUrl =
        await ensureGuestRegistrationForReservation(existing.id);
      return {
        reservationId: existing.id,
        reservationCode: existingRow?.reservationCode ?? null,
        status: existing.status,
        paymentStatus: existing.paymentStatus,
        idempotentReplay: true as const,
        paymentHold,
        guestRegistrationUrl,
      };
    }
  }

  const created = await db.$transaction(
    async (tx) => {
      // Serialize concurrent web bookings for the same unit (Neon READ COMMITTED).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${property.id}))`;

      const conflict = await tx.reservation.findFirst({
        where: {
          propertyId: property.id,
          status: { notIn: [ReservationStatus.CANCELLED] },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
        select: {
          id: true,
          guestName: true,
          status: true,
          checkIn: true,
          checkOut: true,
        },
      });
      if (conflict) {
        throw new ReservationConflictError(
          conflict.status === "BLOCKED"
            ? `Las fechas están bloqueadas. Elige otras fechas.`
            : `Las fechas chocan con «${conflict.guestName}». Elige otras fechas.`,
        );
      }

      return tx.reservation.create({
        data: {
          propertyId: property.id,
          guestName,
          guestFirstName: input.guestFirstName.trim(),
          guestLastName: input.guestLastName.trim(),
          guestEmail: input.guestEmail?.trim() || null,
          guestPhone: input.guestPhone?.trim() || null,
          adults: input.adults,
          children: input.children,
          infants: input.infants,
          checkIn,
          checkOut,
          platform: BookingPlatform.DIRECT,
          status,
          paymentStatus,
          totalAmount,
          reservationCode: generateWebDirectReservationCode(),
          internalNotes,
        },
        include: {
          property: {
            select: { id: true, ownerId: true },
          },
        },
      });
    },
    { timeout: 20_000 },
  );

  await touchPropertyIcalExport(property.id);

  await emitBookingConfirmed({
    reservationId: created.id,
    propertyId: created.propertyId,
    ownerId: created.property.ownerId,
  }).catch(() => undefined);

  let paymentHold: WebBookingPaymentHold = {
    paymentRequired: false,
    checkoutUrl: null,
  };

  if (totalAmount > 0) {
    const actorId = await resolveOrgReservationActorId(site.organizationId);
    await activateReservationPaymentHold({
      reservationId: created.id,
      createdById: actorId,
      totalAmount,
    });

    const currency =
      property.currency?.trim() || site.currency?.trim() || "COP";
    paymentHold = await resolveWebBookingPaymentHold({
      organizationId: site.organizationId,
      reservationId: created.id,
      propertyId: property.id,
      createdById: actorId,
      totalAmount,
      guestName,
      currency,
      guestEmail: input.guestEmail,
    });
  }

  // Web bookings: create registration token immediately and return URL for
  // client redirect. Do NOT send email/WhatsApp (Airbnb keeps its own channel).
  let guestRegistrationUrl: string | null = null;
  if (
    isGuestRegistrationEligiblePlatform(created.platform) &&
    isGuestRegistrationEligibleStatus(created.status)
  ) {
    guestRegistrationUrl = await ensureGuestRegistrationForReservation(
      created.id,
    );
  }

  return {
    reservationId: created.id,
    reservationCode: created.reservationCode,
    status: created.status,
    paymentStatus: created.paymentStatus,
    idempotentReplay: false as const,
    paymentHold,
    guestRegistrationUrl,
  };
}