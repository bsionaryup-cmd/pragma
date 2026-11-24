/**
 * Read-only: why Panel may show empty-property banner for urbanovaloft.
 * Usage: npx tsx --require ./scripts/_mock-server-only.cjs scripts/_audit-property-scope-once.ts
 */
import { db } from "../src/lib/db";

const EMAIL = process.env.AUDIT_EMAIL ?? "urbanovaloft@gmail.com";

async function main() {
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/?]+)/)?.[1] ?? "?";
  console.log(JSON.stringify({ host, email: EMAIL }, null, 2));

  const user = await db.user.findFirst({
    where: { email: { equals: EMAIL, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      organizationId: true,
      role: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!user) {
    console.log(JSON.stringify({ error: "user_not_found" }));
    return;
  }

  const byOrg = user.organizationId
    ? await db.property.count({ where: { organizationId: user.organizationId } })
    : null;
  const byOwner = await db.property.count({ where: { ownerId: user.id } });
  const ownerNullOrg = await db.property.count({
    where: { ownerId: user.id, organizationId: null },
  });
  const ownerOtherOrg = user.organizationId
    ? await db.property.count({
        where: {
          ownerId: user.id,
          organizationId: { not: user.organizationId },
        },
      })
    : null;

  const sample = await db.property.findMany({
    where: {
      OR: [
        ...(user.organizationId
          ? [{ organizationId: user.organizationId as string }]
          : []),
        { ownerId: user.id },
      ],
    },
    take: 10,
    select: {
      id: true,
      name: true,
      unitNumber: true,
      status: true,
      organizationId: true,
      ownerId: true,
    },
    orderBy: { name: "asc" },
  });

  console.log(
    JSON.stringify(
      {
        user,
        counts: {
          byOrg,
          byOwner,
          ownerNullOrg,
          ownerOtherOrg,
          panelWouldCount:
            user.organizationId != null ? byOrg : byOwner,
        },
        sample,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
