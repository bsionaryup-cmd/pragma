import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool, type PoolConfig } from "pg";

/**
 * Debe coincidir con la última migración de schema.
 * Si cambia, el singleton en dev se recrea (evita cliente Prisma obsoleto en memoria).
 */
const PRISMA_SCHEMA_VERSION = "20260713120000_intiendas_retail_access_plan";

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

function hasRequiredDelegates(client: PrismaClient): boolean {
  return Boolean(client.mobilityAlly) && Boolean(client.retailStore);
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

  // Tras `prisma generate` + HMR, el singleton puede quedar sin delegados nuevos.
  if (!hasRequiredDelegates(client)) {
    console.warn("[db] Reciclando cliente Prisma (faltan modelos Mobility/Retail)…");
    globalForPrisma.prisma = undefined;
    globalForPrisma.pool = undefined;
    globalForPrisma.prismaSchemaVersion = undefined;
    client = createAndCacheClient();
  }

  if (!hasRequiredDelegates(client)) {
    throw new Error(
      "[db] Prisma Client incompleto. Ejecuta: npm run dev:clean && npx prisma generate && aplica la migración retail.",
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
