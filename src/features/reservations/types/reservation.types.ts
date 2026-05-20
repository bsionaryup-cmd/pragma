import type {
  BookingPlatform,
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
  property: ReservationPropertyDto;
};

/** Detalle ampliado (calendario / drawer) con metadatos y bloqueos relacionados. */
export type ReservationDetailItem = ReservationInboxItem & {
  createdAt?: string;
  icalUid?: string | null;
  relatedBlocks?: ReservationRelatedBlock[];
};

export type PropertyOption = {
  id: string;
  name: string;
  address: string;
  city: string;
};
