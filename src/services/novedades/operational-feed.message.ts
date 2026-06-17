const PLACEHOLDER_GUEST_NAMES = new Set([
  "huésped airbnb",
  "huesped airbnb",
  "airbnb guest",
  "airbnb",
  "reserved",
  "reservado",
]);

export function stripMessageHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function unwrapQuotedMessage(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  const unwrapped = text.replace(/^[“"']+|[”"']+$/g, "").trim();
  return unwrapped || null;
}

export function isPlaceholderGuestName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  return PLACEHOLDER_GUEST_NAMES.has(
    name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .trim(),
  );
}

/** Texto sin sentido operativo: basura, HTML, solo URLs o códigos. */
export function isIncoherentFeedText(value: string | null | undefined): boolean {
  const text = unwrapQuotedMessage(stripMessageHtml(value ?? "")) ?? "";
  if (text.length < 8) return true;

  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (letters < 4) return true;
  if (letters / text.length < 0.35) return true;

  if (/^https?:\/\/\S+$/i.test(text)) return true;
  if (/^[A-Z0-9]{6,12}$/.test(text)) return true;
  if (/^(null|undefined|n\/a|sin datos)$/i.test(text)) return true;

  if (/(\b\w+\b)(\s+\1){3,}/i.test(text)) return true;

  return false;
}
