import { config } from "dotenv";
config();
config({ path: ".env.local", override: true });

const { db } = await import("../src/lib/db.ts");

const rid = process.argv[2] || "cmrd5g50a000004if0dlxvbzg";

const events = await db.accessEvent.findMany({
  where: { reservationId: rid },
  orderBy: { createdAt: "desc" },
  take: 25,
  select: { eventType: true, payload: true, createdAt: true },
});

const cred = await db.accessCredential.findMany({
  where: { reservationId: rid },
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    status: true,
    ttlockCodeId: true,
    deliveryStatus: true,
    createdAt: true,
    codeEncrypted: true,
  },
});

const reservation = await db.reservation.findUnique({
  where: { id: rid },
  select: {
    id: true,
    guestName: true,
    guestRegistrationCompletedAt: true,
    property: {
      select: {
        name: true,
        unitNumber: true,
        propertyLock: {
          select: { ttlockLockId: true, integrationId: true },
        },
      },
    },
  },
});

console.log(
  JSON.stringify(
    {
      reservation,
      cred: cred.map((c) => ({
        ...c,
        codeEncrypted: c.codeEncrypted?.slice(0, 24),
      })),
      events,
    },
    null,
    2,
  ),
);

await db.$disconnect();
