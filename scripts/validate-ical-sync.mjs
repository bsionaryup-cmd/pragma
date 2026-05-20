import assert from "node:assert/strict";

function parseIcsDateUtc(value, params = "VALUE=DATE") {
  const trimmed = value.trim();
  const dateOnly = params.includes("VALUE=DATE") || /^\d{8}$/.test(trimmed);
  if (dateOnly) {
    const key = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  return new Date(trimmed);
}

function formatDateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isPragmaExportedUid(uid) {
  const normalized = uid.trim().toLowerCase();
  return (
    normalized.includes("@pragma-pms") ||
    normalized.startsWith("pragma-export-")
  );
}

const sampleFeed = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:airbnb-booking-123
SUMMARY:Reserved
DTSTART;VALUE=DATE:20260520
DTEND;VALUE=DATE:20260523
END:VEVENT
BEGIN:VEVENT
UID:pragma-export-abc@pragma-pms
SUMMARY:Reserved
DTSTART;VALUE=DATE:20260525
DTEND;VALUE=DATE:20260527
END:VEVENT
END:VCALENDAR`;

const events = [];
let uid = "";
let summary = "";
let dtstart = null;
let dtend = null;

for (const line of sampleFeed.split("\n")) {
  if (line === "BEGIN:VEVENT") {
    uid = "";
    summary = "";
    dtstart = null;
    dtend = null;
    continue;
  }
  if (line === "END:VEVENT") {
    if (!isPragmaExportedUid(uid)) {
      events.push({ uid, summary, dtstart, dtend });
    }
    continue;
  }
  if (line.startsWith("UID:")) uid = line.slice(4);
  if (line.startsWith("SUMMARY:")) summary = line.slice(8);
  if (line.startsWith("DTSTART")) {
    dtstart = parseIcsDateUtc(line.split(":").pop() ?? "");
  }
  if (line.startsWith("DTEND")) {
    dtend = parseIcsDateUtc(line.split(":").pop() ?? "");
  }
}

assert.equal(events.length, 1, "debe ignorar eventos exportados por PRAGMA");
assert.equal(events[0].uid, "airbnb-booking-123");
assert.equal(formatDateKey(events[0].dtstart), "2026-05-20");
assert.equal(formatDateKey(events[0].dtend), "2026-05-23");
assert.ok(isPragmaExportedUid("pragma-export-x@pragma-pms"));

console.log("iCal sync validation OK");
