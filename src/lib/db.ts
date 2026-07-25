import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool, type PoolConfig } from "pg";

/**
 * Bump when the Prisma schema changes so the dev singleton recycles.
 * Do not hard-require product models here — probes must never take down Owner/PMS.
 */
const PRISMA_SCHEMA_VERSION =
  "20260725010000_owner_db_guard_pms_core+no-retail-hard-throw";

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

/** Lodging PMS delegates required for Owner + tenant dashboards. */
function hasPmsCoreDelegates(client: PrismaClient): boolean {
  const c = client as unknown as Record<string, unknown>;
  return (
    Boolean(c.organization) &&
    Boolean(c.user) &&
    Boolean(c.property) &&
    Boolean(c.reservation)
  );
}

function hasConciergeDelegate(client: PrismaClient): boolean {
  return Boolean(
    (client as unknown as { conciergeConfiguration?: unknown }).conciergeConfiguration,
  );
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

  if (!hasPmsCoreDelegates(client)) {
    console.warn("[db] Reciclando cliente Prisma (faltan delegados PMS core)…");
    globalForPrisma.prisma = undefined;
    client = createAndCacheClient();
  }

  // Soft checks only — never throw on optional product/runtime probes.
  // Hard throws here take down Owner Dashboard and every authenticated page.
  if (!hasPmsCoreDelegates(client)) {
    console.error(
      "[db] Prisma Client incompleto (organization/user/property/reservation). Ejecuta: npx prisma generate",
    );
  } else if (!hasConciergeDelegate(client)) {
    console.warn(
      "[db] ConciergeConfiguration ausente en cliente Prisma (concierge puede fallar hasta regenerar).",
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
