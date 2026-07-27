/**
 * Evidence: standardized email subjects/bodies for reservation event flow.
 * Pure builders — no DB / no side effects.
 */
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGuestRegistrationAdminEmailHtml,
  buildGuestRegistrationAdminEmailSubject,
  buildGuestRegistrationAdminEmailText,
} from "../src/services/guests/guest-registration-admin-notification.content";
import {
  GUEST_ACCESS_CODE_EMAIL_SUBJECT,
  GUEST_RESERVATION_CONFIRMATION_SUBJECT,
  buildTenantRegistrationCompletedSubject,
} from "../src/lib/guest-registration/reservation-event-email-subjects";

const payload = {
  reservationCode: "HM123",
  propertyLabel: "Loft 801",
  checkIn: "2 ago 2026",
  checkOut: "5 ago 2026",
  guestCount: 2,
  primaryGuest: {
    fullName: "Juan Pérez",
    documentType: "CC",
    documentNumber: "123",
    nationality: "Colombia",
    dateOfBirth: "1 ene 1990",
    email: "juan@example.com",
    phone: "+57 300",
  },
  companions: [],
  accessCode: "252833#",
  accessValidFrom: "02/08/2026, 3:00 p. m.",
  accessValidTo: "05/08/2026, 1:00 p. m.",
};

const receptionSubject = buildGuestRegistrationAdminEmailSubject(
  payload.propertyLabel,
  payload.primaryGuest.fullName,
  payload.reservationCode,
);
const receptionHtml = buildGuestRegistrationAdminEmailHtml(payload);
const receptionText = buildGuestRegistrationAdminEmailText(payload);
const tenantSubjectOk = buildTenantRegistrationCompletedSubject({
  guestName: payload.primaryGuest.fullName,
  propertyLabel: payload.propertyLabel,
  allOk: true,
});

assert.equal(
  GUEST_RESERVATION_CONFIRMATION_SUBJECT,
  "Reserva confirmada — Solo falta completar el registro de huéspedes",
);
assert.equal(
  GUEST_ACCESS_CODE_EMAIL_SUBJECT,
  "Bienvenido — Tu código de acceso ya está disponible",
);
assert.equal(
  receptionSubject,
  "Check-in registrado | Loft 801 | Juan Pérez (HM123)",
);
assert.equal(
  tenantSubjectOk,
  "Registro completado | Juan Pérez | Loft 801",
);
assert.match(receptionHtml, /Check-in registrado/);
assert.match(receptionHtml, /252833#/);
assert.match(receptionText, /Estado del acceso/);
assert.ok(!GUEST_RESERVATION_CONFIRMATION_SUBJECT.toLowerCase().includes("pragma"));
assert.ok(!GUEST_ACCESS_CODE_EMAIL_SUBJECT.toLowerCase().includes("pragma"));

const evidence = {
  ok: true,
  at: new Date().toISOString(),
  subjects: {
    guestConfirmation: GUEST_RESERVATION_CONFIRMATION_SUBJECT,
    guestAccess: GUEST_ACCESS_CODE_EMAIL_SUBJECT,
    reception: receptionSubject,
    tenant: tenantSubjectOk,
  },
  checks: {
    guestConfirmationNoPragma: true,
    guestAccessNoPragmaInSubject: true,
    receptionOperationalSubject: true,
    receptionIncludesTtlock: receptionHtml.includes("252833#"),
    tenantSubjectExact: tenantSubjectOk === "Registro completado | Juan Pérez | Loft 801",
  },
  ssotPostGr:
    "finalizeGuestRegistration → settleGuestRegistrationCompletionComms → TTLock → recepción → guest access → tenant",
  airbnbIngress:
    "Universal /guest-registration + reservation code → same finalize/settle SSOT as Direct",
};

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "../docs/audits/evidence/reservation-events-email-standardization.json",
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
