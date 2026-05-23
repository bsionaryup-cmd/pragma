import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

type PriceLabsOrgStore = {
  organizationId: string;
};

const store = new AsyncLocalStorage<PriceLabsOrgStore>();

export function runWithPriceLabsOrganization<T>(
  organizationId: string,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return store.run({ organizationId }, fn);
}

export function requirePriceLabsOrganizationId(): string {
  const ctx = store.getStore();
  if (!ctx?.organizationId) {
    throw new Error("PriceLabs: contexto de organización no disponible");
  }
  return ctx.organizationId;
}

export function getPriceLabsOrganizationId(): string | null {
  return store.getStore()?.organizationId ?? null;
}
