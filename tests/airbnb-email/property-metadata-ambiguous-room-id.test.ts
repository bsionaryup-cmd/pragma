import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectNumericRoomIdCandidates,
  pickUniquePropertyByListingName,
  propertyIcalUrlContainsRoomId,
  resolvePropertyFromKnownMetadata,
} from "../../src/services/integrations/airbnb-property-metadata-resolver.service";

describe("propertyIcalUrlContainsRoomId", () => {
  it("matches Airbnb iCal calendar path for numeric listing id", () => {
    assert.equal(
      propertyIcalUrlContainsRoomId(
        "https://www.airbnb.com.co/calendar/ical/1654953756803514090.ics?t=abc",
        "1654953756803514090",
      ),
      true,
    );
  });

  it("rejects slug ids and partial numeric matches", () => {
    assert.equal(
      propertyIcalUrlContainsRoomId(
        "https://airbnb.com.co/calendar/ical/1654953756803514090.ics",
        "urbanova801",
      ),
      false,
    );
    assert.equal(
      propertyIcalUrlContainsRoomId(
        "https://airbnb.com.co/calendar/ical/1654953756803514090-extra.ics",
        "1654953756803514090",
      ),
      false,
    );
  });
});

describe("collectNumericRoomIdCandidates", () => {
  it("deduplicates numeric primary and numeric fields", () => {
    assert.deepEqual(
      collectNumericRoomIdCandidates(
        "1654953756803514090",
        "1654953756803514090",
      ),
      ["1654953756803514090"],
    );
  });

  it("ignores slug ids and empty values (case C/D guard)", () => {
    assert.deepEqual(
      collectNumericRoomIdCandidates("urbanova801", null),
      [],
    );
    assert.deepEqual(
      collectNumericRoomIdCandidates(null, "   "),
      [],
    );
  });
});

describe("resolvePropertyFromKnownMetadata edge cases", () => {
  it("case A: unique listing name keeps current behavior", () => {
    const picked = pickUniquePropertyByListingName({
      listingName: "Loft 2P con Vista Premium | Laureles | Zona top",
      properties: [
        {
          propertyId: "cmpm0xani000004jgxfqjnih0",
          name: "Loft 2P con Vista Premium | Laureles | Zona top",
        },
        {
          propertyId: "cmpmqaeea000004jvytqozsq1",
          name: "Loft moderno para 4 personas | Laureles | A 10 min de la Comuna 13",
        },
      ],
    });
    assert.equal(picked.propertyId, "cmpm0xani000004jgxfqjnih0");
    assert.equal(picked.ambiguous, false);
  });

  it("case C: ambiguous listing name without room id stays ambiguous", () => {
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
    assert.equal(
      collectNumericRoomIdCandidates(null, null).length,
      0,
    );
  });

  it("case D: ambiguous listing name with room id candidates still has numeric ids", () => {
    assert.deepEqual(
      collectNumericRoomIdCandidates(
        "9999999999999999999",
        "9999999999999999999",
      ),
      ["9999999999999999999"],
    );
  });
});

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe(
  "resolvePropertyFromKnownMetadata integration",
  { skip: !hasDatabase },
  () => {
    it("case B: Dennis numeric room id resolves to property 801", async () => {
      const resolved = await resolvePropertyFromKnownMetadata({
        organizationId: "cmplxfg0a000105jrs0gqtwyc",
        listingName: "Loft moderno 4P | Laureles | A 10 min de Comuna 13",
        airbnbRoomId: "1654953756803514090",
        airbnbRoomIdNumeric: "1654953756803514090",
      });

      assert.equal(resolved.propertyId, "cmpmqaeea000004jvytqozsq1");
      assert.equal(resolved.ambiguous, false);
      assert.equal(resolved.method, "airbnb_room_id_property");
    });

    it("case A regression: Jared unique listing still resolves by name", async () => {
      const resolved = await resolvePropertyFromKnownMetadata({
        organizationId: "cmplxfg0a000105jrs0gqtwyc",
        listingName: "Loft 2P con Vista Premium | Laureles | Zona top",
        airbnbRoomIdNumeric: "1659835181966511536",
      });

      assert.equal(resolved.propertyId, "cmpm0xani000004jgxfqjnih0");
      assert.equal(resolved.method, "normalized_property_name");
    });
  },
);
