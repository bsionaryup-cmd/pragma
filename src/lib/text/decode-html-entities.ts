const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  iquest: "¿",
  iexcl: "¡",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  auml: "ä",
  ouml: "ö",
  ccedil: "ç",
};

/** Decodifica entidades HTML comunes para texto visible al usuario. */
export function decodeHtmlEntities(value: string): string {
  if (!value.includes("&")) return value;

  let decoded = value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)));

  decoded = decoded.replace(/&([a-zA-Z]+);/g, (match, name: string) => {
    const mapped = NAMED_ENTITIES[name];
    return mapped ?? match;
  });

  return decoded.replace(/\u00a0/g, " ");
}
