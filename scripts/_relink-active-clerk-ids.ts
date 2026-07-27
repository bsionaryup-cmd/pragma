import { config } from "dotenv";
config({ path: ".env.local" });

import { createClerkClient } from "@clerk/backend";
import { db } from "../src/lib/db";

/**
 * Relink DB clerkId to the Clerk user id of the current local instance
 * for active emails that exist in both systems but drifted (Dev↔Prod).
 */
async function main() {
  const sk = process.env.CLERK_SECRET_KEY?.trim();
  if (!sk) throw new Error("CLERK_SECRET_KEY missing");

  const clerk = createClerkClient({ secretKey: sk });
  const clerkUsers = await clerk.users.getUserList({ limit: 50 });
  const byEmail = new Map(
    clerkUsers.data.map((u) => {
      const email = (
        u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
          ?.emailAddress ??
        u.emailAddresses[0]?.emailAddress ??
        ""
      ).toLowerCase();
      return [email, u.id] as const;
    }),
  );

  const dbUsers = await db.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, clerkId: true },
  });

  const updates: Array<{ email: string; from: string; to: string }> = [];
  for (const user of dbUsers) {
    const email = user.email.toLowerCase();
    const clerkId = byEmail.get(email);
    if (!clerkId || clerkId === user.clerkId) continue;
    await db.user.update({
      where: { id: user.id },
      data: { clerkId },
    });
    updates.push({
      email,
      from: user.clerkId.slice(0, 12),
      to: clerkId.slice(0, 12),
    });
  }

  console.log(JSON.stringify({ updated: updates.length, updates }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
