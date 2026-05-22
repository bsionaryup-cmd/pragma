/**
 * Asigna rol ADMIN a un usuario por email (útil para el primer setup).
 * Uso: node scripts/set-admin-role.mjs [email]
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createClerkClient } from "@clerk/backend";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const email = process.argv[2];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

try {
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });

  if (users.length === 0) {
    console.error("No hay usuarios en la base de datos. Inicia sesión primero.");
    process.exit(1);
  }

  const target = email
    ? users.find((u) => u.email.toLowerCase() === email.toLowerCase())
    : users[0];

  if (!target) {
    console.error(`Usuario no encontrado: ${email}`);
    process.exit(1);
  }

  const existingOwner = users.find((u) => u.isAccountOwner);
  if (!existingOwner) {
    await db.user.update({
      where: { id: users[0].id },
      data: { isAccountOwner: true },
    });
    console.log(`✓ Dueño de cuenta asignado: ${users[0].email}`);
  }

  const updated = await db.user.update({
    where: { id: target.id },
    data: { role: "ADMIN", isActive: true },
  });

  await clerk.users.updateUser(updated.clerkId, {
    publicMetadata: {
      role: updated.role,
      dbUserId: updated.id,
    },
  });

  console.log("✓ Usuario actualizado a ADMIN:");
  console.log(`  Email: ${updated.email}`);
  console.log(`  ID:    ${updated.id}`);
  console.log("\nPermisos sincronizados en Clerk. Si la sesión sigue antigua, cierra sesión y vuelve a entrar.");
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await db.$disconnect();
  await pool.end();
}
