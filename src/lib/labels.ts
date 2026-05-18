import {
  BookingPlatform,
  PropertyStatus,
  PropertyType,
  ReservationStatus,
  TaskStatus,
  TaskType,
} from "@prisma/client";

export const propertyTypeLabels: Record<PropertyType, string> = {
  APARTMENT: "Apartamento",
  HOUSE: "Casa",
  STUDIO: "Estudio",
  ROOM: "Habitación",
  OTHER: "Otro",
};

export const propertyStatusLabels: Record<PropertyStatus, string> = {
  ACTIVE: "Activa",
  INACTIVE: "Inactiva",
  MAINTENANCE: "Mantenimiento",
};

export const platformLabels: Record<BookingPlatform, string> = {
  AIRBNB: "Airbnb",
  BOOKING: "Booking",
  DIRECT: "Directa",
};

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  CONFIRMED: "Confirmada",
  CHECKED_IN: "En curso",
  CHECKOUT_TODAY: "Checkout hoy",
  CHECKED_OUT: "Finalizada",
  CANCELLED: "Cancelada",
  BLOCKED: "Bloqueada",
};

export const taskTypeLabels: Record<TaskType, string> = {
  CLEANING: "Limpieza",
  CHECK_IN: "Check-in",
  MAINTENANCE: "Mantenimiento",
  LAUNDRY: "Lavandería",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};
