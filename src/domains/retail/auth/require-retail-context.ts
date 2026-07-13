import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getUserByClerkId } from "@/services/users/user.service";
import { findStoreForOrg } from "../services/store.service";

export type RetailContext = {
  userId: string;
  organizationId: string;
  storeId: string;
  storeName: string;
  email: string;
  firstName: string | null;
  store: { id: string; name: string; currency: string };
};

/**
 * Auth guard exclusivo de INTIENDAS.
 * Solo entra si el usuario tiene tienda retail activa (creada por Owner).
 * No crea tiendas automáticamente ni redirige a rutas PMS.
 */
export const requireRetailContext = cache(async (): Promise<RetailContext> => {
  const { userId } = await auth();
  if (!userId) redirect("/intiendas/login");

  const user = await getUserByClerkId(userId);
  if (!user || !user.isActive || user.deletedAt) {
    redirect("/intiendas/login");
  }
  if (!user.organizationId) redirect("/intiendas/login?no_org=1");

  const store = await findStoreForOrg(user.organizationId);
  if (!store) redirect("/intiendas/login?no_org=1");
  if (store.status === "INACTIVE" || store.deletedAt) {
    redirect("/intiendas/login?store_inactive=1");
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    storeId: store.id,
    storeName: store.name,
    email: user.email,
    firstName: user.firstName,
    store: { id: store.id, name: store.name, currency: store.currency },
  };
});
