/**
 * Canonical guest model — single official guest source for PRAGMA.
 * Integrations (SIRE, TRA, TTLock, emails, AI Concierge) map FROM this shape.
 */

export type CanonicalGuestPlace = {
  country: string | null;
  adminArea: string | null;
  city: string | null;
};

export type CanonicalGuest = {
  id: string;
  reservationId: string;
  isPrimary: boolean;
  isReservationOwner: boolean;
  firstName: string;
  lastName: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string | null;
  /** E.164 when available (e.g. +573001234567). */
  phoneE164: string | null;
  nationalityIso: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  travelMotive: string | null;
  occupation: string | null;
  residence: CanonicalGuestPlace;
  origin: CanonicalGuestPlace;
  destination: CanonicalGuestPlace;
};

export type CanonicalStayContext = {
  reservationId: string;
  organizationId: string | null;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  platform: string;
  reservationCode: string | null;
  companionCount: number;
  roomLabel: string | null;
  totalAmount: string | null;
  currency: string | null;
  paymentMedium: string | null;
  bookingMedium: string | null;
};

/** Normalize stored phone (+57 300...) to E.164 (+57300...). */
export function toE164Phone(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) {
    const only = trimmed.replace(/\D/g, "");
    if (!only) return null;
    return `+${only}`;
  }
  const plus = digits.startsWith("+") ? "+" : "";
  const rest = digits.replace(/\D/g, "");
  return `${plus}${rest}`;
}

export function mapReservationGuestToCanonical(guest: {
  id: string;
  reservationId: string;
  isPrimary: boolean;
  isReservationOwner: boolean;
  firstName: string;
  lastName: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  dateOfBirth: Date | string | null;
  sex?: string | null;
  travelMotive?: string | null;
  occupation?: string | null;
  residenceCountry?: string | null;
  residenceAdminArea?: string | null;
  residenceCity?: string | null;
  originCountry?: string | null;
  originAdminArea?: string | null;
  originCity?: string | null;
  destinationCountry?: string | null;
  destinationAdminArea?: string | null;
  destinationCity?: string | null;
}): CanonicalGuest {
  const dob =
    guest.dateOfBirth instanceof Date
      ? guest.dateOfBirth.toISOString().slice(0, 10)
      : guest.dateOfBirth
        ? String(guest.dateOfBirth).slice(0, 10)
        : null;

  return {
    id: guest.id,
    reservationId: guest.reservationId,
    isPrimary: guest.isPrimary,
    isReservationOwner: guest.isReservationOwner,
    firstName: guest.firstName,
    lastName: guest.lastName,
    fullName: guest.fullName,
    documentType: guest.documentType,
    documentNumber: guest.documentNumber,
    email: guest.email,
    phoneE164: toE164Phone(guest.phone),
    nationalityIso: guest.nationality,
    dateOfBirth: dob,
    sex: guest.sex ?? null,
    travelMotive: guest.travelMotive ?? null,
    occupation: guest.occupation ?? null,
    residence: {
      country: guest.residenceCountry ?? null,
      adminArea: guest.residenceAdminArea ?? null,
      city: guest.residenceCity ?? null,
    },
    origin: {
      country: guest.originCountry ?? null,
      adminArea: guest.originAdminArea ?? null,
      city: guest.originCity ?? null,
    },
    destination: {
      country: guest.destinationCountry ?? null,
      adminArea: guest.destinationAdminArea ?? null,
      city: guest.destinationCity ?? null,
    },
  };
}

/** Future SIRE exporter — pure mapping, no I/O. */
export function mapCanonicalGuestToSirePayload(
  guest: CanonicalGuest,
  stay: CanonicalStayContext,
) {
  return {
    fullName: guest.fullName,
    nationality: guest.nationalityIso,
    documentType: guest.documentType,
    documentNumber: guest.documentNumber,
    dateOfBirth: guest.dateOfBirth,
    sex: guest.sex,
    occupation: guest.occupation,
    originCountry: guest.origin.country,
    originAdminArea: guest.origin.adminArea,
    originCity: guest.origin.city,
    destinationCountry: guest.destination.country,
    destinationAdminArea: guest.destination.adminArea,
    destinationCity: guest.destination.city,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
  };
}

/** Future TRA/SIAT exporter — pure mapping, no I/O. */
export function mapCanonicalGuestToTraPayload(
  guest: CanonicalGuest,
  stay: CanonicalStayContext,
) {
  return {
    roomLabel: stay.roomLabel,
    documentType: guest.documentType,
    documentNumber: guest.documentNumber,
    fullName: guest.fullName,
    dateOfBirth: guest.dateOfBirth,
    sex: guest.sex,
    nationality: guest.nationalityIso,
    travelMotive: guest.travelMotive,
    occupation: guest.occupation,
    residenceCountry: guest.residence.country,
    residenceAdminArea: guest.residence.adminArea,
    residenceCity: guest.residence.city,
    originCountry: guest.origin.country,
    originAdminArea: guest.origin.adminArea,
    originCity: guest.origin.city,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    companionCount: stay.companionCount,
    accommodationType: null as string | null,
    totalPaid: stay.totalAmount,
    paymentMedium: stay.paymentMedium,
    bookingMedium: stay.bookingMedium ?? stay.platform,
    role: guest.isReservationOwner ? "PRIMARY" : "COMPANION",
  };
}

export function isCanonicalGuestCompleteForGovernment(guest: CanonicalGuest): boolean {
  return Boolean(
    guest.firstName &&
      guest.lastName &&
      guest.documentType &&
      guest.documentNumber &&
      guest.nationalityIso &&
      guest.dateOfBirth &&
      guest.sex &&
      guest.travelMotive &&
      guest.occupation &&
      guest.residence.country &&
      guest.origin.country,
  );
}
