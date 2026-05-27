/** Deterministic HTML helpers for Airbnb transactional emails. */

export function stripHtmlToText(html: string): string {
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  return normalizeAirbnbForwardedText(stripped);
}

/** Normalize noisy Gmail/Outlook forwarded text while keeping labels on separate lines. */
export function normalizeAirbnbForwardedText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/=\n/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !isForwardNoiseLine(line))
    .join("\n")
    .trim();
}

function isForwardNoiseLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (
    lower === "forwarded message" ||
    lower === "mensaje reenviado" ||
    lower === "original message" ||
    lower === "mensaje original"
  ) {
    return true;
  }

  return /^(from|de|to|para|cc|date|fecha|subject|asunto):\s+/i.test(line);
}

export function extractAnchorHrefs(html: string): string[] {
  const hrefs: string[] = [];
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    if (match[1]) hrefs.push(match[1]);
  }
  return hrefs;
}

/** Label/value rows common in Airbnb templates (ES/EN). */
export function extractLabeledValues(
  text: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const patterns: Array<{ key: string; re: RegExp }> = [
    {
      key: "confirmationCode",
      re: /(?:código de confirmación|confirmation code|reservation code)[:\s]+([A-Z0-9]{6,14})/i,
    },
    {
      key: "guestName",
      re: /(?:huésped|guest|viajero|traveler)[:\s]+([^\n|]+?)(?:\n|·|$)/i,
    },
    {
      key: "guestEmail",
      re: /(?:correo|email|e-mail)[:\s]+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
    },
    {
      key: "guestPhone",
      re: /(?:teléfono|telefono|phone|móvil|mobile|celular)[:\s]+([+\d][\d\s().-]{7,18})/i,
    },
    {
      key: "guestCount",
      re: /(\d{1,2})\s*(?:huéspedes|guests|viajeros|travelers)\b/i,
    },
    {
      key: "listingName",
      re: /(?:alojamiento|listing|property)[:\s]+([^\n|]+?)(?:\n|·|$)/i,
    },
    {
      key: "checkIn",
      re: /(?:check-?in|llegada|arrival)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?\s+\d{4})/i,
    },
    {
      key: "checkOut",
      re: /(?:check-?out|salida|departure)[:\s]+(\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?\s+\d{4})/i,
    },
    {
      key: "grossAmount",
      re: /(?:ingresos brutos|gross earnings|total earnings)[:\s]*[$€]?\s*([\d.,]+)/i,
    },
    {
      key: "hostFee",
      re: /(?:tarifa de servicio|host service fee|service fee)[:\s]*[-–]?\s*[$€]?\s*([\d.,]+)/i,
    },
    {
      key: "netPayout",
      re: /(?:total|net|payout|pago)[:\s]*[$€]?\s*([\d.,]+)/i,
    },
    {
      key: "settlementDate",
      re: /(?:fecha de pago|payout date|settlement)[:\s]+([^\n|]+)/i,
    },
    {
      key: "payoutAccount",
      re: /(?:cuenta|account|bank)[:\s#]+([^\n|]+)/i,
    },
  ];

  for (const { key, re } of patterns) {
    const m = text.match(re);
    if (m?.[1]?.trim()) out[key] = m[1].trim();
  }

  return out;
}

export function extractMessageSnippet(text: string): string | null {
  const patterns = [
    /(?:escribió|wrote)[:\s]+["“]?([^"”\n]{10,800})/i,
    /(?:mensaje|message)[:\s]+["“]?([^"”\n]{10,800})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

export function extractReviewText(text: string): string | null {
  const m = text.match(
    /(?:reseña|review)[:\s]+["“]?([^"”\n]{10,2000})/i,
  );
  return m?.[1]?.trim() ?? null;
}
