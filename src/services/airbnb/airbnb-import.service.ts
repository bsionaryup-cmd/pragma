import { PropertyType } from "@prisma/client";

export type AirbnbListingPreview = {
  listingUrl: string;
  roomId: string | null;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  city: string;
  country: string;
  neighborhood: string | null;
  address: string;
  propertyType: PropertyType;
};

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

function firstMatch(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function firstNumber(html: string, patterns: RegExp[], fallback: number): number {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const n = Number(match[1]);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }
  return fallback;
}

export function normalizeAirbnbListingUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Pega el enlace del anuncio de Airbnb");

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("Enlace de Airbnb inválido");
  }

  const host = url.hostname.replace(/^www\./, "");
  if (!host.includes("airbnb.")) {
    throw new Error("El enlace debe ser de airbnb.com (o dominio regional)");
  }

  return url.toString();
}

export function parseAirbnbRoomId(listingUrl: string): string | null {
  try {
    const url = new URL(listingUrl);
    const rooms = url.pathname.match(/\/rooms\/(\d+)/);
    if (rooms?.[1]) return rooms[1];
    const h = url.pathname.match(/\/h\/([^/?]+)/);
    if (h?.[1]) return h[1];
    return null;
  } catch {
    return null;
  }
}

export function normalizeIcalUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Pega el enlace iCal de Airbnb");

  const normalized = trimmed.replace(/^webcal:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(normalized.startsWith("http") ? normalized : `https://${normalized}`);
  } catch {
    throw new Error("Enlace iCal inválido");
  }

  const path = url.pathname.toLowerCase();
  const isAirbnb =
    url.hostname.includes("airbnb.") ||
    path.includes("/calendar/ical") ||
    path.endsWith(".ics");

  if (!isAirbnb && !path.endsWith(".ics")) {
    throw new Error("El enlace iCal debe ser de Airbnb (calendario .ics)");
  }

  return url.toString();
}

function decodeJsonString(value: string): string {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n");
}

function parseJsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") {
            blocks.push(item as Record<string, unknown>);
          }
        }
      } else if (parsed && typeof parsed === "object") {
        blocks.push(parsed as Record<string, unknown>);
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return blocks;
}

function pickFromJsonLd(blocks: Record<string, unknown>[]) {
  let name: string | null = null;
  let description: string | null = null;
  let image: string | null = null;
  let city: string | null = null;
  let country: string | null = null;

  for (const block of blocks) {
    const type = String(block["@type"] ?? "");
    if (
      type.includes("VacationRental") ||
      type.includes("Accommodation") ||
      type.includes("Product") ||
      type.includes("Apartment")
    ) {
      if (typeof block.name === "string" && !name) name = block.name;
      if (typeof block.description === "string" && !description) {
        description = block.description;
      }
      const img = block.image;
      if (typeof img === "string" && !image) image = img;
      if (Array.isArray(img) && typeof img[0] === "string" && !image) {
        image = img[0];
      }
      const address = block.address;
      if (address && typeof address === "object") {
        const addr = address as Record<string, unknown>;
        if (typeof addr.addressLocality === "string" && !city) {
          city = addr.addressLocality;
        }
        if (typeof addr.addressCountry === "string" && !country) {
          country = addr.addressCountry;
        }
      }
    }
  }

  return { name, description, image, city, country };
}

function inferPropertyType(html: string, name: string): PropertyType {
  const lower = `${name}`.toLowerCase();
  if (/\bloft\b/.test(lower)) return PropertyType.LOFT;
  if (/\bstudio\b|\bestudio\b/.test(lower)) return PropertyType.STUDIO;
  if (/\bcasa\b|\bhouse\b|\bvilla\b|\bchalet\b/.test(lower)) {
    return PropertyType.HOUSE;
  }
  if (/\bapartamento\b|\bapartment\b|\bcondo\b/.test(lower)) {
    return PropertyType.APARTMENT;
  }
  if (/\bhabitaci[oó]n privada\b|\bprivate room\b/.test(lower)) {
    return PropertyType.ROOM;
  }
  return PropertyType.APARTMENT;
}

function countryCodeFromHtml(html: string, city: string): string {
  const code = firstMatch(html, [
    /"countryCode"\s*:\s*"([A-Z]{2})"/,
    /"addressCountry"\s*:\s*"([A-Z]{2})"/,
  ]);
  if (code) return code;

  const lower = html.toLowerCase();
  if (lower.includes("colombia") || city.toLowerCase().includes("bogot")) {
    return "CO";
  }
  if (lower.includes("méxico") || lower.includes("mexico")) return "MX";
  if (lower.includes("españa") || lower.includes("spain")) return "ES";
  if (lower.includes("argentina")) return "AR";
  return "CO";
}

export async function fetchAirbnbListingPreview(
  rawListingUrl: string,
): Promise<AirbnbListingPreview> {
  const listingUrl = normalizeAirbnbListingUrl(rawListingUrl);
  const roomId = parseAirbnbRoomId(listingUrl);

  const response = await fetch(listingUrl, {
    headers: FETCH_HEADERS,
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(
      `No pudimos leer el anuncio (${response.status}). Comprueba que el enlace sea público.`,
    );
  }

  const html = await response.text();
  const jsonLd = parseJsonLdBlocks(html);
  const ld = pickFromJsonLd(jsonLd);

  const ogTitle = firstMatch(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
  ]);
  const ogImage = firstMatch(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ]);
  const ogDescription = firstMatch(html, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
  ]);

  const listingTitle = firstMatch(html, [
    /"listingTitle"\s*:\s*"([^"]+)"/,
    /"title"\s*:\s*"([^"]+)"/,
    /"name"\s*:\s*"([^"]+)"/,
  ]);

  const name =
    ld.name ??
    (ogTitle ? decodeJsonString(ogTitle).replace(/\s*[-–|].*$/u, "").trim() : null) ??
    (listingTitle ? decodeJsonString(listingTitle) : null) ??
    (roomId ? `Airbnb #${roomId}` : "Propiedad Airbnb");

  const description =
    ld.description ??
    (ogDescription ? decodeJsonString(ogDescription) : null) ??
    firstMatch(html, [/"summary"\s*:\s*"([^"]+)"/]);

  const coverImageUrl =
    ld.image ??
    (ogImage ? decodeJsonString(ogImage) : null) ??
    firstMatch(html, [/"picture_url"\s*:\s*"([^"]+)"/, /"xlarge"\s*:\s*"([^"]+)"/]);

  const maxGuests = firstNumber(
    html,
    [
      /"personCapacity"\s*:\s*(\d+)/,
      /"maxGuestCapacity"\s*:\s*(\d+)/,
      /"guestCapacity"\s*:\s*(\d+)/,
      /(\d+)\s+hu[eé]sped/i,
      /(\d+)\s+guests?/i,
    ],
    2,
  );

  const bedrooms = firstNumber(
    html,
    [
      /"bedrooms"\s*:\s*(\d+)/,
      /"bedroomCount"\s*:\s*(\d+)/,
      /(\d+)\s+habitaci[oó]n/i,
      /(\d+)\s+bedrooms?/i,
    ],
    1,
  );

  const beds = firstNumber(
    html,
    [/"beds"\s*:\s*(\d+)/, /"bedCount"\s*:\s*(\d+)/, /(\d+)\s+camas?/i],
    Math.max(bedrooms, 1),
  );

  const bathrooms = firstNumber(
    html,
    [
      /"bathrooms"\s*:\s*([\d.]+)/,
      /"bathroomCount"\s*:\s*([\d.]+)/,
      /([\d.]+)\s+ba[ñn]os?/i,
      /([\d.]+)\s+bathrooms?/i,
    ],
    1,
  );

  const city =
    ld.city ??
    firstMatch(html, [
      /"city"\s*:\s*"([^"]+)"/,
      /"addressLocality"\s*:\s*"([^"]+)"/,
      /"localizedCityName"\s*:\s*"([^"]+)"/,
    ]) ??
    "Sin ciudad";

  const neighborhood =
    firstMatch(html, [
      /"neighborhood"\s*:\s*"([^"]+)"/,
      /"publicAddress"\s*:\s*"([^"]+)"/,
    ]) ?? null;

  const country = countryCodeFromHtml(html, city);

  const propertyType = inferPropertyType(html, name);

  const address =
    neighborhood && neighborhood !== city
      ? `${neighborhood}, ${city}`
      : city;

  return {
    listingUrl,
    roomId,
    name: name.slice(0, 120),
    description: description?.slice(0, 2000) ?? null,
    coverImageUrl,
    maxGuests,
    bedrooms,
    beds,
    bathrooms,
    city: city.slice(0, 80),
    country,
    neighborhood: neighborhood?.slice(0, 80) ?? null,
    address: address.slice(0, 200),
    propertyType,
  };
}
