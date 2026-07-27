export type { User, Property, Reservation } from "@prisma/client";

export {
  UserRole,
  PropertyType,
  PropertyStatus,
  BookingPlatform,
  ReservationStatus,
  TaskStatus,
} from "@prisma/client";

export type { AppUserRole, AuthContext, ClerkUserPayload, SessionUser } from "@/types/auth";
