import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";

async function main() {
  const u = await db.user.findMany({
    select: {
      email: true,
      isActive: true,
      isAccountOwner: true,
      role: true,
      platformRole: true,
      organizationId: true,
      clerkId: true,
    },
    orderBy: { email: "asc" },
  });
  console.log(
    JSON.stringify(
      u.map((x) => ({
        email: x.email,
        active: x.isActive,
        owner: x.isAccountOwner,
        role: x.role,
        platform: x.platformRole,
        hasOrg: Boolean(x.organizationId),
        pref: x.clerkId.slice(0, 12),
      })),
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
