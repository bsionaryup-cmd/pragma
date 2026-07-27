import { config } from "dotenv";
config();
config({ path: ".env.local", override: true });
if (process.env.TTLOCK_API_ENABLED == null) {
  process.env.TTLOCK_API_ENABLED = "true";
}

const ids = [
  "cms28l192000004lcnd732agk", // Angie Suarez
  "cmqi7zld5000004jj2wlfbwen", // German 804
  "cmro6gj9b000004kyllt1siud", // German 801
  "cmrd5g50a000004if0dlxvbzg", // Ludwing phantom likely
];

const { db } = await import("../src/lib/db.ts");

for (const id of ids) {
  const reservation = await db.reservation.findUnique({
    where: { id },
    select: {
      id: true,
      guestName: true,
      status: true,
      checkIn: true,
      checkOut: true,
      guestRegistrationCompletedAt: true,
      guestRegistrationAdminNotifiedAt: true,
      property: {
        select: {
          unitNumber: true,
          propertyLock: {
            select: {
              ttlockLockId: true,
              integration: { select: { status: true, lastError: true } },
            },
          },
        },
      },
    },
  });
  const creds = await db.accessCredential.findMany({
    where: { reservationId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      deliveryStatus: true,
      ttlockCodeId: true,
      createdAt: true,
    },
  });
  const events = await db.accessEvent.findMany({
    where: { reservationId: id },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { eventType: true, payload: true, createdAt: true },
  });
  console.log(
    JSON.stringify({ reservation, creds, events }, null, 2),
  );
  console.log("---");
}

await db.$disconnect();
