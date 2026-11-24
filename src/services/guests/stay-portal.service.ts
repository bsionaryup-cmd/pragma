import "server-only";

import {
  AccessCredentialStatus,
  ReservationStatus,
  StayPortalTokenStatus,
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import { formatAccessCode } from "@/lib/access-code";
import { getPublicAppUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/helpers/date";
import {
  normalizeStayReservationCode,
  type StayPortalState,
  type StayPortalView,
} from "@/lib/guest-registration/stay-portal-access";
import {
  findOperationalContactByKey,
  parseOperationalContacts,
  resolveGuestRegistrationAdminRecipients,
  type OperationalContact,
} from "@/lib/operational-contacts";
import { formatPropertyLabel } from "@/lib/property-display";
import { decryptTTLockSecret } from "@/services/integrations/ttlock/ttlock-crypto";

export type { StayPortalState, StayPortalView };
export {
  buildStayPortalAccessRateLimitKey,
  checkStayPortalAccessRateLimit,
  checkStayPortalAccessRateLimits,
  normalizeStayReservationCode,
} from "@/lib/guest-registration/stay-portal-access";

/** Stay portal available through checkout day (local calendar date). */
const PORTAL_ELIGIBLE_STATUSES: ReservationStatus[] = [
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
  ReservationStatus.CHECKOUT_TODAY,
];

function emptyStayPortalView(
  state: StayPortalState,
  token: string | null = null,
): StayPortalView {
  return {
    state,
    token,
    propertyLabel: null,
    unitNumber: null,
    guestName: null,
    reservationCode: null,
    checkInLabel: null,
    checkOutLabel: null,
    statusLabel: null,
    accessCode: null,
    accessValidFrom: null,
    accessValidTo: null,
    addressLine: null,
    locationLabel: null,
    coverImageUrl: null,
    mapsUrl: null,
    wifiName: null,
    wifiPassword: null,
    checkInTime: null,
    checkOutTime: null,
    accessInstructions: null,
    houseRules: null,
    contactName: null,
    contactWhatsapp: null,
    contactPhone: null,
    whatsappUrl: null,
    telUrl: null,
  };
}

export function buildStayPortalUrl(token: string): string {
  return `${getPublicAppUrl()}/stay/${encodeURIComponent(token)}`;
}

function buildMapsUrl(input: {
  address: string;
  city: string;
  country: string;
  neighborhood?: string | null;
}): string | null {
  const parts = [
    input.address.trim(),
    input.neighborhood?.trim(),
    input.city.trim(),
    input.country.trim(),
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
}

function buildWhatsappUrl(whatsapp: string | null): string | null {
  if (!whatsapp?.trim()) return null;
  const digits = whatsapp.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function buildTelUrl(phone: string | null): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;
  return `tel:${digits}`;
}

function resolveContact(property: {
  notificationEmails: unknown;
  operationalContacts: unknown;
  guestRegistrationContactKey: string | null;
  receptionWhatsapp: string | null;
}): OperationalContact | null {
  const ops = resolveGuestRegistrationAdminRecipients({
    notificationEmails: property.notificationEmails,
    operationalContacts: property.operationalContacts,
    guestRegistrationContactKey: property.guestRegistrationContactKey,
  });
  const contacts = parseOperationalContacts(property.operationalContacts);
  return (
    ops.selectedContact ??
    findOperationalContactByKey(
      contacts,
      property.guestRegistrationContactKey,
    ) ??
    contacts.find((c) => c.isActive) ??
    (property.receptionWhatsapp?.trim()
      ? {
          key: "legacy-reception",
          name: "Recepción",
          role: "Recepción",
          email: null,
          whatsapp: property.receptionWhatsapp.trim(),
          isActive: true,
        }
      : null)
  );
}

function statusLabel(status: ReservationStatus): string {
  switch (status) {
    case ReservationStatus.CHECKED_IN:
      return "En estadía";
    case ReservationStatus.CHECKOUT_TODAY:
      return "Salida hoy";
    case ReservationStatus.CHECKED_OUT:
      return "Finalizada";
    case ReservationStatus.CONFIRMED:
      return "Confirmada";
    case ReservationStatus.CANCELLED:
      return "Cancelada";
    default:
      return status;
  }
}

/**
 * Idempotent: reuses ACTIVE token for the reservation after GR is complete.
 */
export async function ensureStayPortalTokenForReservation(
  reservationId: string,
): Promise<string | null> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      checkOut: true,
      guestRegistrationCompletedAt: true,
      status: true,
    },
  });

  if (!reservation?.guestRegistrationCompletedAt) return null;
  if (
    reservation.status === ReservationStatus.CANCELLED ||
    reservation.status === ReservationStatus.BLOCKED
  ) {
    return null;
  }

  const existing = await db.stayPortalToken.findFirst({
    where: { reservationId, status: StayPortalTokenStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
  if (existing?.token) return existing.token;

  const token = randomBytes(24).toString("hex");
  // Expire at end of checkout calendar day + 1 day buffer (UTC noon-safe via Date).
  const checkOut = new Date(reservation.checkOut);
  const expiresAt = new Date(checkOut);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 2);

  await db.stayPortalToken.create({
    data: {
      reservationId,
      token,
      status: StayPortalTokenStatus.ACTIVE,
      expiresAt,
    },
  });

  return token;
}

async function loadStayPortalPayload(reservationId: string) {
  return db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      checkIn: true,
      checkOut: true,
      status: true,
      guestRegistrationCompletedAt: true,
      property: {
        select: {
          name: true,
          unitNumber: true,
          address: true,
          city: true,
          country: true,
          neighborhood: true,
          checkInTime: true,
          checkOutTime: true,
          wifiName: true,
          wifiPassword: true,
          houseRules: true,
          accessInstructions: true,
          coverImageUrl: true,
          receptionWhatsapp: true,
          notificationEmails: true,
          operationalContacts: true,
          guestRegistrationContactKey: true,
        },
      },
      accessCredentials: {
        where: {
          status: {
            in: [
              AccessCredentialStatus.GENERATED,
              AccessCredentialStatus.SENT,
              AccessCredentialStatus.ACTIVE,
            ],
          },
          ttlockCodeId: { not: null },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          codeEncrypted: true,
          validFrom: true,
          validTo: true,
        },
      },
    },
  });
}

function toStayPortalView(
  token: string | null,
  reservation: NonNullable<Awaited<ReturnType<typeof loadStayPortalPayload>>>,
  stateOverride?: StayPortalState,
): StayPortalView {
  if (!reservation.guestRegistrationCompletedAt) {
    return emptyStayPortalView("incomplete", token);
  }

  const ended =
    reservation.status === ReservationStatus.CHECKED_OUT ||
    reservation.status === ReservationStatus.CANCELLED ||
    reservation.status === ReservationStatus.BLOCKED ||
    !PORTAL_ELIGIBLE_STATUSES.includes(reservation.status);

  const state = stateOverride ?? (ended ? "ended" : "active");
  if (state === "ended" || state === "unavailable") {
    return {
      ...emptyStayPortalView(state, token),
      propertyLabel: formatPropertyLabel(reservation.property),
      guestName: reservation.guestName,
      checkInLabel: formatDate(reservation.checkIn),
      checkOutLabel: formatDate(reservation.checkOut),
      statusLabel: statusLabel(reservation.status),
    };
  }

  const property = reservation.property;
  const credential = reservation.accessCredentials[0] ?? null;
  let accessCode: string | null = null;
  try {
    if (credential?.codeEncrypted) {
      accessCode = formatAccessCode(
        decryptTTLockSecret(credential.codeEncrypted),
      );
    }
  } catch {
    accessCode = null;
  }

  const contact = resolveContact(property);
  const whatsapp = contact?.whatsapp ?? property.receptionWhatsapp;
  const phone = contact?.whatsapp ?? null;

  return {
    state: "active",
    token,
    propertyLabel: formatPropertyLabel(property),
    unitNumber: property.unitNumber?.trim() || null,
    guestName: reservation.guestName,
    reservationCode: reservation.reservationCode,
    checkInLabel: formatDate(reservation.checkIn),
    checkOutLabel: formatDate(reservation.checkOut),
    statusLabel: statusLabel(reservation.status),
    accessCode,
    accessValidFrom: credential?.validFrom
      ? formatDateTime(credential.validFrom)
      : null,
    accessValidTo: credential?.validTo
      ? formatDateTime(credential.validTo)
      : null,
    addressLine: [property.address, property.city, property.country]
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(", "),
    locationLabel: [property.neighborhood, property.city]
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(", ") || null,
    coverImageUrl: property.coverImageUrl?.trim() || null,
    mapsUrl: buildMapsUrl(property),
    wifiName: property.wifiName?.trim() || null,
    wifiPassword: property.wifiPassword?.trim() || null,
    checkInTime: property.checkInTime?.trim() || "15:00",
    checkOutTime: property.checkOutTime?.trim() || "13:00",
    accessInstructions: property.accessInstructions?.trim() || null,
    houseRules: property.houseRules?.trim() || null,
    contactName: contact?.name ?? null,
    contactWhatsapp: whatsapp?.trim() || null,
    contactPhone: phone?.trim() || null,
    whatsappUrl: buildWhatsappUrl(whatsapp),
    telUrl: buildTelUrl(phone ?? whatsapp),
  };
}

export async function getStayPortalByToken(
  token: string,
): Promise<StayPortalView> {
  const raw = token.trim();
  if (!raw) return emptyStayPortalView("not_found");

  const row = await db.stayPortalToken.findUnique({
    where: { token: raw },
    select: {
      id: true,
      token: true,
      status: true,
      expiresAt: true,
      reservationId: true,
    },
  });

  if (!row) return emptyStayPortalView("not_found");

  if (
    row.status === StayPortalTokenStatus.REVOKED ||
    row.status === StayPortalTokenStatus.EXPIRED
  ) {
    return emptyStayPortalView("unavailable", row.token);
  }

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    await db.stayPortalToken.update({
      where: { id: row.id },
      data: { status: StayPortalTokenStatus.EXPIRED },
    });
    return emptyStayPortalView("ended", row.token);
  }

  const reservation = await loadStayPortalPayload(row.reservationId);
  if (!reservation) return emptyStayPortalView("not_found", row.token);

  await db.stayPortalToken
    .update({
      where: { id: row.id },
      data: { lastAccessAt: new Date() },
    })
    .catch(() => undefined);

  return toStayPortalView(row.token, reservation);
}

export type StayPortalCodeAccessResult =
  | { ok: true; url: string }
  | {
      ok: false;
      reason:
        | "not_found"
        | "rate_limited"
        | "registration_pending"
        | "ended"
        | "ambiguous";
      /** When GR is still pending, link to complete registration. */
      registrationUrl?: string;
    };

/**
 * Lookup by reservation code for any platform.
 * Fail-closed on ambiguous matches. Lazily issues StayPortalToken when GR is done.
 */
export async function resolveStayPortalByReservationCode(input: {
  reservationCode: string;
}): Promise<StayPortalCodeAccessResult> {
  const reservationCode = normalizeStayReservationCode(input.reservationCode);
  if (!reservationCode) return { ok: false, reason: "not_found" };

  const matches = await db.reservation.findMany({
    where: {
      reservationCode: {
        equals: reservationCode,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      platform: true,
      status: true,
      guestRegistrationCompletedAt: true,
    },
    take: 3,
  });

  if (matches.length === 0) return { ok: false, reason: "not_found" };
  if (matches.length !== 1) return { ok: false, reason: "ambiguous" };

  const reservation = matches[0]!;

  if (
    reservation.status === ReservationStatus.CHECKED_OUT ||
    reservation.status === ReservationStatus.CANCELLED ||
    reservation.status === ReservationStatus.BLOCKED ||
    !PORTAL_ELIGIBLE_STATUSES.includes(reservation.status)
  ) {
    return { ok: false, reason: "ended" };
  }

  if (!reservation.guestRegistrationCompletedAt) {
    // ensureGuestRegistrationForReservation already returns a full URL.
    const { ensureGuestRegistrationForReservation } = await import(
      "@/services/guests/guest-registration.service"
    );
    const registrationUrl = await ensureGuestRegistrationForReservation(
      reservation.id,
    ).catch(() => null);
    return {
      ok: false,
      reason: "registration_pending",
      registrationUrl: registrationUrl ?? "/guest-registration",
    };
  }

  const token = await ensureStayPortalTokenForReservation(reservation.id);
  if (!token) return { ok: false, reason: "not_found" };

  return { ok: true, url: buildStayPortalUrl(token) };
}

export async function getStayPortalUrlForReservation(
  reservationId: string,
): Promise<string | null> {
  const token = await ensureStayPortalTokenForReservation(reservationId);
  return token ? buildStayPortalUrl(token) : null;
}

/** Used when GR token page is revisited after completion. */
export async function getStayPortalUrlForGuestRegistrationToken(
  guestRegistrationToken: string,
): Promise<string | null> {
  const row = await db.guestRegistrationToken.findUnique({
    where: { token: guestRegistrationToken },
    select: { reservationId: true },
  });
  if (!row) return null;
  return getStayPortalUrlForReservation(row.reservationId);
}
