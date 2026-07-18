import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCanonicalGuestCompleteForGovernment,
  mapCanonicalGuestToSirePayload,
  mapCanonicalGuestToTraPayload,
  mapReservationGuestToCanonical,
  toE164Phone,
} from "@/lib/guest-registration/canonical-guest";
import { guestStepSchema } from "@/features/guests/schemas/guest-registration.schema";

describe("canonical guest model", () => {
  it("normalizes phones to E.164", () => {
    assert.equal(toE164Phone("+57 3001234567"), "+573001234567");
    assert.equal(toE164Phone("+573001234567"), "+573001234567");
  });

  it("maps reservation guest to SIRE and TRA payloads without re-asking", () => {
    const guest = mapReservationGuestToCanonical({
      id: "g1",
      reservationId: "r1",
      isPrimary: true,
      isReservationOwner: true,
      firstName: "Ana",
      lastName: "Pérez",
      fullName: "Ana Pérez",
      documentType: "CC",
      documentNumber: "1234567890",
      email: "ana@example.com",
      phone: "+57 3001234567",
      nationality: "CO",
      dateOfBirth: new Date("1990-01-15T00:00:00.000Z"),
      sex: "F",
      travelMotive: "LEISURE",
      occupation: "Diseñadora",
      residenceCountry: "CO",
      residenceAdminArea: "Antioquia",
      residenceCity: "Medellín",
      originCountry: "CO",
      originAdminArea: "Cundinamarca",
      originCity: "Bogotá, D.C.",
      destinationCountry: "CO",
      destinationAdminArea: "Antioquia",
      destinationCity: "Medellín",
    });

    assert.equal(isCanonicalGuestCompleteForGovernment(guest), true);

    const stay = {
      reservationId: "r1",
      organizationId: "org1",
      propertyId: "p1",
      checkIn: "2026-07-20",
      checkOut: "2026-07-23",
      platform: "AIRBNB",
      reservationCode: "HMTESTCODE",
      companionCount: 1,
      roomLabel: "Apt 101",
      totalAmount: "450000",
      currency: "COP",
      paymentMedium: "PLATFORM",
      bookingMedium: "AIRBNB",
    };

    const sire = mapCanonicalGuestToSirePayload(guest, stay);
    assert.equal(sire.nationality, "CO");
    assert.equal(sire.sex, "F");
    assert.equal(sire.originCity, "Bogotá, D.C.");

    const tra = mapCanonicalGuestToTraPayload(guest, stay);
    assert.equal(tra.travelMotive, "LEISURE");
    assert.equal(tra.residenceAdminArea, "Antioquia");
    assert.equal(tra.role, "PRIMARY");
  });

  it("validates guest step with canonical required fields", () => {
    const parsed = guestStepSchema.parse({
      token: "a".repeat(32),
      firstName: "Ana",
      lastName: "Pérez",
      documentType: "CE",
      documentNumber: "123456",
      email: "ana@example.com",
      phone: "+57 3001234567",
      nationality: "VE",
      dateOfBirth: "1991-04-02",
      sex: "F",
      travelMotive: "BUSINESS",
      occupation: "Ingeniera",
      residenceCountry: "VE",
      residenceAdminArea: "Distrito Capital",
      residenceCity: "Caracas",
      originCountry: "VE",
      originAdminArea: "Distrito Capital",
      originCity: "Caracas",
      destinationCountry: "CO",
      destinationAdminArea: "Antioquia",
      destinationCity: "Medellín",
    });
    assert.equal(parsed.documentType, "CE");
    assert.equal(parsed.nationality, "VE");
  });
});
