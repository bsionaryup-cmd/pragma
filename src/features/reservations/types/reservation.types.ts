import type {
  BookingPlatform,
  GuestRegistrationStatus,
  ReservationStatus,
} from "@prisma/client";

export type ReservationPropertyDto = {
  id: string;
  name: string;
  address: string;
  city: string;
};

export type ReservationRelatedBlock = {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
};

export type ReservationGuestDto = {
  id: string;
  isPrimary: boolean;
  firstName: string;
  lastName: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string | null;
  phone: string | null;
};

export type ReservationGuestRegistrationDto = {
  token: string;
  url: string;
  status: GuestRegistrationStatus;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
};

export type ReservationInboxItem = {
  id: string;
  guestName: string;
  guestFirstName: string;
  guestLastName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCountry: string | null;
  guestLanguage: string | null;
  adults: number;
  children: number;
  infants: number;
  checkIn: string;
  checkOut: string;
  platform: BookingPlatform;
  status: ReservationStatus;
  totalAmount: string;
  currency: string;
  internalNotes: string | null;
  guestRegistrationUrl?: string | null;
  guestRegistrationCompletedAt?: string | null;
  guestRegistration?: ReservationGuestRegistrationDto | null;
  property: ReservationPropertyDto;
};

/** Detalle ampliado (calendario / drawer) con metadatos y bloqueos relacionados. */
export type ReservationDetailItem = ReservationInboxItem & {
  createdAt?: string;
  icalUid?: string | null;
  relatedBlocks?: ReservationRelatedBlock[];
  guests?: ReservationGuestDto[];
};

export type PropertyOption = {
  id: string;
  name: string;
  address: string;
  city: string;
};
