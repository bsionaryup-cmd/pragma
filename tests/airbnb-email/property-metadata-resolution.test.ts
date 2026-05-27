import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractAirbnbListingRefs } from "../../src/modules/airbnb-email/parsing/airbnb-url-extract";
import { extractReservationSignals } from "../../src/modules/airbnb-email/parsing/extractors";

describe("extractAirbnbListingRefs", () => {
  it("extrae room id desde URL en HTML", () => {
    const refs = extractAirbnbListingRefs(
      '<a href="https://www.airbnb.com/rooms/12345678901234567">Ver</a>',
    );
    assert.equal(refs.airbnbRoomId, "12345678901234567");
    assert.ok(refs.airbnbListingUrl?.includes("/rooms/"));
  });

  it("rechaza múltiples room ids distintos", () => {
    const refs = extractAirbnbListingRefs(
      "https://www.airbnb.com/rooms/111 https://www.airbnb.com/rooms/222",
    );
    assert.equal(refs.airbnbRoomId, null);
  });
});

describe("extractReservationSignals metadata", () => {
  it("extrae guest desde subject y room id desde HTML", () => {
    const signals = extractReservationSignals({
      subject: "Fwd: Reserva confirmada: Karla Durán llega el 19 jun.",
      body: "Código HM4SPXSTS2",
      html: `<a href="https://www.airbnb.com/rooms/98765432109876543">Itinerario</a>`,
    });
    assert.equal(signals.confirmationCode, "HM4SPXSTS2");
    assert.equal(signals.guestName, "Karla Durán");
    assert.equal(signals.airbnbRoomId, "98765432109876543");
  });
});
