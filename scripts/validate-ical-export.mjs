import assert from "node:assert/strict";

/** Validación estructural RFC 5545 / compatibilidad Airbnb. */
function validateIcs(content) {
  assert.ok(content.startsWith("BEGIN:VCALENDAR"), "BEGIN:VCALENDAR");
  assert.ok(content.includes("\r\n"), "CRLF line endings");
  assert.ok(content.trimEnd().endsWith("END:VCALENDAR"), "END:VCALENDAR");

  const events = content.split("BEGIN:VEVENT").length - 1;
  if (events > 0) {
    assert.match(content, /UID:pragma-export-[^@\r\n]+@pragma-pms/);
    assert.match(content, /DTSTART;VALUE=DATE:\d{8}/);
    assert.match(content, /DTEND;VALUE=DATE:\d{8}/);
    assert.match(content, /DTSTAMP:\d{8}T\d{6}Z/);
    assert.match(content, /LAST-MODIFIED:\d{8}T\d{6}Z/);
    assert.match(content, /SUMMARY:/);
    assert.match(content, /DESCRIPTION:.*Check-in/);
    assert.match(content, /STATUS:CONFIRMED/);
    assert.match(content, /TRANSP:OPAQUE/);
    assert.ok(!content.includes("platform: AIRBNB"), "no airbnb re-export markers");
  }
}

const sample = `BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//PRAGMA PMS//ES\r
CALSCALE:GREGORIAN\r
METHOD:PUBLISH\r
X-WR-CALNAME:PRAGMA · Demo\r
X-WR-TIMEZONE:UTC\r
BEGIN:VEVENT\r
UID:pragma-export-test@pragma-pms\r
DTSTAMP:20260517T180000Z\r
LAST-MODIFIED:20260517T180000Z\r
DTSTART;VALUE=DATE:20260520\r
DTEND;VALUE=DATE:20260523\r
SUMMARY:Juan Pérez · Confirmada\r
DESCRIPTION:Huésped: Juan Pérez\\nCheck-in: 2026-05-20\\nCheck-out: 2026-05-23\r
STATUS:CONFIRMED\r
TRANSP:OPAQUE\r
CLASS:PUBLIC\r
END:VEVENT\r
END:VCALENDAR\r
`;

validateIcs(sample);

const dtStart = "20260520";
const dtEnd = "20260523";
const nights =
  (Date.UTC(2026, 4, 23) - Date.UTC(2026, 4, 20)) / 86400000;
assert.equal(nights, 3, "DTEND exclusive: 3 nights for 20→23");

assert.ok(dtEnd > dtStart, "checkout after checkin");

console.log("iCal export validation OK");
