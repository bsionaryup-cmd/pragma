import type {
  PropertyStatus,
  PropertyType,
  ReservationStatus,
  TaskStatus,
  TaskType,
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

export type PropertyTaskItem = {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  dueDate: string | null;
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
  pendingTasks: PropertyTaskItem[];
  monthRevenue: string;
  createdAt: string;
  airbnbListingUrl: string | null;
  icalUrl: string | null;
  lastIcalSyncedAt: string | null;
};
