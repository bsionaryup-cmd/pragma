import type {
  BookingPlatform,
  GuestRegistrationStatus,
  PaymentStatus,
  PropertyType,
  ReservationGuestStatus,
  ReservationStatus,
} from "@prisma/client";

export type ReservationPropertyDto = {
  id: string;
  name: string;
  unitNumber?: string | null;
  address: string;
  city: string;
  propertyType?: PropertyType;
  checkInTime?: string | null;
  checkOutTime?: string | null;
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
  isReservationOwner: boolean;
  status: ReservationGuestStatus;
  firstName: string;
  lastName: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
};

export type ReservationAccessCodeDto = {
  status: string;
  code: string | null;
  isActive: boolean;
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
  createdAt?: string;
  platform: BookingPlatform;
  status: ReservationStatus;
  paymentStatus?: PaymentStatus;
  holdExpiresAt?: string | null;
  totalAmount: string;
  currency: string;
  internalNotes: string | null;
  guestRegistrationUrl?: string | null;
  guestRegistrationCompletedAt?: string | null;
  guestRegistration?: ReservationGuestRegistrationDto | null;
  guestRegistrationProgress?: {
    registered: number;
    capacity: number;
  } | null;
  accessCode?: ReservationAccessCodeDto | null;
  property: ReservationPropertyDto & { maxGuests?: number };
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
  unitNumber?: string | null;
  address: string;
  city: string;
  maxGuests?: number;
};
