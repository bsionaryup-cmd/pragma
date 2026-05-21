import type {
  BookingPlatform,
  PropertyStatus,
  PropertyType,
  ReservationStatus,
} from "@prisma/client";

export type CalendarPropertyPricingDto = {
  baseRate: string | null;
  recommendedRate: string | null;
  priceDelta: string | null;
};

export type CalendarPropertyDto = {
  id: string;
  name: string;
  address: string;
  city: string;
  propertyType: PropertyType;
  status: PropertyStatus;
  coverImageUrl: string | null;
  pricing: CalendarPropertyPricingDto | null;
};

export type CalendarReservationDto = {
  id: string;
  propertyId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  totalAmount: string;
  currency: string;
  platform: BookingPlatform;
};

export type CalendarDataDto = {
  properties: CalendarPropertyDto[];
  reservations: CalendarReservationDto[];
  viewport: CalendarViewport;
};

export type CalendarDayMeta = {
  date: string;
  dayOfMonth: number;
  dayOfWeek: number;
  isToday: boolean;
  isWeekend: boolean;
  isCurrentMonth: boolean;
  label: string;
  weekdayShort: string;
};

export type CalendarViewport = {
  anchor: string;
  year: number;
  month: number;
  rangeStart: string;
  rangeEnd: string;
  days: CalendarDayMeta[];
  gridWidth: number;
};

export type CalendarDateSelection = {
  propertyId: string;
  checkIn: string;
  checkOut: string | null;
};

export type ReservationSpan = {
  reservationId: string;
  startCol: number;
  spanCols: number;
  leftPx: number;
  widthPx: number;
  /** Borde redondeado al inicio (check-in visible). */
  roundedStart: boolean;
  /** Borde redondeado al final (check-out visible). */
  roundedEnd: boolean;
};

export type ReservationVisualState =
  | "confirmed"
  | "in_stay"
  | "checkout_today"
  | "checked_out"
  | "blocked";
