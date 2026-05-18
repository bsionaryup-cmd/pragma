"use server";

import { revalidatePath } from "next/cache";
import {
  propertyFormSchema,
  type PropertyFormValues,
} from "@/features/properties/schemas/property.schema";
import type { PropertyDetailDto } from "@/features/properties/types/property.types";
import { requirePermission } from "@/lib/auth";
import {
  createProperty,
  deleteProperty,
  getPropertyDetail,
  listPropertiesForGrid,
  updateProperty,
} from "@/services/properties/property.service";

function revalidatePropertyPaths() {
  revalidatePath("/properties");
  revalidatePath("/calendar");
  revalidatePath("/reservations");
  revalidatePath("/");
}

export async function createPropertyAction(data: PropertyFormValues) {
  const user = await requirePermission("properties:write");
  const parsed = propertyFormSchema.parse(data);
  const created = await createProperty(user.dbUserId, parsed);
  revalidatePropertyPaths();

  const grid = await listPropertiesForGrid(user.dbUserId);
  const property = grid.find((p) => p.id === created.id);
  if (!property) {
    throw new Error("No se pudo cargar la propiedad creada");
  }

  return { success: true as const, property };
}

export async function updatePropertyAction(id: string, data: PropertyFormValues) {
  const user = await requirePermission("properties:write");
  const parsed = propertyFormSchema.parse(data);
  const result = await updateProperty(id, user.dbUserId, parsed);
  if (result.count === 0) throw new Error("Propiedad no encontrada");

  revalidatePropertyPaths();
  const detail = await getPropertyDetail(id, user.dbUserId);
  if (!detail) throw new Error("Propiedad no encontrada");

  return { success: true as const, property: detail };
}

export async function deletePropertyAction(id: string) {
  const user = await requirePermission("properties:write");
  const result = await deleteProperty(id, user.dbUserId);
  if (result.count === 0) throw new Error("Propiedad no encontrada");

  revalidatePropertyPaths();
  return { success: true as const };
}

export async function getPropertyDetailAction(
  id: string,
): Promise<PropertyDetailDto | null> {
  const user = await requirePermission("properties:read");
  return getPropertyDetail(id, user.dbUserId);
}
