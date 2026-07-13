import { db } from "@/lib/db";
import { ensureDefaultRegister } from "./cash.service";

export class RetailStoreInactiveError extends Error {
  constructor() {
    super("Retail store is inactive");
    this.name = "RetailStoreInactiveError";
  }
}

export async function findStoreForOrg(organizationId: string) {
  return db.retailStore.findUnique({ where: { organizationId } });
}

export async function getOrCreateStoreForOrg(
  organizationId: string,
  createdByUserId?: string,
  name = "Mi Tienda",
) {
  let store = await findStoreForOrg(organizationId);

  if (store && (store.status === "INACTIVE" || store.deletedAt)) {
    throw new RetailStoreInactiveError();
  }

  if (!store) {
    store = await db.retailStore.create({
      data: { organizationId, name, createdByUserId },
    });
  }

  await ensureDefaultRegister(store.id);
  return store;
}
