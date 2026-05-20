"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { airbnbImportSchema } from "@/features/properties/schemas/airbnb-import.schema";
import { requirePermission } from "@/lib/auth";
import { resetPrismaClient } from "@/lib/db";
import {
  fetchAirbnbListingPreview,
  normalizeAirbnbListingUrl,
  normalizeIcalUrl,
} from "@/services/airbnb/airbnb-import.service";
import { hasActiveAirbnbIcalImport } from "@/lib/airbnb/ical-sync-utils";
import { syncPropertyIcalCalendar } from "@/services/airbnb/airbnb-ical-sync.service";
import { ensurePropertyIcalExportToken } from "@/services/airbnb/ical-export.service";
import {
  createPropertyFromAirbnbImport,
  listPropertiesForGrid,
} from "@/services/properties/property.service";

function revalidatePropertyPaths() {
  revalidatePath("/properties");
  revalidatePath("/calendar");
  revalidatePath("/reservations");
  revalidatePath("/");
}

function isStalePrismaClientError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientValidationError)) return false;
  const msg = error.message;
  return (
    msg.includes("Unknown argument") &&
    (msg.includes("airbnbListingUrl") ||
      msg.includes("airbnbRoomId") ||
      msg.includes("icalUrl"))
  );
}

export async function previewAirbnbListingAction(listingUrl: string) {
  await requirePermission("properties:write");
  const preview = await fetchAirbnbListingPreview(listingUrl);
  return { success: true as const, preview };
}

export async function importAirbnbPropertyAction(input: {
  listingUrl: string;
  icalUrl: string;
}) {
  const user = await requirePermission("properties:write");
  const parsed = airbnbImportSchema.parse(input);

  const listingUrl = normalizeAirbnbListingUrl(parsed.listingUrl);
  const icalUrl = normalizeIcalUrl(parsed.icalUrl);
  if (!hasActiveAirbnbIcalImport(icalUrl)) {
    throw new Error("Enlace iCal de Airbnb inválido o vacío");
  }

  const preview = await fetchAirbnbListingPreview(listingUrl);

  let created;
  try {
    created = await createPropertyFromAirbnbImport(user.dbUserId, {
      ...preview,
      listingUrl,
      icalUrl,
    });
  } catch (error) {
    if (isStalePrismaClientError(error)) {
      resetPrismaClient();
      created = await createPropertyFromAirbnbImport(user.dbUserId, {
        ...preview,
        listingUrl,
        icalUrl,
      });
    } else {
      throw error;
    }
  }

  revalidatePropertyPaths();

  await ensurePropertyIcalExportToken(created.id);

  const initialSync = await syncPropertyIcalCalendar(created.id, user.dbUserId);
  if (initialSync.error) {
    console.warn(
      `[airbnb-import] Sync inicial falló para ${created.id}: ${initialSync.error}`,
    );
  }

  const grid = await listPropertiesForGrid(user.dbUserId);
  const property = grid.find((p) => p.id === created.id);
  if (!property) {
    throw new Error("No se pudo cargar la propiedad importada");
  }

  return { success: true as const, property };
}
