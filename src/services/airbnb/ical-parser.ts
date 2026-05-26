import { dateKeyToPrismaDate, prismaDateToKey } from "@/lib/dates";

export type ParsedIcalEvent = {
  uid: string;
  summary: string;
  dtstart: Date;
  dtend: Date;
};

function unfoldIcsLines(raw: string): string[] {
  const physical = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of physical) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      const prev = lines.pop() ?? "";
      lines.push(prev + line.slice(1));
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function parseIcsDateKey(value: string): string | null {
  const trimmed = value.trim();
  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }
  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  }
  return null;
}

function parseIcsDate(value: string, params: string): Date {
  const trimmed = value.trim();
  const dateOnly = params.includes("VALUE=DATE") || /^\d{8}$/.test(trimmed);
  if (dateOnly) {
    const key = parseIcsDateKey(trimmed);
    if (key) return dateKeyToPrismaDate(key);
  }

  // Datetimes: use calendar date from the ICS string (avoid TZ drift vs Airbnb).
  const keyFromDatetime = parseIcsDateKey(trimmed);
  if (keyFromDatetime) {
    return dateKeyToPrismaDate(keyFromDatetime);
  }

  const iso = trimmed.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/,
    "$1-$2-$3T$4:$5:$6Z",
  );
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) {
    return dateKeyToPrismaDate(prismaDateToKey(parsed));
  }

  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) {
    return dateKeyToPrismaDate(prismaDateToKey(fallback));
  }

  return dateKeyToPrismaDate("1970-01-01");
}

function parseIcsProperty(line: string): {
  name: string;
  params: string;
  value: string;
} {
  const colon = line.indexOf(":");
  if (colon === -1) return { name: line, params: "", value: "" };
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const semi = head.indexOf(";");
  if (semi === -1) return { name: head.toUpperCase(), params: "", value };
  return {
    name: head.slice(0, semi).toUpperCase(),
    params: head.slice(semi + 1).toUpperCase(),
    value,
  };
}

export function parseIcsFeed(raw: string): ParsedIcalEvent[] {
  const lines = unfoldIcsLines(raw);
  const events: ParsedIcalEvent[] = [];
  let inEvent = false;
  let uid = "";
  let summary = "";
  let dtstart: Date | null = null;
  let dtend: Date | null = null;

  function flush() {
    if (!uid || !dtstart || !dtend) return;
    if (dtend <= dtstart) return;
    events.push({
      uid,
      summary: summary.trim() || "Reserva Airbnb",
      dtstart,
      dtend,
    });
  }

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      uid = "";
      summary = "";
      dtstart = null;
      dtend = null;
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent) flush();
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const prop = parseIcsProperty(line);
    if (prop.name === "UID") uid = prop.value.trim();
    if (prop.name === "SUMMARY") {
      summary = prop.value.replace(/\\n/g, " ").replace(/\\,/g, ",").trim();
    }
    if (prop.name === "DTSTART") {
      dtstart = parseIcsDate(prop.value.trim(), prop.params);
    }
    if (prop.name === "DTEND") {
      dtend = parseIcsDate(prop.value.trim(), prop.params);
    }
  }

  return events;
}

/** Clave YYYY-MM-DD en UTC (alineada con columnas @db.Date de Prisma). */
export function formatDateKey(date: Date): string {
  return prismaDateToKey(date);
}

export function isAirbnbBlockedSummary(summary: string): boolean {
  const s = summary.toLowerCase();
  return (
    s.includes("not available") ||
    s.includes("no disponible") ||
    s.includes("unavailable") ||
    s.includes("blocked") ||
    s.includes("bloqueado") ||
    s === "airbnb" ||
    s.includes("(not available)")
  );
}
