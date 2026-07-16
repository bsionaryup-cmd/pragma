import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool, type PoolConfig } from "pg";

/**
 * Debe coincidir con la última migración de schema.
 * Si cambia, el singleton en dev se recrea (evita cliente Prisma obsoleto en memoria).
 */
const PRISMA_SCHEMA_VERSION = "20260716160000_guest_registration_invite_email_log";

type PrismaGlobal = {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
  prismaSchemaVersion: string | undefined;
};

const globalForPrisma = globalThis as unknown as PrismaGlobal;

function getPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está configurada");
  }

  return {
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  };
}

function getPool(): Pool {
  if (!globalForPrisma.pool) {
    const pool = new Pool(getPoolConfig());
    pool.on("error", (err) => {
      console.error("[db] Error en pool PostgreSQL:", err.message);
    });
    globalForPrisma.pool = pool;
  }
  return globalForPrisma.pool;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(getPool());
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

async function disconnectAll(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
  if (globalForPrisma.pool) {
    await globalForPrisma.pool.end();
    globalForPrisma.pool = undefined;
  }
  globalForPrisma.prismaSchemaVersion = undefined;
}

function createAndCacheClient(): PrismaClient {
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
  return client;
}

function runtimeHasSupplierWhatsapp(client: PrismaClient): boolean {
  const models = (client as unknown as { _runtimeDataModel?: { models?: Record<string, { fields?: Array<{ name: string }> }> } })
    ._runtimeDataModel?.models;
  const fields = models?.RetailSupplier?.fields ?? [];
  return fields.some((field) => field.name === "whatsapp");
}

function hasCoreDelegates(client: PrismaClient): boolean {
  return Boolean(client.mobilityAlly) && Boolean(client.retailStore);
}

function hasIntelDelegates(client: PrismaClient): boolean {
  return Boolean(client.retailProductIntelProfile) && Boolean(client.retailIntelOutbox);
}

function getPrismaClient(): PrismaClient {
  const stale =
    globalForPrisma.prisma &&
    globalForPrisma.prismaSchemaVersion !== PRISMA_SCHEMA_VERSION;

  if (stale) {
    const oldPrisma = globalForPrisma.prisma;
    const oldPool = globalForPrisma.pool;
    globalForPrisma.prisma = undefined;
    globalForPrisma.pool = undefined;
    globalForPrisma.prismaSchemaVersion = undefined;
    void (async () => {
      try {
        await oldPrisma?.$disconnect();
        await oldPool?.end();
      } catch (err) {
        console.error("[db] Error al reciclar cliente Prisma:", err);
      }
    })();
  }

  let client = globalForPrisma.prisma ?? createAndCacheClient();

  const needsRecycle =
    !hasCoreDelegates(client) ||
    !hasIntelDelegates(client) ||
    !runtimeHasSupplierWhatsapp(client);

  if (needsRecycle) {
    console.warn("[db] Reciclando cliente Prisma (delegados/schema incompletos)…");
    globalForPrisma.prisma = undefined;
    client = createAndCacheClient();
  }

  if (!hasCoreDelegates(client) || !runtimeHasSupplierWhatsapp(client)) {
    throw new Error(
      "[db] Prisma Client desactualizado (falta schema RetailSupplier.whatsapp). Ejecuta: npx prisma generate && npm run dev:clean && npm run dev",
    );
  }

  if (!hasIntelDelegates(client)) {
    console.error(
      "[db] Faltan delegados Inventory Intelligence. Ejecuta: npx prisma generate && npm run dev:clean",
    );
  }

  return client;
}

/** Proxy para que `resetPrismaClient()` invalide el cliente en caliente (dev/HMR). */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

/** Fuerza un cliente Prisma nuevo tras cambios de schema (dev/HMR). */
export function resetPrismaClient(): void {
  void disconnectAll();
}
