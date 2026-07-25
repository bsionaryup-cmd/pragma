/**
 * Additive guest-text normalization for informal Spanish / typos.
 * Used by utterance-bank matching — does not replace intent RULES.
 */

const INFORMAL_FOLDS: Array<[RegExp, string]> = [
  [/\bola\b/g, "hola"],
  [/\bholi\b/g, "hola"],
  [/\bwenas\b/g, "buenas"],
  [/\bq\b/g, "que"],
  [/\bk\b/g, "que"],
  [/\bxq\b/g, "porque"],
  [/\bpq\b/g, "porque"],
  [/\btmb\b/g, "tambien"],
  [/\bxfa\b/g, "por favor"],
  [/\bpls\b/g, "por favor"],
  [/\bporfa\b/g, "por favor"],
  [/\bnose\b/g, "no se"],
  [/\bayuda\b/g, "ayuda"],
  [/\bayiuda\b/g, "ayuda"],
  [/\bkuanto\b/g, "cuanto"],
  [/\bcuanto\b/g, "cuanto"],
  [/\bbale\b/g, "vale"],
  [/\bvale\b/g, "vale"],
  [/\bpersna\b/g, "persona"],
  [/\bpersnas\b/g, "personas"],
  [/\bpax\b/g, "personas"],
  [/\bma[nñ]n\b/g, "manana"],
  [/\bmanana\b/g, "manana"],
  [/\btoq\b/g, "tengo que"],
  [/\btngo\b/g, "tengo"],
  [/\btienes\b/g, "tienes"],
  [/\btenes\b/g, "tienes"],
  [/\bhay\b/g, "hay"],
  [/\bcupo\b/g, "cupo"],
  [/\balojamiento\b/g, "alojamiento"],
  [/\bapto\b/g, "apartamento"],
  [/\bdepto\b/g, "apartamento"],
  [/\bhabitacion(?:es)?\b/g, "habitacion"],
  [/\bwifi\b/g, "wifi"],
  [/\bwifi\b/g, "wifi"],
  [/\bcontrase[nñ]a\b/g, "contrasena"],
  [/\bclave\b/g, "clave"],
  [/\bcheck[- ]?in\b/g, "checkin"],
  [/\bcheck[- ]?out\b/g, "checkout"],
];

/** NFD + lowercase + informal folds for matching only. */
export function normalizeGuestTextForMatch(text: string): string {
  let out = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of INFORMAL_FOLDS) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Light edit-distance for short tokens (typo tolerance). */
export function tokenEditDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cur = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length]!;
}

/**
 * True when needle is contained after normalize, or fuzzy for short phrases.
 */
export function guestTextMatchesExample(
  guestNormalized: string,
  exampleNormalized: string,
): boolean {
  if (!guestNormalized || !exampleNormalized) return false;
  if (
    guestNormalized === exampleNormalized ||
    guestNormalized.includes(exampleNormalized) ||
    exampleNormalized.includes(guestNormalized)
  ) {
    return true;
  }
  // Fuzzy: only for short examples (typos like "persna" / "kuanto")
  if (exampleNormalized.length <= 18 && guestNormalized.length <= 40) {
    const gTokens = guestNormalized.split(" ");
    const eTokens = exampleNormalized.split(" ");
    if (eTokens.length === 1 && gTokens.includes(exampleNormalized)) return true;
    if (
      eTokens.length <= 3 &&
      eTokens.every((et) =>
        gTokens.some(
          (gt) =>
            gt === et ||
            (et.length >= 4 &&
              gt.length >= 4 &&
              tokenEditDistance(gt, et) <= 1),
        ),
      )
    ) {
      return true;
    }
  }
  return false;
}
