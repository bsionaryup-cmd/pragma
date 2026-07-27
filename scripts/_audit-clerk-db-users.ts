import { config } from "dotenv";
config({ path: ".env.local" });
import { createClerkClient } from "@clerk/backend";
import { db } from "../src/lib/db";

async function main() {
  const sk = process.env.CLERK_SECRET_KEY?.trim() ?? "";
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  console.log(JSON.stringify({ skPrefix: sk.slice(0, 8), pkPrefix: pk.slice(0, 8) }));

  if (!sk) {
    console.log("NO_SECRET");
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey: sk });
  const clerkUsers = await clerk.users.getUserList({ limit: 50 });
  const dbUsers = await db.user.findMany({
    select: {
      email: true,
      isActive: true,
      clerkId: true,
      organizationId: true,
      role: true,
    },
    orderBy: { email: "asc" },
  });

  const clerkByEmail = new Map(
    clerkUsers.data.map((u) => {
      const email = (
        u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
          ?.emailAddress ??
        u.emailAddresses[0]?.emailAddress ??
        ""
      ).toLowerCase();
      return [email, { id: u.id, passwordEnabled: u.passwordEnabled }] as const;
    }),
  );

  const rows = dbUsers.map((u) => {
    const email = u.email.toLowerCase();
    const matched = clerkByEmail.get(email);
    return {
      email,
      dbActive: u.isActive,
      role: u.role,
      hasOrg: Boolean(u.organizationId),
      match: matched ? matched.id === u.clerkId : false,
      inClerk: Boolean(matched),
      passwordEnabled: matched?.passwordEnabled ?? null,
      dbPref: u.clerkId.slice(0, 12),
      clerkPref: matched?.id.slice(0, 12) ?? null,
    };
  });

  console.log(
    JSON.stringify({ clerkTotal: clerkUsers.totalCount, rows }, null, 2),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
