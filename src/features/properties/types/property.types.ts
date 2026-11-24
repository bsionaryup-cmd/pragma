import type {
  PropertyStatus,
  PropertyType,
  ReservationStatus,
} from "@prisma/client";

export type PropertyUpcomingReservation = {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
};

export type PropertyGridItem = {
  id: string;
  name: string;
  unitNumber: string | null;
  city: string;
  country: string;
  neighborhood: string | null;
  coverImageUrl: string | null;
  propertyType: PropertyType;
  status: PropertyStatus;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: string;
  nextReservation: PropertyUpcomingReservation | null;
  upcomingCount: number;
  monthOccupancyPercent: number;
};

export type PropertyDetailDto = PropertyGridItem & {
  description: string | null;
  address: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  accessCode: string | null;
  accessInstructions: string | null;
  wifiName: string | null;
  wifiPassword: string | null;
  houseRules: string | null;
  baseRate: string | null;
  cleaningFee: string | null;
  currency: string;
  upcomingReservations: PropertyUpcomingReservation[];
  monthRevenue: string;
  createdAt: string;
  airbnbListingUrl: string | null;
  icalUrl: string | null;
  lastIcalSyncedAt: string | null;
  /** Multiline text for the property form (one email per line). */
  notificationEmails: string;
  operationalContacts: Array<{
    key: string;
    name: string;
    role: string;
    email: string;
    whatsapp: string;
    isActive: boolean;
  }>;
  guestRegistrationContactKey: string;
  receptionWhatsapp: string;
  smartAccess?: {
    lock: import("@/modules/integrations/ttlock/ttlock.types").SmartLockSnapshot | null;
    integrationConnected: boolean;
  };
};
