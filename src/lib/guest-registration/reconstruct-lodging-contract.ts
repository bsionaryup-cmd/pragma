import { prismaDateToKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { mapReservationGuestToCanonical } from "@/lib/guest-registration/canonical-guest";
import { formatPropertyLabel } from "@/lib/property-display";

export type ReconstructedLodgingContract = {
  reservationId: string;
  propertyLabel: string;
  checkIn: string;
  checkOut: string;
  platform: string;
  guests: Array<{
    fullName: string;
    documentType: string;
    documentNumber: string;
    role: "PRIMARY" | "COMPANION";
    nationalityIso: string | null;
    dateOfBirth: string | null;
  }>;
  acceptance: {
    acceptedAtUtc: string;
    lodgingContractVersion: string;
    lodgingContractText: string | null;
    habeasDataPolicyVersion: string;
    habeasDataText: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    locale: string;
    organizationId: string | null;
    titularFullName: string;
  } | null;
  reconstructableWithoutReaskingGuest: boolean;
};

/**
 * Rebuild lodging-contract evidence exclusively from persisted PRAGMA data.
 * Does not call the guest or mutate anything.
 */
export async function reconstructLodgingContractFromReservation(
  reservationId: string,
): Promise<ReconstructedLodgingContract | null> {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      platform: true,
      checkIn: true,
      checkOut: true,
      property: {
        select: { name: true, unitNumber: true, organizationId: true },
      },
      guests: {
        orderBy: [{ isReservationOwner: "desc" }, { createdAt: "asc" }],
      },
      guestRegistrationLegalAcceptance: true,
    },
  });

  if (!reservation) return null;

  const acceptance = reservation.guestRegistrationLegalAcceptance;
  const evidence =
    acceptance?.evidenceJson && typeof acceptance.evidenceJson === "object"
      ? (acceptance.evidenceJson as Record<string, unknown>)
      : null;

  return {
    reservationId: reservation.id,
    propertyLabel: formatPropertyLabel(reservation.property),
    checkIn: prismaDateToKey(reservation.checkIn),
    checkOut: prismaDateToKey(reservation.checkOut),
    platform: String(reservation.platform),
    guests: reservation.guests.map((guest) => {
      const canonical = mapReservationGuestToCanonical(guest);
      return {
        fullName: canonical.fullName,
        documentType: canonical.documentType,
        documentNumber: canonical.documentNumber,
        role: canonical.isReservationOwner ? "PRIMARY" : "COMPANION",
        nationalityIso: canonical.nationalityIso,
        dateOfBirth: canonical.dateOfBirth,
      };
    }),
    acceptance: acceptance
      ? {
          acceptedAtUtc: acceptance.acceptedAt.toISOString(),
          lodgingContractVersion: acceptance.lodgingContractVersion,
          lodgingContractText:
            typeof evidence?.lodgingContractText === "string"
              ? evidence.lodgingContractText
              : null,
          habeasDataPolicyVersion: acceptance.habeasDataPolicyVersion,
          habeasDataText:
            typeof evidence?.habeasDataText === "string"
              ? evidence.habeasDataText
              : null,
          ipAddress: acceptance.ipAddress,
          userAgent: acceptance.userAgent,
          locale: acceptance.locale,
          organizationId: acceptance.organizationId,
          titularFullName: acceptance.titularFullName,
        }
      : null,
    reconstructableWithoutReaskingGuest:
      reservation.guests.length > 0 && Boolean(acceptance),
  };
}
