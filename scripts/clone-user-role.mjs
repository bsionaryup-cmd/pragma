/**
 * Copia el rol de un usuario a otro (PostgreSQL + Clerk metadata).
 * Uso: node scripts/clone-user-role.mjs <sourceEmail> <targetEmail>
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createClerkClient } from "@clerk/backend";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const sourceEmail = process.argv[2];
const targetEmail = process.argv[3];

if (!sourceEmail || !targetEmail) {
  console.error("Uso: node scripts/clone-user-role.mjs <sourceEmail> <targetEmail>");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function findClerkUserByEmail(email) {
  const list = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 5,
  });
  return (
    list.data.find(
      (u) =>
        u.emailAddresses.some(
          (e) => e.emailAddress.toLowerCase() === email.toLowerCase(),
        ),
    ) ?? null
  );
}

try {
  const source = await db.user.findFirst({
    where: { email: { equals: sourceEmail, mode: "insensitive" } },
  });

  if (!source) {
    console.error(`Usuario origen no encontrado en DB: ${sourceEmail}`);
    console.error("Debe haber iniciado sesión al menos una vez.");
    process.exit(1);
  }

  console.log(`Origen: ${source.email} → rol ${source.role}`);

  let targetClerk = await findClerkUserByEmail(targetEmail);

  if (!targetClerk) {
    console.log(`Creando usuario en Clerk: ${targetEmail}`);
    targetClerk = await clerk.users.createUser({
      emailAddress: [targetEmail],
      skipPasswordRequirement: true,
      publicMetadata: {
        role: source.role,
        dbUserId: "pending",
      },
    });
    console.log(`✓ Usuario Clerk creado: ${targetClerk.id}`);
  }

  const primaryEmail =
    targetClerk.emailAddresses.find((e) => e.id === targetClerk.primaryEmailAddressId)
      ?.emailAddress ??
    targetClerk.emailAddresses[0]?.emailAddress ??
    targetEmail;

  const existing = await db.user.findUnique({
    where: { clerkId: targetClerk.id },
  });

  let targetDb;

  if (existing) {
    targetDb = await db.user.update({
      where: { clerkId: targetClerk.id },
      data: {
        email: primaryEmail,
        role: source.role,
        isActive: true,
        firstName: targetClerk.firstName ?? existing.firstName,
        lastName: targetClerk.lastName ?? existing.lastName,
        imageUrl: targetClerk.imageUrl ?? existing.imageUrl,
      },
    });
    console.log(`✓ Usuario DB actualizado`);
  } else {
    targetDb = await db.user.create({
      data: {
        clerkId: targetClerk.id,
        email: primaryEmail,
        firstName: targetClerk.firstName ?? null,
        lastName: targetClerk.lastName ?? null,
        imageUrl: targetClerk.imageUrl || null,
        role: source.role,
        isActive: true,
      },
    });
    console.log(`✓ Usuario DB creado`);
  }

  await clerk.users.updateUser(targetClerk.id, {
    publicMetadata: {
      role: targetDb.role,
      dbUserId: targetDb.id,
    },
  });

  console.log("\nListo:");
  console.log(`  Email:  ${targetDb.email}`);
  console.log(`  Rol:    ${targetDb.role}`);
  console.log(`  DB ID:  ${targetDb.id}`);
  console.log(`  Clerk:  ${targetDb.clerkId}`);
  console.log(
    `\nEl usuario debe iniciar sesión con ${targetDb.email} (magic link o contraseña en Clerk).`,
  );
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await db.$disconnect();
  await pool.end();
}
