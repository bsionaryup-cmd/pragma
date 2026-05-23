/**
 * Seeds a full demo tenant (properties, reservations, guests, tasks, finance).
 * Safe to re-run with --reset. Platform owner can impersonate the demo org.
 *
 * Usage:
 *   node scripts/seed-demo-data.mjs
 *   node scripts/seed-demo-data.mjs --reset
 *   node scripts/seed-demo-data.mjs --dry-run
 */
import { randomBytes } from "crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const dryRun = process.argv.includes("--dry-run");
const reset = process.argv.includes("--reset");

const DEMO_ORG_NAME = "PRAGMA Demo · Urbano Loft";
const DEMO_ADMIN_EMAIL = "demo@pragmapms.com";
const DEMO_RECEPTION_EMAIL = "recepcion@pragmapms.com";
const TRIAL_DAYS = 14;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function dateOnly(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(base, days) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function todayUtcDate() {
  const now = new Date();
  return dateOnly(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}

function token() {
  return randomBytes(24).toString("hex");
}

async function deleteDemoOrganization(orgId) {
  const properties = await db.property.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  const propertyIds = properties.map((p) => p.id);

  if (propertyIds.length > 0) {
    const reservations = await db.reservation.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { id: true },
    });
    const reservationIds = reservations.map((r) => r.id);

    if (reservationIds.length > 0) {
      await db.accessEvent.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await db.accessCredential.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await db.guestRegistrationToken.deleteMany({
        where: { reservationId: { in: reservationIds } },
      });
      await db.reservationGuest.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await db.task.deleteMany({
        where: {
          OR: [{ reservationId: { in: reservationIds } }, { propertyId: { in: propertyIds } }],
        },
      });
      await db.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    }

    await db.task.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await db.propertyPriceLabs.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await db.propertyLock.deleteMany({ where: { propertyId: { in: propertyIds } } });
    await db.property.deleteMany({ where: { id: { in: propertyIds } } });
  }

  await db.manualExpense.deleteMany({
    where: { createdBy: { organizationId: orgId } },
  });
  await db.otherIncome.deleteMany({
    where: { createdBy: { organizationId: orgId } },
  });

  const billing = await db.billingAccount.findUnique({ where: { organizationId: orgId } });
  if (billing) {
    await db.billingInvoice.deleteMany({ where: { billingAccountId: billing.id } });
    await db.billingAccount.delete({ where: { id: billing.id } });
  }

  await db.user.deleteMany({ where: { organizationId: orgId } });
  await db.organization.delete({ where: { id: orgId } });
}

async function main() {
  const existing = await db.organization.findFirst({
    where: { name: DEMO_ORG_NAME },
    select: { id: true },
  });

  if (existing && reset && !dryRun) {
    await deleteDemoOrganization(existing.id);
    console.log("Demo organization removed (--reset).");
  } else if (existing && !reset) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          message: "Demo org already exists. Use --reset to recreate.",
          organizationId: existing.id,
        },
        null,
        2,
      ),
    );
    return;
  }

  const today = todayUtcDate();

  const propertiesSpec = [
    {
      unitNumber: "801",
      name: "Loft 2P con Vista Premium | Laureles | Zona top",
      neighborhood: "Laureles",
      city: "Medellín",
      propertyType: "APARTMENT",
      maxGuests: 4,
      bedrooms: 2,
      beds: 2,
      bathrooms: "1.5",
      baseRate: "289000",
      cleaningFee: "85000",
    },
    {
      unitNumber: "1202",
      name: "Apto moderno 1202 · El Poblado · Lleras",
      neighborhood: "El Poblado",
      city: "Medellín",
      propertyType: "APARTMENT",
      maxGuests: 3,
      bedrooms: 1,
      beds: 2,
      bathrooms: "1.0",
      baseRate: "349000",
      cleaningFee: "95000",
    },
    {
      unitNumber: "305",
      name: "Estudio 305 · Laureles · cerca estadio",
      neighborhood: "Laureles",
      city: "Medellín",
      propertyType: "STUDIO",
      maxGuests: 2,
      bedrooms: 1,
      beds: 1,
      bathrooms: "1.0",
      baseRate: "179000",
      cleaningFee: "65000",
    },
    {
      unitNumber: "602",
      name: "Apto familiar 602 · Envigado · Zona tranquila",
      neighborhood: "Envigado",
      city: "Envigado",
      propertyType: "APARTMENT",
      maxGuests: 6,
      bedrooms: 3,
      beds: 4,
      bathrooms: "2.0",
      baseRate: "399000",
      cleaningFee: "110000",
    },
  ];

  const reservationsSpec = (propertyIndex, propertyId) => {
    const specs = [
      {
        key: "past-airbnb",
        guestName: "Sarah Mitchell",
        guestFirstName: "Sarah",
        guestLastName: "Mitchell",
        guestEmail: "sarah.mitchell@example.com",
        guestPhone: "+1 415 555 0142",
        guestCountry: "US",
        guestLanguage: "en",
        adults: 2,
        children: 0,
        infants: 0,
        checkIn: addDays(today, -12),
        checkOut: addDays(today, -8),
        platform: "AIRBNB",
        status: "CHECKED_OUT",
        paymentStatus: "PAID",
        reservationCode: `HM${propertyIndex}801A`,
        totalAmount: "1156000",
        internalNotes: "Huésped puntual. Dejó reseña 5★.",
        guestStatus: "CHECKED_OUT",
        docType: "PASSPORT",
        docNumber: `US${900000 + propertyIndex}`,
      },
      {
        key: "active-booking",
        guestName: "Carlos Mendoza",
        guestFirstName: "Carlos",
        guestLastName: "Mendoza",
        guestEmail: "carlos.mendoza@gmail.com",
        guestPhone: "+57 300 555 0198",
        guestCountry: "CO",
        guestLanguage: "es",
        adults: 2,
        children: 1,
        infants: 0,
        checkIn: addDays(today, -2),
        checkOut: addDays(today, 3),
        platform: "BOOKING",
        status: "CHECKED_IN",
        paymentStatus: "PAID",
        reservationCode: `BK${propertyIndex}4421`,
        totalAmount: "1425000",
        internalNotes: "Late check-in coordinado por WhatsApp.",
        guestStatus: "CHECKED_IN",
        docType: "CC",
        docNumber: `${10203040 + propertyIndex}`,
      },
      {
        key: "checkout-today",
        guestName: "Laura Gómez",
        guestFirstName: "Laura",
        guestLastName: "Gómez",
        guestEmail: "laura.gomez@outlook.com",
        guestPhone: "+57 310 555 7722",
        guestCountry: "CO",
        guestLanguage: "es",
        adults: 1,
        children: 0,
        infants: 0,
        checkIn: addDays(today, -3),
        checkOut: today,
        platform: "AIRBNB",
        status: "CHECKOUT_TODAY",
        paymentStatus: "PAID",
        reservationCode: `HM${propertyIndex}992C`,
        totalAmount: "867000",
        internalNotes: "Checkout 13:00 · limpieza prioritaria.",
        guestStatus: "REGISTERED",
        docType: "CC",
        docNumber: `${43829100 + propertyIndex}`,
      },
      {
        key: "upcoming-direct",
        guestName: "James Wilson",
        guestFirstName: "James",
        guestLastName: "Wilson",
        guestEmail: "j.wilson@proton.me",
        guestPhone: "+44 7700 900123",
        guestCountry: "GB",
        guestLanguage: "en",
        adults: 2,
        children: 0,
        infants: 0,
        checkIn: addDays(today, 5),
        checkOut: addDays(today, 9),
        platform: "DIRECT",
        status: "CONFIRMED",
        paymentStatus: "PENDING",
        reservationCode: `DR${propertyIndex}7788`,
        totalAmount: "980000",
        internalNotes: "Reserva directa web · pendiente 50% restante.",
        guestStatus: "PENDING_REGISTRATION",
        docType: "PASSPORT",
        docNumber: `GB${880000 + propertyIndex}`,
        withRegistrationToken: true,
      },
    ];

    return specs.map((s) => ({ ...s, propertyId }));
  };

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          organization: DEMO_ORG_NAME,
          users: [DEMO_ADMIN_EMAIL, DEMO_RECEPTION_EMAIL],
          properties: propertiesSpec.length,
          reservationsPerProperty: 4,
          totalReservations: propertiesSpec.length * 4,
        },
        null,
        2,
      ),
    );
    return;
  }

  const trialEndsAt = addDays(today, TRIAL_DAYS);

  const result = await db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: DEMO_ORG_NAME, status: "ACTIVE" },
    });

    const billingAccount = await tx.billingAccount.create({
      data: {
        organizationId: organization.id,
        status: "TRIAL",
        plan: "PRO",
        trialEndsAt,
        metadata: { propertySlots: propertiesSpec.length, seeded: true },
      },
    });

    const admin = await tx.user.create({
      data: {
        clerkId: `seed_demo_admin_${organization.id.slice(-8)}`,
        email: DEMO_ADMIN_EMAIL,
        firstName: "Ana",
        lastName: "Urbano",
        role: "ADMIN",
        isAccountOwner: true,
        isActive: true,
        organizationId: organization.id,
        companyName: "Urbano Loft",
        phone: "+57 300 123 4567",
        propertyCount: propertiesSpec.length,
        onboardingCompletedAt: new Date(),
        locale: "es",
        timezone: "America/Bogota",
      },
    });

    const receptionist = await tx.user.create({
      data: {
        clerkId: `seed_demo_reception_${organization.id.slice(-8)}`,
        email: DEMO_RECEPTION_EMAIL,
        firstName: "María",
        lastName: "Recepción",
        role: "RECEPTIONIST",
        isAccountOwner: false,
        isActive: true,
        organizationId: organization.id,
        locale: "es",
        timezone: "America/Bogota",
      },
    });

    const properties = [];
    for (const spec of propertiesSpec) {
      const property = await tx.property.create({
        data: {
          ownerId: admin.id,
          organizationId: organization.id,
          name: spec.name,
          unitNumber: spec.unitNumber,
          description: `Alojamiento demo ${spec.unitNumber} — datos de prueba PRAGMA.`,
          address: `Cra 70 # 44-${spec.unitNumber}`,
          neighborhood: spec.neighborhood,
          city: spec.city,
          country: "CO",
          propertyType: spec.propertyType,
          maxGuests: spec.maxGuests,
          bedrooms: spec.bedrooms,
          beds: spec.beds,
          bathrooms: spec.bathrooms,
          checkInTime: "15:00",
          checkOutTime: "13:00",
          accessCode: `${spec.unitNumber}#2026`,
          accessInstructions: "Usar interfón · código en app TTLock.",
          wifiName: `UrbanoLoft_${spec.unitNumber}`,
          wifiPassword: `wifi${spec.unitNumber}demo`,
          houseRules: "No fiestas · no fumar · mascotas pequeñas OK.",
          baseRate: spec.baseRate,
          cleaningFee: spec.cleaningFee,
          airbnbListingUrl: `https://airbnb.com/rooms/demo-${spec.unitNumber}`,
          airbnbRoomId: `demo-room-${spec.unitNumber}`,
          status: "ACTIVE",
          currency: "COP",
        },
      });
      properties.push(property);
    }

    let reservationCount = 0;
    let guestCount = 0;
    let taskCount = 0;

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      const specs = reservationsSpec(i + 1, property.id);

      for (const spec of specs) {
        const regToken = spec.withRegistrationToken ? token() : null;

        const reservation = await tx.reservation.create({
          data: {
            propertyId: property.id,
            guestName: spec.guestName,
            guestFirstName: spec.guestFirstName,
            guestLastName: spec.guestLastName,
            guestEmail: spec.guestEmail,
            guestPhone: spec.guestPhone,
            guestCountry: spec.guestCountry,
            guestLanguage: spec.guestLanguage,
            adults: spec.adults,
            children: spec.children,
            infants: spec.infants,
            checkIn: spec.checkIn,
            checkOut: spec.checkOut,
            platform: spec.platform,
            status: spec.status,
            paymentStatus: spec.paymentStatus,
            reservationCode: spec.reservationCode,
            totalAmount: spec.totalAmount,
            currency: "COP",
            internalNotes: spec.internalNotes,
            guestRegistrationToken: regToken,
            guestRegistrationCompletedAt:
              spec.guestStatus !== "PENDING_REGISTRATION" ? addDays(spec.checkIn, -1) : null,
            icalUid: `seed-${organization.id}-${spec.reservationCode}`,
          },
        });
        reservationCount += 1;

        await tx.reservationGuest.create({
          data: {
            reservationId: reservation.id,
            isPrimary: true,
            isReservationOwner: true,
            status: spec.guestStatus,
            firstName: spec.guestFirstName,
            lastName: spec.guestLastName,
            fullName: spec.guestName,
            documentType: spec.docType,
            documentNumber: spec.docNumber,
            email: spec.guestEmail,
            phone: spec.guestPhone,
            nationality: spec.guestCountry,
            dateOfBirth: dateOnly(1990 + i, 3, 15),
          },
        });
        guestCount += 1;

        if (spec.withRegistrationToken && regToken) {
          await tx.guestRegistrationToken.create({
            data: {
              reservationId: reservation.id,
              token: regToken,
              status: "ACTIVE",
              expiresAt: addDays(spec.checkIn, 2),
            },
          });
        }

        if (spec.status === "CHECKOUT_TODAY" || spec.status === "CHECKED_OUT") {
          await tx.task.create({
            data: {
              propertyId: property.id,
              reservationId: reservation.id,
              assigneeId: receptionist.id,
              type: "CLEANING",
              title: `Limpieza post checkout · Apt ${property.unitNumber}`,
              description: "Cambio de sábanas, amenities y revisión inventario.",
              dueDate: addDays(today, spec.status === "CHECKOUT_TODAY" ? 0 : -7),
              status: spec.status === "CHECKED_OUT" ? "COMPLETED" : "PENDING",
              completedAt: spec.status === "CHECKED_OUT" ? addDays(today, -7) : null,
            },
          });
          taskCount += 1;
        }

        if (spec.status === "CONFIRMED") {
          await tx.task.create({
            data: {
              propertyId: property.id,
              reservationId: reservation.id,
              type: "CHECK_IN",
              title: `Check-in ${spec.guestFirstName} · Apt ${property.unitNumber}`,
              dueDate: spec.checkIn,
              status: "PENDING",
            },
          });
          taskCount += 1;
        }
      }
    }

    await tx.manualExpense.create({
      data: {
        createdById: admin.id,
        category: "Limpieza",
        amount: "185000",
        paymentMethod: "TRANSFER",
        expenseDate: addDays(today, -5),
        description: "Limpieza profunda Apt 801 (demo)",
      },
    });

    await tx.manualExpense.create({
      data: {
        createdById: admin.id,
        category: "Mantenimiento",
        amount: "92000",
        paymentMethod: "CASH",
        expenseDate: addDays(today, -2),
        description: "Reparación chapeta cerradura 1202",
      },
    });

    await tx.otherIncome.create({
      data: {
        createdById: admin.id,
        amount: "75000",
        incomeType: "Late check-out Apt 305",
        incomeDate: addDays(today, -1),
        description: "Late check-out · Estudio 305",
      },
    });

    await tx.otherIncome.create({
      data: {
        createdById: admin.id,
        amount: "45000",
        incomeType: "Servicio transporte aeropuerto",
        incomeDate: today,
        description: "Traslado aeropuerto · huésped Carlos Mendoza",
      },
    });

    return {
      organizationId: organization.id,
      billingAccountId: billingAccount.id,
      adminId: admin.id,
      receptionistId: receptionist.id,
      propertyCount: properties.length,
      reservationCount,
      guestCount,
      taskCount,
    };
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        organization: DEMO_ORG_NAME,
        ...result,
        hint: "Owner: impersona esta org desde /owner-dashboard para ver el panel completo.",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
