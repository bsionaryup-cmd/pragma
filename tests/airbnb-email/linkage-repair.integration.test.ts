import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AirbnbEmailEventKind } from "@prisma/client";
import {
  isPlaceholderGuestName,
  isZeroReservationAmount,
  pickReservationAmount,
} from "../../src/modules/airbnb-email/domains/safe-reservation-enrichment";
import { confirmationCodesConflict } from "../../src/modules/airbnb-email/matching/confirmation-code-guard";
import { computeEnrichedFieldsFromAuditSignals } from "../../src/modules/airbnb-email/repair/rebuild-event-enriched-fields";
import { resolveReservationDisplayGuestName } from "../../src/lib/reservations/display-guest-name";
import {
  createLinkageRepairScenarioState,
  FIXTURE_JAIRO_AUDIT_SIGNALS,
  FIXTURE_YULY_AUDIT_SIGNALS,
  LINKAGE_REPAIR_AUDIT_IDS,
  LINKAGE_REPAIR_EVENT_IDS,
  LINKAGE_REPAIR_RESERVATION_IDS,
  type SimulatedReservation,
} from "./fixtures/linkage-repair-fixtures";

function simulateRelink(
  state: Map<string, SimulatedReservation>,
  input: {
    eventId: string;
    auditId: string;
    fromReservationId: string;
    toReservationId: string;
  },
): void {
  const from = state.get(input.fromReservationId);
  const to = state.get(input.toReservationId);
  assert.ok(from && to);

  const event = from.events.find((row) => row.id === input.eventId);
  const audit = from.audits.find((row) => row.id === input.auditId);
  assert.ok(event && audit);

  event.reservationId = input.toReservationId;
  audit.reservationId = input.toReservationId;
  from.events = from.events.filter((row) => row.id !== input.eventId);
  from.audits = from.audits.filter((row) => row.id !== input.auditId);
  to.events.push(event);
  to.audits.push(audit);
}

function simulateRebuildEvent(
  state: Map<string, SimulatedReservation>,
  auditId: string,
): void {
  for (const reservation of state.values()) {
    const audit = reservation.audits.find((row) => row.id === auditId);
    if (!audit) continue;
    const event = reservation.events.find((row) => row.auditId === auditId);
    assert.ok(event);
    event.enrichedFields = computeEnrichedFieldsFromAuditSignals({
      signals: audit.parsedPayload.signals,
      eventKind: audit.classification,
    });
    return;
  }
  assert.fail(`audit not found: ${auditId}`);
}

function simulateAssignCode(
  state: Map<string, SimulatedReservation>,
  reservationId: string,
  code: string,
): void {
  const reservation = state.get(reservationId);
  assert.ok(reservation);
  assert.equal(reservation.reservationCode, null);
  reservation.reservationCode = code;
}

function simulateGuestNamePlaceholder(
  state: Map<string, SimulatedReservation>,
  reservationId: string,
  auditId: string,
): void {
  const reservation = state.get(reservationId);
  assert.ok(reservation);
  if (reservation.guestRegistrationCompletedAt) return;
  if (!isPlaceholderGuestName(reservation.guestName)) return;
  const audit = reservation.audits.find((row) => row.id === auditId);
  assert.ok(audit);
  const guestName = audit.parsedPayload.signals.guestName?.trim();
  assert.ok(guestName);
  reservation.guestName = guestName;
  const parts = guestName.split(/\s+/);
  reservation.guestFirstName = parts[0] ?? guestName;
  reservation.guestLastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
}

function simulateFinancialBackfill(
  state: Map<string, SimulatedReservation>,
  reservationId: string,
): void {
  const reservation = state.get(reservationId);
  assert.ok(reservation);
  if (!isZeroReservationAmount(reservation.totalAmount)) return;

  for (const event of reservation.events) {
    if (event.eventKind !== AirbnbEmailEventKind.CONFIRMED) continue;
    if (
      confirmationCodesConflict(event.confirmationCode, reservation.reservationCode)
    ) {
      continue;
    }
    const amount = pickReservationAmount({
      netPayout:
        typeof event.enrichedFields.netPayout === "number"
          ? event.enrichedFields.netPayout
          : null,
      hostPayoutAmount:
        typeof event.enrichedFields.hostPayoutAmount === "number"
          ? event.enrichedFields.hostPayoutAmount
          : null,
      grossAmount:
        typeof event.enrichedFields.grossAmount === "number"
          ? event.enrichedFields.grossAmount
          : null,
    });
    if (amount != null && amount > 0) {
      reservation.totalAmount = amount;
      return;
    }
  }
}

function displayName(reservation: SimulatedReservation): string {
  const newestConfirmed = [...reservation.events]
    .filter((event) => event.eventKind === AirbnbEmailEventKind.CONFIRMED)
    .filter(
      (event) =>
        !confirmationCodesConflict(
          event.confirmationCode,
          reservation.reservationCode,
        ),
    )
    .sort((a, b) => b.id.localeCompare(a.id));

  for (const event of newestConfirmed) {
    const name =
      typeof event.enrichedFields.guestName === "string"
        ? event.enrichedFields.guestName
        : null;
    if (name) {
      return resolveReservationDisplayGuestName({
        platform: "AIRBNB",
        airbnbEnrichmentGuestName: name,
        guestName: reservation.guestName,
        guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
      });
    }
  }

  return resolveReservationDisplayGuestName({
    platform: "AIRBNB",
    airbnbEnrichmentGuestName: null,
    guestName: reservation.guestName,
    guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
  });
}

describe("linkage repair integration scenario", () => {
  it("rebuilds Yuly enrichedFields from audit signals (not manual Karla patch)", () => {
    const enriched = computeEnrichedFieldsFromAuditSignals({
      signals: FIXTURE_YULY_AUDIT_SIGNALS,
      eventKind: AirbnbEmailEventKind.CONFIRMED,
    });
    assert.equal(enriched.guestName, "Yuly Correa");
    assert.equal(enriched.hostPayoutAmount, 310122.68);
    assert.equal(enriched.guestTotalPaid, 380262);
  });

  it("pickReservationAmount for Yuly yields 310122.68", () => {
    assert.equal(pickReservationAmount(FIXTURE_YULY_AUDIT_SIGNALS), 310122.68);
  });

  it("runs full Yuly→Karla and Jairo→Alexander repair simulation", () => {
    const state = createLinkageRepairScenarioState();
    const milenaBefore = structuredClone(state.get(LINKAGE_REPAIR_RESERVATION_IDS.milena)!);

    simulateAssignCode(state, LINKAGE_REPAIR_RESERVATION_IDS.yuly, "HMCNCARK3K");

    simulateRelink(state, {
      eventId: LINKAGE_REPAIR_EVENT_IDS.yulyOnKarla,
      auditId: LINKAGE_REPAIR_AUDIT_IDS.yuly,
      fromReservationId: LINKAGE_REPAIR_RESERVATION_IDS.karla,
      toReservationId: LINKAGE_REPAIR_RESERVATION_IDS.yuly,
    });
    simulateRebuildEvent(state, LINKAGE_REPAIR_AUDIT_IDS.yuly);
    simulateGuestNamePlaceholder(
      state,
      LINKAGE_REPAIR_RESERVATION_IDS.yuly,
      LINKAGE_REPAIR_AUDIT_IDS.yuly,
    );
    simulateFinancialBackfill(state, LINKAGE_REPAIR_RESERVATION_IDS.yuly);

    simulateRelink(state, {
      eventId: LINKAGE_REPAIR_EVENT_IDS.jairoOnAlexander,
      auditId: LINKAGE_REPAIR_AUDIT_IDS.jairo,
      fromReservationId: LINKAGE_REPAIR_RESERVATION_IDS.alexander,
      toReservationId: LINKAGE_REPAIR_RESERVATION_IDS.jairo,
    });
    simulateRebuildEvent(state, LINKAGE_REPAIR_AUDIT_IDS.jairo);
    simulateGuestNamePlaceholder(
      state,
      LINKAGE_REPAIR_RESERVATION_IDS.jairo,
      LINKAGE_REPAIR_AUDIT_IDS.jairo,
    );
    simulateFinancialBackfill(state, LINKAGE_REPAIR_RESERVATION_IDS.jairo);

    const yuly = state.get(LINKAGE_REPAIR_RESERVATION_IDS.yuly)!;
    const karla = state.get(LINKAGE_REPAIR_RESERVATION_IDS.karla)!;
    const jairo = state.get(LINKAGE_REPAIR_RESERVATION_IDS.jairo)!;
    const alexander = state.get(LINKAGE_REPAIR_RESERVATION_IDS.alexander)!;
    const milena = state.get(LINKAGE_REPAIR_RESERVATION_IDS.milena)!;

    assert.equal(yuly.totalAmount, 310122.68);
    assert.equal(yuly.reservationCode, "HMCNCARK3K");
    assert.equal(yuly.events.length, 1);
    assert.equal(yuly.guestName, "Yuly Escarley Correa cordero");
    assert.equal(displayName(yuly), "Yuly Escarley Correa cordero");

    assert.equal(karla.totalAmount, 247421);
    assert.equal(karla.events.length, 0);
    assert.equal(karla.audits.length, 0);

    assert.equal(jairo.totalAmount, 433686.66);
    assert.equal(jairo.events.length, 1);
    assert.equal(jairo.guestName, "Jairo Tapia");
    assert.equal(displayName(jairo), "Jairo Tapia");

    assert.equal(alexander.totalAmount, 330242.19);
    assert.equal(alexander.events.length, 1);
    assert.equal(displayName(alexander), "Alexander Roblero");

    assert.deepEqual(milena, milenaBefore);
  });

  it("detects only the two known code conflicts in fixture state", () => {
    const state = createLinkageRepairScenarioState();
    const conflicts: string[] = [];
    for (const reservation of state.values()) {
      for (const event of reservation.events) {
        if (
          event.confirmationCode &&
          reservation.reservationCode &&
          confirmationCodesConflict(event.confirmationCode, reservation.reservationCode)
        ) {
          conflicts.push(event.id);
        }
      }
    }
    assert.deepEqual(conflicts.sort(), [
      LINKAGE_REPAIR_EVENT_IDS.jairoOnAlexander,
      LINKAGE_REPAIR_EVENT_IDS.yulyOnKarla,
    ].sort());
  });

  it("keeps Karla and Alexander amounts unchanged when only relink removes wrong events", () => {
    const state = createLinkageRepairScenarioState();
    simulateRelink(state, {
      eventId: LINKAGE_REPAIR_EVENT_IDS.yulyOnKarla,
      auditId: LINKAGE_REPAIR_AUDIT_IDS.yuly,
      fromReservationId: LINKAGE_REPAIR_RESERVATION_IDS.karla,
      toReservationId: LINKAGE_REPAIR_RESERVATION_IDS.yuly,
    });
    simulateRelink(state, {
      eventId: LINKAGE_REPAIR_EVENT_IDS.jairoOnAlexander,
      auditId: LINKAGE_REPAIR_AUDIT_IDS.jairo,
      fromReservationId: LINKAGE_REPAIR_RESERVATION_IDS.alexander,
      toReservationId: LINKAGE_REPAIR_RESERVATION_IDS.jairo,
    });

    assert.equal(state.get(LINKAGE_REPAIR_RESERVATION_IDS.karla)!.totalAmount, 247421);
    assert.equal(
      state.get(LINKAGE_REPAIR_RESERVATION_IDS.alexander)!.totalAmount,
      330242.19,
    );
  });
});

describe("applyGuestNameToPlaceholderReservation rules (pure)", () => {
  it("does not apply guestName when guestRegistrationCompletedAt is set (Yuly)", () => {
    const state = createLinkageRepairScenarioState();
    const before = state.get(LINKAGE_REPAIR_RESERVATION_IDS.yuly)!.guestName;
    simulateGuestNamePlaceholder(
      state,
      LINKAGE_REPAIR_RESERVATION_IDS.yuly,
      LINKAGE_REPAIR_AUDIT_IDS.yuly,
    );
    assert.equal(state.get(LINKAGE_REPAIR_RESERVATION_IDS.yuly)!.guestName, before);
  });
});
