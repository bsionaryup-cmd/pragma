import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractAirbnbListingRefs } from "../../src/modules/airbnb-email/parsing/airbnb-url-extract";
import { extractReservationSignals } from "../../src/modules/airbnb-email/parsing/extractors";
import {
  extractGuestNameFromSubject,
  isPlausibleGuestName,
} from "../../src/modules/airbnb-email/parsing/guest-name-extract";
import { pickUniquePropertyByListingName } from "../../src/services/integrations/airbnb-property-metadata-resolver.service";

describe("extractAirbnbListingRefs", () => {
  it("extrae room id numérico y slug /h/ por separado", () => {
    const refs = extractAirbnbListingRefs(`
      https://www.airbnb.com/rooms/1659842170040094387
      https://airbnb.com.co/h/urbanova803
    `);
    assert.equal(refs.airbnbRoomIdNumeric, "1659842170040094387");
    assert.equal(refs.airbnbRoomSlugs.includes("urbanova803"), true);
    assert.equal(refs.airbnbRoomId, "urbanova803");
  });

  it("extrae room id desde URL en HTML", () => {
    const refs = extractAirbnbListingRefs(
      '<a href="https://www.airbnb.com/rooms/12345678901234567">Ver</a>',
    );
    assert.equal(refs.airbnbRoomIdNumeric, "12345678901234567");
    assert.ok(refs.airbnbListingUrl?.includes("/rooms/"));
  });
});

describe("guest name extraction", () => {
  it("extrae Karla Durán desde subject Fwd", () => {
    const name = extractGuestNameFromSubject(
      "Fwd: Reserva confirmada: Karla Durán llega el 19 jun.",
    );
    assert.equal(name, "Karla Durán");
  });

  it("rechaza ha pagado como guestName", () => {
    assert.equal(isPlausibleGuestName("ha pagado"), false);
  });
});

describe("extractReservationSignals metadata", () => {
  it("prioriza subject sobre body degradado", () => {
    const signals = extractReservationSignals({
      subject: "Fwd: Reserva confirmada: Karla Durán llega el 19 jun.",
      body: "El viajero ha pagado\nCódigo HM4SPXSTS2",
      html: `<a href="https://airbnb.com.co/h/urbanova803">Itinerario</a>
             <a href="https://www.airbnb.com/rooms/1659842170040094387">Ver</a>`,
    });
    assert.equal(signals.confirmationCode, "HM4SPXSTS2");
    assert.equal(signals.guestName, "Karla Durán");
    assert.match(signals.checkIn ?? "", /^2026-06-19$/);
    assert.equal(signals.airbnbRoomId, "urbanova803");
    assert.equal(signals.airbnbRoomIdNumeric, "1659842170040094387");
    assert.ok(signals.emailMatchBlob?.includes("urbanova803"));
  });
});

describe("normalized listing -> property name mapping", () => {
  it("acepta match único con sufijo de unidad", () => {
    const picked = pickUniquePropertyByListingName({
      listingName: "Loft amplio 4P con Vista Panorámica | Laureles Top",
      properties: [
        {
          propertyId: "p804",
          name: "Loft amplio 4P con Vista Panorámica | Laureles Top - 804",
        },
        {
          propertyId: "p801",
          name: "Loft moderno para 4 personas | Laureles | A 10 min",
        },
      ],
    });
    assert.equal(picked.propertyId, "p804");
    assert.equal(picked.ambiguous, false);
  });

  it("bloquea cuando hay múltiples matches parecidos", () => {
    const picked = pickUniquePropertyByListingName({
      listingName: "Loft amplio 4P con Vista Panorámica | Laureles Top",
      properties: [
        {
          propertyId: "p804",
          name: "Loft amplio 4P con Vista Panorámica | Laureles Top - 804",
        },
        {
          propertyId: "p904",
          name: "Loft amplio 4P con Vista Panorámica | Laureles Top - 904",
        },
      ],
    });
    assert.equal(picked.propertyId, null);
    assert.equal(picked.ambiguous, true);
  });
});
