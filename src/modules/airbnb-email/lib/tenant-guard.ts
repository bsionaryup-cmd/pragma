import { db } from "@/lib/db";

export async function assertAirbnbEmailIntegrationEnabled(
  organizationId: string,
): Promise<void> {
  const integration = await db.tenantAirbnbEmailIntegration.findUnique({
    where: { organizationId },
    select: { enabled: true },
  });

  if (!integration?.enabled) {
    throw new Error("Airbnb Email Sync no está activo para este tenant");
  }
}

export async function assertPropertyInOrganization(
  propertyId: string,
  organizationId: string,
): Promise<void> {
  const property = await db.property.findFirst({
    where: { id: propertyId, organizationId },
    select: { id: true },
  });

  if (!property) {
    throw new Error("Propiedad fuera del tenant");
  }
}

export async function assertReservationInOrganization(
  reservationId: string,
  organizationId: string,
): Promise<void> {
  const reservation = await db.reservation.findFirst({
    where: { id: reservationId, property: { organizationId } },
    select: { id: true },
  });

  if (!reservation) {
    throw new Error("Reserva fuera del tenant");
  }
}
